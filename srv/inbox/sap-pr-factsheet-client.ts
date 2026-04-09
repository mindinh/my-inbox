import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import {
    PurchaseRequisitionFactsheetData,
    PurchaseRequisitionHeader,
    PurchaseRequisitionItem,
} from '../types';

interface ODataCollection<T> {
    d?: {
        results?: T[];
        __count?: string;
    };
}

interface ODataSingle<T> {
    d?: T;
}

// ─── SAP Raw Entity Types (C_PURREQUISITION_FS_SRV) ───────

interface SapPurRequisitionFsRaw {
    PurchaseRequisition: string;
    PurchaseRequisitionText?: string;
    PurReqnRequestor?: string;
    UserFullName?: string;
    PurReqCreationDate?: string;
    NumberOfItems?: number;
    PurchaseRequisitionType?: string;
    TotalNetAmount?: string;
    DisplayCurrency?: string;
    PurReqnHdrCurrencySourceDesc?: string;
    WorkflowTaskInternalID?: string;
    WorkflowScenarioDefinition?: string;
    IsPurReqnOvrlRel?: boolean;
    IsOnBehalfCart?: boolean;
    CreatedByUser?: string;
    CreatedByUserFullName?: string;
    PurReqnRequestorFullName?: string;
    RequisitionerName?: string;
    ProcurementHubSourceSystem?: string;
    ContactCardNavLinkQueryPart?: string;
}

interface SapPurRequisitionItemFsRaw {
    PurchaseRequisition: string;
    PurchaseRequisitionItem: string;
    PurchaseRequisitionItemText?: string;
    Material?: string;
    Material_Text?: string;
    MaterialGroup?: string;
    MaterialGroup_Text?: string;
    PurchaseRequisitionType?: string;
    PurchaseRequisitionType_Text?: string;
    PurchaseRequisitionPrice?: string;
    PurReqnItemTotalAmount?: string;
    PurReqnPriceQuantity?: string;
    PurReqnItemCurrency?: string;
    PurReqnReleaseStatus?: string;
    PurReqnReleaseStatus_Text?: string;
    ProcessingStatus?: string;
    ProcessingStatus_Text?: string;
    RequestedQuantity?: string;
    BaseUnit?: string;
    PurchasingGroup?: string;
    PurchasingOrganization?: string;
    Plant?: string;
    DeliveryDate?: string;
    PlainLongText?: string;
    CreatedByUser?: string;
    UserFullName?: string;
    PurReqnRequestorFullName?: string;
    RequisitionerName?: string;
    CreatedByUserFullName?: string;
    Supplier?: string;
    FixedSupplier?: string;
    ExtFixedSupplierForPurg?: string;
    ExtDesiredSupplierForPurg?: string;
    IsDeleted?: boolean;
}

// ─── Client ───────────────────────────────────────────────

export class SapPurchaseRequisitionFactsheetClient {
    private readonly destinationName: string;
    private readonly sapClient: string;
    private readonly enabled: boolean;
    private readonly defaultConfig: PurchaseRequisitionFactsheetConfig;
    private readonly byOriginConfig: Record<string, Partial<PurchaseRequisitionFactsheetConfig>>;

    constructor() {
        this.destinationName =
            process.env.SAP_PR_DESTINATION ||
            process.env.SAP_TASK_DESTINATION ||
            'S4H_ODATA';
        this.sapClient = process.env.SAP_TASK_CLIENT || '400';
        this.enabled = process.env.SAP_PR_FS_ENABLED !== 'false';
        this.defaultConfig = {
            servicePath:
                process.env.SAP_PR_FS_ODATA_PATH ||
                '/sap/opu/odata/SAP/C_PURREQUISITION_FS_SRV',
            headerEntitySet: process.env.SAP_PR_HEADER_ENTITY || 'C_PurRequisitionFs',
            itemNavProperty: 'to_PurRequisitionItemFs',
        };
        this.byOriginConfig = this.loadByOriginConfig();
    }

    async fetchPurchaseRequisitionFacts(
        purchaseRequisition: string,
        options?: { origin?: string; userJwt?: string; includeItems?: boolean }
    ): Promise<PurchaseRequisitionFactsheetData | null> {
        if (!this.enabled || !purchaseRequisition) return null;
        const pr = purchaseRequisition.trim();
        if (!pr) return null;
        const config = this.resolveConfig(options?.origin);
        const includeItems = options?.includeItems !== false;

        const [header, items, requestorHint] = await Promise.all([
            this.fetchHeader(pr, config, options?.userJwt),
            includeItems
                ? this.fetchItems(pr, config, options?.userJwt)
                : Promise.resolve([]),
            includeItems
                ? Promise.resolve(undefined)
                : this.fetchRequestorHint(pr, config, options?.userJwt),
        ]);

        if (!header) return null;
        if (!header.userFullName && requestorHint) {
            header.userFullName = requestorHint;
        }
        return { header, items };
    }

