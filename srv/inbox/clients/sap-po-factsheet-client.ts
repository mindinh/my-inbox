import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import {
    PurchaseOrderFactsheetData,
    PurchaseOrderHeader,
    PurchaseOrderItem,
    PurchaseOrderAccountAssignment,
    PurchaseOrderScheduleLine,
} from '../../types';

interface ODataCollection<T> {
    d?: {
        results?: T[];
    };
}

interface ODataSingle<T> {
    d?: T;
}

interface SapPurchaseOrderHeaderRaw {
    PurchaseOrder: string;
    PurchaseOrder_Text?: string;
    PurchaseOrderType?: string;
    PurchaseOrderType_Text?: string;
    CreatedByUser?: string;
    CreationDate?: string;
    PurchaseOrderDate?: string;
    CompanyCode?: string;
    CompanyCodeName?: string;
    PurchasingOrganization?: string;
    PurchasingOrganizationName?: string;
    PurchasingGroup?: string;
    PurchasingGroupName?: string;
    Supplier?: string;
    SupplierName?: string;
    PaymentTerms?: string;
    PaymentTerms_Text?: string;
    IncotermsClassification?: string;
    DocumentCurrency?: string;
    PurchaseOrderNetAmount?: string;
    PurchasingDocumentStatusName?: string;
    UserFullName?: string;
}

interface SapPurchaseOrderItemRaw {
    PurchaseOrder: string;
    PurchaseOrderItem: string;
    PurchaseOrderItemText?: string;
    PurchaseOrderItemCategory_Text?: string;
    MaterialGroup?: string;
    MaterialGroup_Text?: string;
    ProductType_Text?: string;
    FirstDeliveryDate?: string;
    OrderQuantity?: string;
    PurchaseOrderQuantityUnit?: string;
    NetPriceAmount?: string;
    PurchaseOrderPriceUnit?: string;
    NetAmount?: string;
    DocumentCurrency?: string;
    ServicePerformer?: string;
}

interface SapPOAccountAssignmentRaw {
    PurchaseOrder: string;
    PurchaseOrderItem: string;
    AccountAssignmentNumber: string;
    DistributionInPercent?: string;
    DistributionPercent?: string;
    DistributionPct?: string;
    GLAccount?: string;
    GLAccount_Text?: string;
    CostCenter?: string;
    CostCenter_Text?: string;
    FunctionalArea?: string;
    ProfitCenter?: string;
    ProfitCenter_Text?: string;
    UnloadingPoint?: string;
    ControllingArea?: string;
    ControllingArea_Text?: string;
    Fund?: string;
    FundsCenter?: string;
    EarmarkedFunds?: string;
    DocumentItem?: string;
    CommitmentItem?: string;
    Grant?: string;
    GrantID?: string;
    BudgetPeriod?: string;
    BusinessProcess?: string;
    GoodsRecipient?: string;
    GoodsRecipientName?: string;
    Asset?: string;
    AssetSubNumber?: string;
    AssetSubnumber?: string;
    Network?: string;
    NetworkActivity?: string;
    SDDocument?: string;
    SDDocumentItem?: string;
    SalesOrder?: string;
    WBSElement?: string;
    ProjectName?: string;
    WorkPackageName?: string;
    ServiceDocType?: string;
    ServiceDocument?: string;
    ServiceDocItem?: string;
}

interface SapPOScheduleLineRaw {
    PurchaseOrder: string;
    PurchaseOrderItem: string;
    ScheduleLine: string;
    ScheduleLineDeliveryDate?: string;
    ScheduleLineOrderQuantity?: string;
    PurchaseOrderQuantityUnit?: string;
}

export class SapPurchaseOrderFactsheetClient {
    private readonly destinationName: string;
    private readonly sapClient: string;
    private readonly enabled: boolean;
    private readonly defaultConfig: PurchaseOrderFactsheetConfig;
    private readonly byOriginConfig: Record<string, Partial<PurchaseOrderFactsheetConfig>>;

