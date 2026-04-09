import type { PurchaseOrderFactsheetData, TaskDetail } from '@/services/inbox/inbox.types';
import type { TaskDetailRenderer } from './TaskDetailSections.types';
import {
    buildCustomAttributesTable,
    buildTaskObjectsTable,
    createAttributeIndex,
    field,
    pickByAlias,
} from './TaskDetailSections.shared';

function isPOTask(detail: TaskDetail): boolean {
    if (detail.businessContext?.type === 'PO') return true;
    return detail.taskObjects.some((obj) => obj.type.toLowerCase().includes('purchaseorder'));
}

export const poTaskDetailRenderer: TaskDetailRenderer = {
    id: 'po',
    matches: isPOTask,
    build: (detail) => {
        const idx = createAttributeIndex(detail.customAttributes);
        const documentId = detail.businessContext?.documentId || pickByAlias(idx, 'documentId');
        const poFacts = asPurchaseOrderFactsheet(detail.businessContext?.po);
        const header = poFacts?.header;
        const currency = header?.documentCurrency || pickByAlias(idx, 'currency');
        const netValue = header?.purchaseOrderNetAmount || pickByAlias(idx, 'netValue');

        return {
            title: 'Purchase Order',
            subtitle: documentId ? `PO ${documentId}` : 'Purchase order details from workflow task',
            cards: [
                {
                    id: 'po-basic',
                    title: 'Basic Data',
                    fields: [
                        field('PO Number', header?.purchaseOrder || documentId),
                        field('PO Type', header?.purchaseOrderTypeText || header?.purchaseOrderType),
                        field('Supplier', header?.supplierName || pickByAlias(idx, 'supplier')),
                        field('Created By', header?.userFullName || detail.task.createdByName),
                    ],
                },
                {
                    id: 'po-finance',
                    title: 'Delivery & Payment',
                    fields: [
                        field('Payment Terms', header?.paymentTermsText || header?.paymentTerms || pickByAlias(idx, 'paymentTerms')),
                        field('Incoterms', header?.incotermsClassification || pickByAlias(idx, 'incoterms')),
                        field('Net Value', formatAmount(netValue, currency)),
                        field('Currency', currency),
                    ],
                },
                {
                    id: 'po-org',
                    title: 'Recipient Data',
                    fields: [
                        field('Company Code', mergeCodeName(header?.companyCode, header?.companyCodeName)),
                        field('Purchasing Org', mergeCodeName(header?.purchasingOrganization, header?.purchasingOrganizationName)),
                        field('Status', header?.purchasingDocumentStatusName || detail.task.status),
                        field('Priority', detail.task.priority),
                    ],
                },
            ],
            tables: [
                buildPoHeaderFactsTable(poFacts, currency),
                buildPoItemsTable(poFacts, currency),
                buildPoAccountAssignmentsTable(poFacts),
                buildPoScheduleLinesTable(poFacts),
                buildPoCustomAttributesTable(detail.customAttributes, poFacts, currency),
                buildTaskObjectsTable(detail.taskObjects),
            ],
        };
    },
};

function asPurchaseOrderFactsheet(value: unknown): PurchaseOrderFactsheetData | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<PurchaseOrderFactsheetData>;
    if (!candidate.header || !Array.isArray(candidate.items)) return null;
    return candidate as PurchaseOrderFactsheetData;
}

function buildPoItemsTable(poFacts: PurchaseOrderFactsheetData | null, fallbackCurrency?: string) {
    return {
        id: 'po-items',
        title: 'Items',
        columns: [
            { key: 'item', label: 'Item' },
            { key: 'description', label: 'Short Text' },
            { key: 'materialGroup', label: 'Material Group' },
            { key: 'deliveryDate', label: 'Delivery Date' },
            { key: 'quantity', label: 'Order Quantity', align: 'right' as const },
            { key: 'netPrice', label: 'Net Price', align: 'right' as const },
            { key: 'netAmount', label: 'Net Amount', align: 'right' as const },
        ],
        rows: (poFacts?.items || []).map((item) => ({
            id: `${item.purchaseOrder}-${item.purchaseOrderItem}`,
            values: {
                item: item.purchaseOrderItem,
                description: item.purchaseOrderItemText || '-',
                materialGroup: mergeCodeName(item.materialGroup, item.materialGroupText),
                deliveryDate: formatDate(item.firstDeliveryDate),
                quantity: formatQuantity(item.orderQuantity, item.purchaseOrderQuantityUnit),
                netPrice: formatAmount(item.netPriceAmount, item.purchaseOrderPriceUnit || item.documentCurrency || fallbackCurrency),
                netAmount: formatAmount(item.netAmount, item.documentCurrency || fallbackCurrency),
            },
        })),
        emptyMessage: 'No item details from purchase order factsheet',
    };
}