    // ─── Entity Fetchers ──────────────────────────────────

    private async fetchHeader(
        pr: string,
        config: PurchaseRequisitionFactsheetConfig,
        userJwt?: string
    ): Promise<PurchaseRequisitionHeader | null> {
        const escapedPr = this.escapeODataString(pr);
        const data = await this.get<ODataSingle<SapPurRequisitionFsRaw>>(
            config,
            `/${config.headerEntitySet}('${escapedPr}')`,
            { $format: 'json' },
            userJwt
        );
        const raw = data.d;
        if (!raw || !raw.PurchaseRequisition) return null;

        return {
            purchaseRequisition: raw.PurchaseRequisition,
            purchaseRequisitionText: raw.PurchaseRequisitionText,
            purReqnRequestor: raw.PurReqnRequestor,
            purReqCreationDate: this.normalizeDate(raw.PurReqCreationDate),
            numberOfItems: raw.NumberOfItems,
            purchaseRequisitionType: raw.PurchaseRequisitionType,
            totalNetAmount: raw.TotalNetAmount,
            displayCurrency: raw.DisplayCurrency,
            purReqnHdrCurrencySourceDesc: raw.PurReqnHdrCurrencySourceDesc,
            workflowScenarioDefinition: raw.WorkflowScenarioDefinition,
            workflowTaskInternalID: raw.WorkflowTaskInternalID,
            isPurReqnOvrlRel: raw.IsPurReqnOvrlRel,
            isOnBehalfCart: raw.IsOnBehalfCart,
            createdByUser: raw.CreatedByUser,
            userFullName:
                raw.UserFullName ||
                raw.PurReqnRequestorFullName ||
                raw.CreatedByUserFullName ||
                raw.RequisitionerName,
            raw: this.extractFlatRaw(raw as unknown as Record<string, unknown>),
        };
    }

    private async fetchItems(
        pr: string,
        config: PurchaseRequisitionFactsheetConfig,
        userJwt?: string
    ): Promise<PurchaseRequisitionItem[]> {
        // Items are fetched via navigation property: C_PurRequisitionFs('...')/to_PurRequisitionItemFs
        const escapedPr = this.escapeODataString(pr);
        const data = await this.get<ODataCollection<SapPurRequisitionItemFsRaw>>(
            config,
            `/${config.headerEntitySet}('${escapedPr}')/${config.itemNavProperty}`,
            {
                $format: 'json',
                $inlinecount: 'allpages',
                $top: '100',
                $skip: '0',
            },
            userJwt
        );
        const rows = data.d?.results || [];
        return rows
            .filter((raw) => !raw.IsDeleted)
            .map((raw) => ({
                purchaseRequisition: raw.PurchaseRequisition,
                purchaseRequisitionItem: raw.PurchaseRequisitionItem,
                purchaseRequisitionItemText: raw.PurchaseRequisitionItemText,
                material: raw.Material,
                materialText: raw.Material_Text,
                materialGroup: raw.MaterialGroup,
                materialGroupText: raw.MaterialGroup_Text,
                purchaseRequisitionType: raw.PurchaseRequisitionType,
                purchaseRequisitionTypeText: raw.PurchaseRequisitionType_Text,
                purchaseRequisitionPrice: raw.PurchaseRequisitionPrice,
                purReqnItemTotalAmount: raw.PurReqnItemTotalAmount,
                purReqnPriceQuantity: raw.PurReqnPriceQuantity,
                purReqnItemCurrency: raw.PurReqnItemCurrency,
                purReqnReleaseStatus: raw.PurReqnReleaseStatus,
                purReqnReleaseStatusText: raw.PurReqnReleaseStatus_Text,
                processingStatus: raw.ProcessingStatus,
                processingStatusText: raw.ProcessingStatus_Text,
                requestedQuantity: raw.RequestedQuantity,
                baseUnit: raw.BaseUnit,
                purchasingGroup: raw.PurchasingGroup,
                purchasingOrganization: raw.PurchasingOrganization,
                plant: raw.Plant,
                deliveryDate: this.normalizeDate(raw.DeliveryDate),
                plainLongText: raw.PlainLongText,
                createdByUser: raw.CreatedByUser,
                userFullName:
                    raw.UserFullName ||
                    raw.PurReqnRequestorFullName ||
                    raw.RequisitionerName ||
                    raw.CreatedByUserFullName,
                supplier: raw.Supplier,
                fixedSupplier: raw.FixedSupplier,
            }));
    }