    constructor() {
        this.destinationName = process.env.SAP_PO_DESTINATION || process.env.SAP_TASK_DESTINATION || 'S4H_ODATA';
        this.sapClient = process.env.SAP_TASK_CLIENT || '400';
        this.enabled = process.env.SAP_PO_FS_ENABLED !== 'false';
        this.defaultConfig = {
            servicePath:
                process.env.SAP_PO_FS_ODATA_PATH ||
                '/sap/opu/odata/sap/C_PURCHASEORDER_FS_SRV',
            headerEntitySet: process.env.SAP_PO_HEADER_ENTITY_SET || 'C_PurchaseOrderFs',
            itemEntitySet: process.env.SAP_PO_ITEM_ENTITY_SET || 'C_PurOrdItemEnh',
            accountAssignmentEntitySet:
                process.env.SAP_PO_ACCOUNT_ENTITY_SET || 'C_POAccountAssignmentFactSheet',
            scheduleLineEntitySet:
                process.env.SAP_PO_SCHEDULE_ENTITY_SET || 'C_POScheduleLineFactSheet',
        };
        this.byOriginConfig = this.loadByOriginConfig();
    }

    async fetchPurchaseOrderFacts(
        purchaseOrder: string,
        options?: { origin?: string; userJwt?: string; includeDetails?: boolean }
    ): Promise<PurchaseOrderFactsheetData | null> {
        if (!this.enabled || !purchaseOrder) return null;
        const po = purchaseOrder.trim();
        if (!po) return null;
        const config = this.resolveConfig(options?.origin);
        const includeDetails = options?.includeDetails !== false;

        const headerPromise = this.fetchHeader(po, config, options?.userJwt);
        const detailsPromise = includeDetails
            ? Promise.all([
                  this.fetchItems(po, config, options?.userJwt),
                  this.fetchAccountAssignments(po, config, options?.userJwt),
                  this.fetchScheduleLines(po, config, options?.userJwt),
              ])
            : Promise.resolve([
                  [] as PurchaseOrderItem[],
                  [] as PurchaseOrderAccountAssignment[],
                  [] as PurchaseOrderScheduleLine[],
              ] as [PurchaseOrderItem[], PurchaseOrderAccountAssignment[], PurchaseOrderScheduleLine[]]);
        const [header, detailSets] = await Promise.all([headerPromise, detailsPromise]);
        const [items, accountAssignments, scheduleLines] = detailSets;

        if (!header) return null;
        return {
            header,
            items,
            accountAssignments,
            scheduleLines,
        };
    }

    private async fetchHeader(
        po: string,
        config: PurchaseOrderFactsheetConfig,
        userJwt?: string
    ): Promise<PurchaseOrderHeader | null> {
        const escapedPo = this.escapeODataString(po);
        const data = await this.get<ODataSingle<SapPurchaseOrderHeaderRaw>>(
            config,
            `/${config.headerEntitySet}('${escapedPo}')`,
            { $format: 'json' },
            userJwt
        );
        const raw = data.d;
        if (!raw || !raw.PurchaseOrder) return null;

        return {
            purchaseOrder: raw.PurchaseOrder,
            purchaseOrderText: raw.PurchaseOrder_Text,
            purchaseOrderType: raw.PurchaseOrderType,
            purchaseOrderTypeText: raw.PurchaseOrderType_Text,
            createdByUser: raw.CreatedByUser,
            createdOn: this.normalizeDate(raw.CreationDate),
            purchaseOrderDate: this.normalizeDate(raw.PurchaseOrderDate),
            companyCode: raw.CompanyCode,
            companyCodeName: raw.CompanyCodeName,
            purchasingOrganization: raw.PurchasingOrganization,
            purchasingOrganizationName: raw.PurchasingOrganizationName,
            purchasingGroup: raw.PurchasingGroup,
            purchasingGroupName: raw.PurchasingGroupName,
            supplier: raw.Supplier,
            supplierName: raw.SupplierName,
            paymentTerms: raw.PaymentTerms,
            paymentTermsText: raw.PaymentTerms_Text,
            incotermsClassification: raw.IncotermsClassification,
            documentCurrency: raw.DocumentCurrency,
            purchaseOrderNetAmount: raw.PurchaseOrderNetAmount,
            purchasingDocumentStatusName: raw.PurchasingDocumentStatusName,
            userFullName: raw.UserFullName,
            raw: this.extractFlatRaw(raw as unknown as Record<string, unknown>),
        };
    }

