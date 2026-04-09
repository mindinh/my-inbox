import type { PurchaseRequisitionFactsheetData, TaskDetail } from '@/services/inbox/inbox.types';
import type { TaskDetailRenderer } from './TaskDetailSections.types';
import {
    buildCustomAttributesTable,
    buildTaskObjectsTable,
    createAttributeIndex,
    field,
    pickByAlias,
} from './TaskDetailSections.shared';

function isPRTask(detail: TaskDetail): boolean {
    if (detail.businessContext?.type === 'PR') return true;
    return detail.taskObjects.some((obj) => obj.type.toLowerCase().includes('purchaserequisition'));
}

export const prTaskDetailRenderer: TaskDetailRenderer = {
    id: 'pr',
    matches: isPRTask,
    build: (detail) => {
        const idx = createAttributeIndex(detail.customAttributes);
        const documentId = detail.businessContext?.documentId || pickByAlias(idx, 'documentId');
        const prFacts = asPurchaseRequisitionFactsheet(detail.businessContext?.pr);
        const header = prFacts?.header;

        const currency = pickByAlias(idx, 'currency') || header?.displayCurrency;
        const netValue = pickByAlias(idx, 'netValue') || header?.totalNetAmount;

        return {
            title: 'Purchase Requisition',
            subtitle: documentId ? `PR ${documentId}` : 'Purchase requisition details',
            cards: [
                {
                    id: 'pr-basic',
                    title: 'Basic Data',
                    fields: [
                        field('PR Number', header?.purchaseRequisition || documentId),
                        field('Description', header?.purchaseRequisitionText),
                        field('Requestor', header?.userFullName || detail.task.createdByName),
                        field('PR Type', mergeCodeName(header?.purchaseRequisitionType, prFacts?.items?.[0]?.purchaseRequisitionTypeText)),
                        field('Department', '1001201000 - IT department'),
                        field('Expense Type / Commitment', '6105 - IT Equipment & Software Cost'),
                    ],
                },
                {
                    id: 'pr-finance',
                    title: 'Amount',
                    fields: [
                        field('Total Net Amount', formatAmount(netValue, currency)),
                        field('Currency', currency),
                        field('Number of Items', header?.numberOfItems),
                    ],
                },
                {
                    id: 'pr-workflow',
                    title: 'Workflow',
                    fields: [
                        field('Created On', formatDate(header?.purReqCreationDate)),
                        field('Priority', detail.task.priority),
                        field('Release Strategy', header?.releaseStrategyName),
                    ],
                },
            ],
            tables: [
                buildPrHeaderFactsTable(prFacts, currency),
                buildPrItemsTable(prFacts, currency),
                buildCustomAttributesTable(detail.customAttributes),
                buildTaskObjectsTable(detail.taskObjects),
            ],
        };
    },
};

function asPurchaseRequisitionFactsheet(value: unknown): PurchaseRequisitionFactsheetData | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<PurchaseRequisitionFactsheetData>;
    if (!candidate.header || !Array.isArray(candidate.items)) return null;
    return candidate as PurchaseRequisitionFactsheetData;
}

function buildPrItemsTable(prFacts: PurchaseRequisitionFactsheetData | null, fallbackCurrency?: string) {
    return {
        id: 'pr-items',
        title: 'Items',
        columns: [
            { key: 'item', label: 'Item' },
            { key: 'description', label: 'Short Text' },
            { key: 'material', label: 'Material' },
            { key: 'materialGroup', label: 'Material Group' },
            { key: 'quantity', label: 'Quantity', align: 'right' as const },
            { key: 'price', label: 'Price', align: 'right' as const },
            { key: 'totalAmount', label: 'Total Amount', align: 'right' as const },
            { key: 'deliveryDate', label: 'Delivery Date' },
        ],
        rows: (prFacts?.items || []).map((item) => ({
            id: `${item.purchaseRequisition}-${item.purchaseRequisitionItem}`,
            values: {
                item: item.purchaseRequisitionItem,
                description: item.purchaseRequisitionItemText || '-',
                material: item.material || '-',
                materialGroup: mergeCodeName(item.materialGroup, item.materialGroupText),
                quantity: formatQuantity(item.requestedQuantity, item.baseUnit),
                price: formatAmount(item.purchaseRequisitionPrice, item.purReqnItemCurrency || fallbackCurrency),
                totalAmount: formatAmount(item.purReqnItemTotalAmount, item.purReqnItemCurrency || fallbackCurrency),
                releaseStatus: item.purReqnReleaseStatusText || item.purReqnReleaseStatus || '-',
                deliveryDate: formatDate(item.deliveryDate),
            },
        })),
        emptyMessage: 'No item details from purchase requisition factsheet',
    };
}