function buildPoHeaderFactsTable(poFacts: PurchaseOrderFactsheetData | null, fallbackCurrency?: string) {
    const header = poFacts?.header;
    if (!header) {
        return {
            id: 'po-header-facts',
            title: 'Header Facts',
            columns: [
                { key: 'field', label: 'Field' },
                { key: 'value', label: 'Value' },
            ],
            rows: [],
            emptyMessage: 'No header facts available',
        };
    }

    const labelByKey: Record<string, string> = {
        purchaseOrder: 'Purchase Order',
        PurchaseOrder: 'Purchase Order',
        purchaseOrderText: 'Purchase Order Text',
        PurchaseOrder_Text: 'Purchase Order Text',
        purchaseOrderType: 'PO Type',
        PurchaseOrderType: 'PO Type',
        purchaseOrderTypeText: 'PO Type Text',
        PurchaseOrderType_Text: 'PO Type Text',
        createdByUser: 'Created By User',
        CreatedByUser: 'Created By User',
        createdOn: 'Created On',
        CreationDate: 'Created On',
        purchaseOrderDate: 'Purchase Order Date',
        PurchaseOrderDate: 'Purchase Order Date',
        companyCode: 'Company Code',
        CompanyCode: 'Company Code',
        companyCodeName: 'Company Code Name',
        CompanyCodeName: 'Company Code Name',
        purchasingOrganization: 'Purchasing Organization',
        PurchasingOrganization: 'Purchasing Organization',
        purchasingOrganizationName: 'Purchasing Org Name',
        PurchasingOrganizationName: 'Purchasing Org Name',
        purchasingGroup: 'Purchasing Group',
        PurchasingGroup: 'Purchasing Group',
        purchasingGroupName: 'Purchasing Group Name',
        PurchasingGroupName: 'Purchasing Group Name',
        supplier: 'Supplier',
        Supplier: 'Supplier',
        supplierName: 'Supplier Name',
        SupplierName: 'Supplier Name',
        paymentTerms: 'Payment Terms',
        PaymentTerms: 'Payment Terms',
        paymentTermsText: 'Payment Terms Text',
        PaymentTerms_Text: 'Payment Terms Text',
        incotermsClassification: 'Incoterms',
        IncotermsClassification: 'Incoterms',
        documentCurrency: 'Document Currency',
        DocumentCurrency: 'Document Currency',
        purchaseOrderNetAmount: 'PO Net Amount',
        PurchaseOrderNetAmount: 'PO Net Amount',
        purchasingDocumentStatusName: 'PO Status',
        PurchasingDocumentStatusName: 'PO Status',
        userFullName: 'User Full Name',
        UserFullName: 'User Full Name',
    };

    const sourceRecord: Record<string, string> =
        header.raw && Object.keys(header.raw).length > 0
            ? header.raw
            : (Object.entries(header).reduce<Record<string, string>>((acc, [key, value]) => {
                if (typeof value === 'string') acc[key] = value;
                return acc;
            }, {}));

    const rows = Object.entries(sourceRecord)
        .filter(([, value]) => value != null && String(value).trim() !== '')
        .map(([key, value], idx) => {
            const label = labelByKey[key] || key;
            const formattedValue =
                key.toLowerCase().includes('date')
                    ? formatDate(String(value))
                    : key === 'purchaseOrderNetAmount' || key === 'PurchaseOrderNetAmount'
                        ? formatAmount(String(value), header.documentCurrency || fallbackCurrency)
                        : String(value);

            return {
                id: `header-${idx}`,
                values: {
                    field: label,
                    value: formattedValue,
                },
            };
        });

    return {
        id: 'po-header-facts',
        title: 'Header Facts',
        columns: [
            { key: 'field', label: 'Field' },
            { key: 'value', label: 'Value' },
        ],
        rows,
        emptyMessage: 'No header facts available',
    };
}