    private async fetchItems(
        po: string,
        config: PurchaseOrderFactsheetConfig,
        userJwt?: string
    ): Promise<PurchaseOrderItem[]> {
        const escapedPo = this.escapeODataString(po);
        const data = await this.get<ODataCollection<SapPurchaseOrderItemRaw>>(
            config,
            `/${config.itemEntitySet}`,
            {
                $format: 'json',
                $filter: `PurchaseOrder eq '${escapedPo}'`,
                $orderby: 'PurchaseOrderItem',
            },
            userJwt
        );
        const rows = data.d?.results || [];
        return rows.map((raw) => ({
            purchaseOrder: raw.PurchaseOrder,
            purchaseOrderItem: raw.PurchaseOrderItem,
            purchaseOrderItemText: raw.PurchaseOrderItemText,
            purchaseOrderItemCategoryText: raw.PurchaseOrderItemCategory_Text,
            materialGroup: raw.MaterialGroup,
            materialGroupText: raw.MaterialGroup_Text,
            productTypeText: raw.ProductType_Text,
            firstDeliveryDate: this.normalizeDate(raw.FirstDeliveryDate),
            orderQuantity: raw.OrderQuantity,
            purchaseOrderQuantityUnit: raw.PurchaseOrderQuantityUnit,
            netPriceAmount: raw.NetPriceAmount,
            purchaseOrderPriceUnit: raw.PurchaseOrderPriceUnit,
            netAmount: raw.NetAmount,
            documentCurrency: raw.DocumentCurrency,
            servicePerformer: raw.ServicePerformer,
        }));
    }

    private async fetchAccountAssignments(
        po: string,
        config: PurchaseOrderFactsheetConfig,
        userJwt?: string
    ): Promise<PurchaseOrderAccountAssignment[]> {
        const escapedPo = this.escapeODataString(po);
        const data = await this.get<ODataCollection<SapPOAccountAssignmentRaw>>(
            config,
            `/${config.accountAssignmentEntitySet}`,
            {
                $format: 'json',
                $filter: `PurchaseOrder eq '${escapedPo}'`,
                $orderby: 'PurchaseOrderItem,AccountAssignmentNumber',
            },
            userJwt
        );
        const rows = data.d?.results || [];
        return rows.map((raw) => {
            const rawRecord = raw as unknown as Record<string, unknown>;
            return {
                purchaseOrder: raw.PurchaseOrder,
                purchaseOrderItem: raw.PurchaseOrderItem,
                accountAssignmentNumber: raw.AccountAssignmentNumber,
                distributionPercentage: this.pickRawString(rawRecord, [
                    'DistributionInPercent',
                    'DistributionPercent',
                    'DistributionPct',
                ]),
                glAccount: raw.GLAccount,
                glAccountText: raw.GLAccount_Text,
                costCenter: raw.CostCenter,
                costCenterText: raw.CostCenter_Text,
                functionalArea: raw.FunctionalArea,
                profitCenter: raw.ProfitCenter,
                profitCenterText: raw.ProfitCenter_Text,
                unloadingPoint: raw.UnloadingPoint,
                controllingArea: raw.ControllingArea,
                controllingAreaText: raw.ControllingArea_Text,
                fund: raw.Fund,
                fundsCenter: raw.FundsCenter,
                earmarkedFunds: raw.EarmarkedFunds,
                documentItem: raw.DocumentItem,
                commitmentItem: raw.CommitmentItem,
                grant: this.pickRawString(rawRecord, ['Grant', 'GrantID']),
                budgetPeriod: raw.BudgetPeriod,
                businessProcess: raw.BusinessProcess,
                goodsRecipient: this.pickRawString(rawRecord, ['GoodsRecipientName', 'GoodsRecipient']),
                asset: raw.Asset,
                assetSubNumber: this.pickRawString(rawRecord, ['AssetSubNumber', 'AssetSubnumber']),
                network: raw.Network,
                networkActivity: raw.NetworkActivity,
                sdDocument: raw.SDDocument,
                sdDocumentItem: raw.SDDocumentItem,
                salesOrder: raw.SalesOrder,
                wbsElement: raw.WBSElement,
                projectName: raw.ProjectName,
                workPackageName: raw.WorkPackageName,
                serviceDocumentType: raw.ServiceDocType,
                serviceDocument: raw.ServiceDocument,
                serviceDocumentItem: raw.ServiceDocItem,
                raw: this.extractFlatRaw(rawRecord),
            };
        });
    }