function buildPrHeaderFactsTable(prFacts: PurchaseRequisitionFactsheetData | null, fallbackCurrency?: string) {
    const header = prFacts?.header;
    if (!header) {
        return {
            id: 'pr-header-facts',
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
        purchaseRequisition: 'Purchase Requisition',
        PurchaseRequisition: 'Purchase Requisition',
        purchaseRequisitionText: 'PR Text',
        PurchaseRequisitionText: 'PR Text',
        purReqnRequestor: 'Requestor',
        PurReqnRequestor: 'Requestor',
        userFullName: 'User Full Name',
        UserFullName: 'User Full Name',
        purReqCreationDate: 'Creation Date',
        PurReqCreationDate: 'Creation Date',
        numberOfItems: 'Number of Items',
        NumberOfItems: 'Number of Items',
        purchaseRequisitionType: 'PR Type',
        PurchaseRequisitionType: 'PR Type',
        totalNetAmount: 'Total Net Amount',
        TotalNetAmount: 'Total Net Amount',
        displayCurrency: 'Currency',
        DisplayCurrency: 'Currency',
        purReqnHdrCurrencySourceDesc: 'Currency Source',
        PurReqnHdrCurrencySourceDesc: 'Currency Source',
        workflowScenarioDefinition: 'Workflow Scenario',
        WorkflowScenarioDefinition: 'Workflow Scenario',
        isPurReqnOvrlRel: 'Overall Released',
        IsPurReqnOvrlRel: 'Overall Released',
        createdByUser: 'Created By User',
        CreatedByUser: 'Created By User',
    };

    const sourceRecord: Record<string, string> =
        header.raw && Object.keys(header.raw).length > 0
            ? header.raw
            : (Object.entries(header).reduce<Record<string, string>>((acc, [key, value]) => {
                if (value != null && typeof value !== 'object') acc[key] = String(value);
                return acc;
            }, {}));

    const rows = Object.entries(sourceRecord)
        .filter(([, value]) => value != null && String(value).trim() !== '')
        .map(([key, value], idx) => {
            const label = labelByKey[key] || key;
            const formattedValue =
                key.toLowerCase().includes('date')
                    ? formatDate(String(value))
                    : key === 'totalNetAmount' || key === 'TotalNetAmount'
                        ? formatAmount(String(value), header.displayCurrency || fallbackCurrency)
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
        id: 'pr-header-facts',
        title: 'Header Facts',
        columns: [
            { key: 'field', label: 'Field' },
            { key: 'value', label: 'Value' },
        ],
        rows,
        emptyMessage: 'No header facts available',
    };
}

// ─── Formatting Helpers ──────────────────────────────────

function mergeCodeName(code?: string, name?: string): string {
    if (code && name && code !== name) return `${code} (${name})`;
    return code || name || '-';
}

function formatAmount(value?: string | number, currency?: string): string {
    if (value == null) return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return currency ? `${value} ${currency}` : String(value);
    const formatted = num.toLocaleString('vi-VN');
    return currency ? `${formatted} ${currency}` : formatted;
}

function formatQuantity(value?: string, unit?: string): string {
    if (!value) return '-';
    const num = Number(value);
    const formatted = Number.isNaN(num)
        ? value
        : num.toLocaleString('vi-VN');
    return unit ? `${formatted} ${unit}` : formatted;
}

function formatDate(value?: string): string {
    if (!value) return '-';
    const sapMatch = value.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    const date = sapMatch ? new Date(Number(sapMatch[1])) : new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-GB');
}
