import { BusinessContext, InboxIdentity, PurchaseRequisitionFactsheetData } from '../../types';
import { SapPurchaseOrderFactsheetClient } from '../clients/sap-po-factsheet-client';
import { SapPurchaseRequisitionFactsheetClient } from '../clients/sap-pr-factsheet-client';
import { 
    MOCK_PR_FACTSHEETS, 
    MOCK_PO_FACTSHEETS,
    MOCK_PR_APPROVAL_TREES,
    MOCK_PR_APPROVAL_COMMENTS
} from '../mock/mock-factsheet-data';

// ─── Factsheet Cache (TTL-based) ────────────────────────────
// Prevents N+1 redundant SAP calls when enriching list items.
// Same document ID within TTL window returns cached result instantly.

const FACTSHEET_CACHE_TTL_MS = 60_000; // 60 seconds

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

class FactsheetCache<T> {
    private cache = new Map<string, CacheEntry<T>>();
    private maxSize: number;

    constructor(maxSize = 200) {
        this.maxSize = maxSize;
    }

    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }
        return entry.data;
    }

    set(key: string, data: T): void {
        // Evict oldest entries if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(key, { data, expiresAt: Date.now() + FACTSHEET_CACHE_TTL_MS });
    }

    /** Clear all or a specific key */
    invalidate(key?: string): void {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }
}

// Shared caches for PR and PO factsheet data
const prFactsheetCache = new FactsheetCache<any>(200);
const poFactsheetCache = new FactsheetCache<any>(200);

export interface BusinessObjectDataProvider {
    name: string;
    supports(context: BusinessContext): boolean;
    enrich(
        identity: InboxIdentity,
        context: BusinessContext,
        options?: BusinessObjectResolutionOptions
    ): Promise<BusinessContext>;
}

export interface BusinessObjectResolutionOptions {
    sapOrigin?: string;
    includeItemDetails?: boolean;
    includePrInfo?: boolean;
    includeApprovalTree?: boolean;
}

function isMockMode(): boolean {
    return process.env.USE_MOCK_SAP === 'true';
}

class PurchaseOrderDataProvider implements BusinessObjectDataProvider {
    readonly name = 'purchase-order';
    private readonly poClient = new SapPurchaseOrderFactsheetClient();

    supports(context: BusinessContext): boolean {
        return context.type === 'PO' && !!context.documentId;
    }

    async enrich(
        identity: InboxIdentity,
        context: BusinessContext,
        options?: BusinessObjectResolutionOptions
    ): Promise<BusinessContext> {
        if (!context.documentId) return context;

        // In mock mode, use mock factsheet data directly
        if (isMockMode()) {
            const mockData = MOCK_PO_FACTSHEETS[context.documentId];
            if (mockData) {
                return { ...context, po: mockData };
            }
            return context;
        }

        try {
            const includeDetails = options?.includeItemDetails !== false;
            const cacheKey = `${context.documentId}:${options?.sapOrigin || ''}:${includeDetails}`;

            // Check cache first to avoid redundant SAP call
            const cached = poFactsheetCache.get(cacheKey);
            if (cached) {
                return { ...context, po: cached };
            }

            const facts = await this.poClient.fetchPurchaseOrderFacts(context.documentId, {
                origin: options?.sapOrigin,
                userJwt: identity.userJwt,
                includeDetails,
            });
            if (!facts) return context;

            poFactsheetCache.set(cacheKey, facts);
            return {
                ...context,
                po: facts,
            };
        } catch (error) {
            console.warn(
                `[BusinessData] Failed to load PO factsheet (${context.documentId}): ${error instanceof Error ? error.message : String(error)
                }`
            );
            return context;
        }
    }
}

import { SapPurchaseRequisitionApprovalTreeClient } from '../clients/sap-pr-approval-tree-client';

class PurchaseRequisitionDataProvider implements BusinessObjectDataProvider {
    readonly name = 'purchase-requisition';
    private readonly prClient = new SapPurchaseRequisitionFactsheetClient();
    private readonly approvalTreeClient = new SapPurchaseRequisitionApprovalTreeClient();