function buildPoAccountAssignmentsTable(poFacts: PurchaseOrderFactsheetData | null) {
    const detailFieldLabels: Record<string, string> = {
        distributionPercentage: 'Distribution (%)',
        glAccount: 'G/L Account',
        costCenter: 'Cost Center',
        functionalArea: 'Functional Area',
        profitCenter: 'Profit Center',
        unloadingPoint: 'Unloading Point',
        controllingArea: 'Controlling Area',
        fund: 'Fund',
        fundsCenter: 'Funds Center',
        earmarkedFunds: 'Earmarked Funds',
        documentItem: 'Document Item',
        commitmentItem: 'Commitment Item',
        grant: 'Grant',
        budgetPeriod: 'Budget Period',
        businessProcess: 'Business Process',
        goodsRecipient: 'Goods Recipient',
        asset: 'Asset',
        assetSubNumber: 'Sub-number',
        network: 'Network',
        networkActivity: 'Network Activity',
        sdDocument: 'SD Document',
        sdDocumentItem: 'SD Item',
        salesOrder: 'Order',
        wbsElement: 'WBS Element',
        projectName: 'Project Name',
        workPackageName: 'Work Package Name',
        serviceDocumentType: 'Service Doc. Type',
        serviceDocument: 'Service Document',
        serviceDocumentItem: 'Service Doc. Item',
    };

    return {
        id: 'po-account-assignment',
        title: 'Account Assignment',
        columns: [
            { key: 'item', label: 'Item' },
            { key: 'assignment', label: 'Assignment' },
            { key: 'distributionPercentage', label: 'Distribution (%)', align: 'right' as const },
            { key: 'glAccount', label: 'GL Account' },
            { key: 'costCenter', label: 'Cost Center' },
            { key: 'profitCenter', label: 'Profit Center' },
        ],
        detailFieldLabels,
        rows: (poFacts?.accountAssignments || []).map((item) => ({
            id: `${item.purchaseOrder}-${item.purchaseOrderItem}-${item.accountAssignmentNumber}`,
            values: {
                item: item.purchaseOrderItem,
                assignment: item.accountAssignmentNumber,
                distributionPercentage: item.distributionPercentage || '-',
                glAccount: mergeCodeName(item.glAccount, item.glAccountText),
                costCenter: mergeCodeName(item.costCenter, item.costCenterText),
                functionalArea: item.functionalArea || '-',
                profitCenter: mergeCodeName(item.profitCenter, item.profitCenterText),
                unloadingPoint: item.unloadingPoint || '-',
                controllingArea: mergeCodeName(item.controllingArea, item.controllingAreaText),
                fund: item.fund || '-',
                fundsCenter: item.fundsCenter || '-',
                earmarkedFunds: item.earmarkedFunds || '-',
                documentItem: item.documentItem || '-',
                commitmentItem: item.commitmentItem || '-',
                grant: item.grant || '-',
                budgetPeriod: item.budgetPeriod || '-',
                businessProcess: item.businessProcess || '-',
                goodsRecipient: item.goodsRecipient || '-',
                asset: item.asset || '-',
                assetSubNumber: item.assetSubNumber || '-',
                network: item.network || '-',
                networkActivity: item.networkActivity || '-',
                sdDocument: item.sdDocument || '-',
                sdDocumentItem: item.sdDocumentItem || '-',
                salesOrder: item.salesOrder || '-',
                wbsElement: item.wbsElement || '-',
                projectName: item.projectName || '-',
                workPackageName: item.workPackageName || '-',
                serviceDocumentType: item.serviceDocumentType || '-',
                serviceDocument: item.serviceDocument || '-',
                serviceDocumentItem: item.serviceDocumentItem || '-',
                ...buildRawDetailFields(item.raw, detailFieldLabels),
            },
        })),
        emptyMessage: 'No account assignment data',
    };
}