    private async fetchScheduleLines(
        po: string,
        config: PurchaseOrderFactsheetConfig,
        userJwt?: string
    ): Promise<PurchaseOrderScheduleLine[]> {
        const escapedPo = this.escapeODataString(po);
        const data = await this.get<ODataCollection<SapPOScheduleLineRaw>>(
            config,
            `/${config.scheduleLineEntitySet}`,
            {
                $format: 'json',
                $filter: `PurchaseOrder eq '${escapedPo}'`,
                $orderby: 'PurchaseOrderItem,ScheduleLine',
            },
            userJwt
        );
        const rows = data.d?.results || [];
        return rows.map((raw) => ({
            purchaseOrder: raw.PurchaseOrder,
            purchaseOrderItem: raw.PurchaseOrderItem,
            scheduleLine: raw.ScheduleLine,
            scheduleLineDeliveryDate: this.normalizeDate(raw.ScheduleLineDeliveryDate),
            scheduleLineOrderQuantity: raw.ScheduleLineOrderQuantity,
            purchaseOrderQuantityUnit: raw.PurchaseOrderQuantityUnit,
        }));
    }

    private async get<T>(
        config: PurchaseOrderFactsheetConfig,
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

    private toUrl(config: PurchaseOrderFactsheetConfig, path: string): string {
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

    private resolveConfig(origin?: string): PurchaseOrderFactsheetConfig {
        if (!origin) return this.defaultConfig;
        const override = this.byOriginConfig[origin.toUpperCase()];
        if (!override) return this.defaultConfig;
        return {
            ...this.defaultConfig,
            ...override,
        };
    }

    private loadByOriginConfig(): Record<string, Partial<PurchaseOrderFactsheetConfig>> {
        const raw = process.env.SAP_PO_FS_CONFIG_JSON;
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw) as Record<string, Partial<PurchaseOrderFactsheetConfig>>;
            const normalized: Record<string, Partial<PurchaseOrderFactsheetConfig>> = {};
            for (const [origin, config] of Object.entries(parsed)) {
                normalized[origin.toUpperCase()] = config;
            }
            return normalized;
        } catch (error) {
            console.warn(
                `[SapPOFactsheet] Invalid SAP_PO_FS_CONFIG_JSON. ${
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

    private pickRawString(raw: Record<string, unknown>, keys: string[]): string | undefined {
        for (const key of keys) {
            const value = raw[key];
            if (value == null) continue;
            const text = String(value).trim();
            if (text) return text;
        }
        return undefined;
    }
}

interface PurchaseOrderFactsheetConfig {
    servicePath: string;
    headerEntitySet: string;
    itemEntitySet: string;
    accountAssignmentEntitySet: string;
    scheduleLineEntitySet: string;
}