    supports(context: BusinessContext): boolean {
        return context.type === 'PR' && !!context.documentId;
    }

    async enrich(
        identity: InboxIdentity,
        context: BusinessContext,
        options?: BusinessObjectResolutionOptions
    ): Promise<BusinessContext> {
        if (!context.documentId) return context;

        // In mock mode, use mock factsheet data directly
        if (isMockMode()) {
            const mockData = MOCK_PR_FACTSHEETS[context.documentId];
            if (mockData) {
                const includeApprovalTree = options?.includeApprovalTree === true;
                const mockSteps = includeApprovalTree ? MOCK_PR_APPROVAL_TREES[context.documentId] || [] : [];
                const mockComments = includeApprovalTree ? MOCK_PR_APPROVAL_COMMENTS[context.documentId] || [] : [];

                return {
                    ...context,
                    pr: {
                        ...mockData,
                        approvalTree: includeApprovalTree
                            ? {
                                  prNumber: context.documentId,
                                  releaseStrategyName: mockData.header.releaseStrategyName,
                                  steps: mockSteps,
                                  comments: mockComments,
                              }
                            : undefined,
                    }
                };
            }
            return context;
        }

        try {
            const includePrInfo = options?.includePrInfo === true;
            const includeApprovalTree = options?.includeApprovalTree === true;
            const includeItems = options?.includeItemDetails !== false;
            const cacheKey = `${context.documentId}:${options?.sapOrigin || ''}:${includeItems}:${includePrInfo}:${includeApprovalTree}`;

            // Check cache first to avoid redundant SAP call
            const cached = prFactsheetCache.get(cacheKey);
            if (cached) {
                return { ...context, pr: cached };
            }

            const factsPromise = this.prClient.fetchPurchaseRequisitionFacts(context.documentId, {
                origin: options?.sapOrigin,
                userJwt: identity.userJwt,
                includeItems,
            });
            const prInfoPromise = includePrInfo
                ? this.approvalTreeClient.fetchPrInfo(context.documentId, {
                      origin: options?.sapOrigin,
                      userJwt: identity.userJwt,
                  })
                : Promise.resolve(undefined);
            const treePromise = includeApprovalTree
                ? this.approvalTreeClient.fetchApprovalTree(context.documentId, {
                      origin: options?.sapOrigin,
                      userJwt: identity.userJwt,
                  })
                : Promise.resolve(undefined);

            const [facts, info, treeData] = await Promise.all([
                factsPromise,
                prInfoPromise,
                treePromise,
            ]);
            if (!facts) return context;

            // Derive department from first non-deleted item's purchasingGroup if header lacks it
            if (facts.header && !facts.header.department && facts.items && facts.items.length > 0) {
                const firstItem = facts.items[0];
                if (firstItem.purchasingGroup) {
                    facts.header.department = firstItem.purchasingGroup;
                }
            }

            if (includePrInfo && facts.header) {
                if (info?.description) {
                    facts.header.purchaseRequisitionText = info.description;
                }
                if (info?.releaseStrategyName) {
                    facts.header.releaseStrategyName = info.releaseStrategyName;
                }
            }

            if (includeApprovalTree && treeData) {
                facts.approvalTree = treeData;
            }

            prFactsheetCache.set(cacheKey, facts);
            return { ...context, pr: facts };
        } catch (error) {
            console.warn(
                `[BusinessData] Failed to load PR factsheet (${context.documentId}): ${error instanceof Error ? error.message : String(error)}`
            );
            return context;
        }
    }
}

// Self-registering providers
const providers: BusinessObjectDataProvider[] = [
    new PurchaseOrderDataProvider(),
    new PurchaseRequisitionDataProvider(),
];

export function registerBusinessObjectProvider(provider: BusinessObjectDataProvider): void {
    providers.push(provider);
}

export async function enrichBusinessObjectData(
    identity: InboxIdentity,
    context: BusinessContext,
    options?: BusinessObjectResolutionOptions
): Promise<BusinessContext> {
    let current = context;
    for (const provider of providers) {
        if (!provider.supports(current)) continue;
        current = await provider.enrich(identity, current, options);
    }
    return current;
}