function buildPoScheduleLinesTable(poFacts: PurchaseOrderFactsheetData | null) {
    return {
        id: 'po-schedule-lines',
        title: 'Schedule Lines',
        columns: [
            { key: 'item', label: 'Item' },
            { key: 'scheduleLine', label: 'Schedule Line' },
            { key: 'deliveryDate', label: 'Delivery Date' },
            { key: 'quantity', label: 'Quantity', align: 'right' as const },
        ],
        rows: (poFacts?.scheduleLines || []).map((line) => ({
            id: `${line.purchaseOrder}-${line.purchaseOrderItem}-${line.scheduleLine}`,
            values: {
                item: line.purchaseOrderItem,
                scheduleLine: line.scheduleLine,
                deliveryDate: formatDate(line.scheduleLineDeliveryDate),
                quantity: formatQuantity(line.scheduleLineOrderQuantity, line.purchaseOrderQuantityUnit),
            },
        })),
        emptyMessage: 'No schedule line data',
    };
}

function buildPoCustomAttributesTable(
    attributes: TaskDetail['customAttributes'],
    poFacts: PurchaseOrderFactsheetData | null,
    currency?: string
) {
    if (!poFacts?.header) {
        return buildCustomAttributesTable(attributes);
    }

    const header = poFacts.header;
    const fallbackByIndex: Record<number, { label: string; value: string }> = {
        1: { label: 'Supplier', value: mergeCodeName(header.supplier, header.supplierName) },
        2: { label: 'Company Code', value: mergeCodeName(header.companyCode, header.companyCodeName) },
        3: { label: 'Purchasing Organization', value: mergeCodeName(header.purchasingOrganization, header.purchasingOrganizationName) },
        4: { label: 'Payment Terms', value: header.paymentTermsText || header.paymentTerms || '-' },
        5: { label: 'Net Value', value: formatAmount(header.purchaseOrderNetAmount, header.documentCurrency || currency) },
    };

    const enriched = attributes.map((attr) => {
        const match = attr.name.match(/CUSTOMATTRIBUTE(\d+)/i);
        const idx = match ? Number(match[1]) : NaN;
        const mapped = Number.isNaN(idx) ? undefined : fallbackByIndex[idx];
        const hasOriginalValue = !!attr.value && attr.value.trim() !== '';
        const isGenericLabel = /^custom\s*attribute/i.test(attr.label);

        if (!mapped || hasOriginalValue) {
            return attr;
        }

        return {
            ...attr,
            label: isGenericLabel ? mapped.label : attr.label,
            value: mapped.value || attr.value,
        };
    });

    return buildCustomAttributesTable(enriched);
}

function mergeCodeName(code?: string, name?: string): string {
    if (code && name) return `${code} (${name})`;
    return code || name || '-';
}

function formatAmount(value?: string, currency?: string): string {
    if (!value) return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return currency ? `${value} ${currency}` : value;
    const formatted = num.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return currency ? `${formatted} ${currency}` : formatted;
}

function formatQuantity(value?: string, unit?: string): string {
    if (!value) return '-';
    const num = Number(value);
    const formatted = Number.isNaN(num)
        ? value
        : num.toLocaleString('en-US', { maximumFractionDigits: 3 });
    return unit ? `${formatted} ${unit}` : formatted;
}

function buildRawDetailFields(
    raw: Record<string, string> | undefined,
    detailFieldLabels: Record<string, string>
): Record<string, string> {
    if (!raw) return {};
    const mappedLabels = new Set(Object.keys(detailFieldLabels));
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
        if (!value) continue;
        const normalized = key.charAt(0).toLowerCase() + key.slice(1);
        if (mappedLabels.has(normalized)) continue;
        if (fields[key] != null) continue;
        fields[key] = value;
    }
    return fields;
}

function formatDate(value?: string): string {
    if (!value) return '-';
    const sapMatch = value.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    const date = sapMatch ? new Date(Number(sapMatch[1])) : new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-GB');
}