    private async fetchRequestorHint(
        pr: string,
        config: PurchaseRequisitionFactsheetConfig,
        userJwt?: string
    ): Promise<string | undefined> {
        const escapedPr = this.escapeODataString(pr);
        const data = await this.get<ODataCollection<SapPurRequisitionItemFsRaw>>(
            config,
            `/${config.headerEntitySet}('${escapedPr}')/${config.itemNavProperty}`,
            {
                $format: 'json',
                $top: '1',
                $skip: '0',
                $select: 'UserFullName,PurReqnRequestorFullName,RequisitionerName,CreatedByUserFullName,CreatedByUser',
            },
            userJwt
        );

        const first = data.d?.results?.[0];
        if (!first) return undefined;
        return (
            first.UserFullName ||
            first.PurReqnRequestorFullName ||
            first.RequisitionerName ||
            first.CreatedByUserFullName ||
            first.CreatedByUser ||
            undefined
        );
    }

    // ─── HTTP Layer ───────────────────────────────────────

    private async get<T>(
        config: PurchaseRequisitionFactsheetConfig,
        path: string,
        params: Record<string, string>,
        userJwt?: string
    ): Promise<T> {
        const url = this.appendQuery(this.toUrl(config, path), {
            ...params,
            'sap-client': this.sapClient,
        });

        const destination =
            userJwt && userJwt.trim()
                ? { destinationName: this.destinationName, jwt: userJwt }
                : { destinationName: this.destinationName };
        const response = await executeHttpRequest(
            destination,
            {
                method: 'GET',
                url,
                headers: {
                    Accept: 'application/json',
                },
            }
        );

        return response.data as T;
    }

    // ─── Utilities ────────────────────────────────────────

    private toUrl(config: PurchaseRequisitionFactsheetConfig, path: string): string {
        if (path.startsWith('/')) {
            return `${config.servicePath}${path}`;
        }
        return `${config.servicePath}/${path}`;
    }

    private appendQuery(url: string, params: Record<string, string>): string {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            search.append(key, value);
        }
        return `${url}?${search.toString()}`;
    }

    private escapeODataString(value: string): string {
        return value.replace(/'/g, "''");
    }

    private resolveConfig(origin?: string): PurchaseRequisitionFactsheetConfig {
        if (!origin) return this.defaultConfig;
        const override = this.byOriginConfig[origin.toUpperCase()];
        if (!override) return this.defaultConfig;
        return {
            ...this.defaultConfig,
            ...override,
        };
    }

    private loadByOriginConfig(): Record<string, Partial<PurchaseRequisitionFactsheetConfig>> {
        const raw = process.env.SAP_PR_FS_CONFIG_JSON;
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw) as Record<string, Partial<PurchaseRequisitionFactsheetConfig>>;
            const normalized: Record<string, Partial<PurchaseRequisitionFactsheetConfig>> = {};
            for (const [origin, config] of Object.entries(parsed)) {
                normalized[origin.toUpperCase()] = config;
            }
            return normalized;
        } catch (error) {
            console.warn(
                `[SapPRFactsheet] Invalid SAP_PR_FS_CONFIG_JSON. ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return {};
        }
    }

    private normalizeDate(raw?: string): string | undefined {
        if (!raw) return undefined;
        const msMatch = raw.match(/\/Date\((\d+)\)\//);
        if (msMatch) {
            return new Date(Number(msMatch[1])).toISOString();
        }
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return raw;
        return parsed.toISOString();
    }

    private extractFlatRaw(raw: Record<string, unknown>): Record<string, string> {
        const out: Record<string, string> = {};
        for (const [key, value] of Object.entries(raw)) {
            if (value == null) continue;
            if (typeof value === 'object') continue;
            const text = String(value).trim();
            if (!text) continue;
            out[key] = text;
        }
        return out;
    }
}

interface PurchaseRequisitionFactsheetConfig {
    servicePath: string;
    headerEntitySet: string;
    itemNavProperty: string;
}
