import { BusinessContext, InboxIdentity, PurchaseRequisitionFactsheetData } from '../types';
import { SapPurchaseOrderFactsheetClient } from './sap-po-factsheet-client';
import { SapPurchaseRequisitionFactsheetClient } from './sap-pr-factsheet-client';
import { 
    MOCK_PR_FACTSHEETS, 
    MOCK_PO_FACTSHEETS,
    MOCK_PR_APPROVAL_TREES,
    MOCK_PR_APPROVAL_COMMENTS
} from './mock/mock-factsheet-data';

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
            const facts = await this.poClient.fetchPurchaseOrderFacts(context.documentId, {
                origin: options?.sapOrigin,
                userJwt: identity.userJwt,
            });
            if (!facts) return context;
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

import { SapPurchaseRequisitionApprovalTreeClient } from './sap-pr-approval-tree-client';

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
                const mockSteps = MOCK_PR_APPROVAL_TREES[context.documentId] || [];
                const mockComments = MOCK_PR_APPROVAL_COMMENTS[context.documentId] || [];
                
                return { 
                    ...context, 
                    pr: {
                        ...mockData,
                        approvalTree: {
                            prNumber: context.documentId,
                            releaseStrategyName: mockData.header.releaseStrategyName,
                            steps: mockSteps,
                            comments: mockComments
                        }
                    } 
                };
            }
            return context;
        }

        try {
            const facts = await this.prClient.fetchPurchaseRequisitionFacts(context.documentId, {
                origin: options?.sapOrigin,
                userJwt: identity.userJwt,
                includeItems: options?.includeItemDetails !== false,
            });
            if (!facts) return context;

            // Derive department from first non-deleted item's purchasingGroup if header lacks it
            if (facts.header && !facts.header.department && facts.items && facts.items.length > 0) {
                const firstItem = facts.items[0];
                if (firstItem.purchasingGroup) {
                    facts.header.department = firstItem.purchasingGroup;
                }
            }

            // Only fetch extended data (description + approval tree) for detail-level calls,
            // NOT for list-level card enrichment where includeItemDetails=false.
            if (options?.includeItemDetails !== false && facts.header) {
                const description = await this.approvalTreeClient.fetchPrDescription(context.documentId, {
                    origin: options?.sapOrigin,
                    userJwt: identity.userJwt,
                });
                if (description) {
                    facts.header.purchaseRequisitionText = description;
                }

                const treeData = await this.approvalTreeClient.fetchApprovalTree(context.documentId, {
                    origin: options?.sapOrigin,
                    userJwt: identity.userJwt,
                });
                if (treeData.releaseStrategyName) {
                    facts.header.releaseStrategyName = treeData.releaseStrategyName;
                }
                facts.approvalTree = treeData;
            }

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
