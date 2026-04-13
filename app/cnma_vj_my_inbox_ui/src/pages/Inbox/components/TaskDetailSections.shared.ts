import type {
    CustomAttribute,
    TaskDetail,
    TaskObject,
} from '@/services/inbox/inbox.types';
import type { DetailField, DetailTableModel, DetailTableRow } from './TaskDetailSections.types';

const EMPTY_VALUE = '-';

const ATTRIBUTE_NAME_ALIASES: Record<string, string[]> = {
    documentId: ['ponumber', 'purchasenumber', 'purchaseorder', 'prnumber', 'purchaserequisition', 'banfn', 'ebeln'],
    supplier: ['vendorname', 'supplier', 'suppliername', 'lifnr'],
    companyCode: ['companycode', 'bukrs'],
    purchasingOrg: ['purchorganization', 'purchasingorganization', 'ekorg'],
    paymentTerms: ['paymentterms', 'zterm'],
    incoterms: ['incoterms', 'inco1', 'inco2'],
    netValue: ['netvalue', 'totalvalue', 'amount'],
    currency: ['currency', 'waers'],
};

export function normalizeDisplayValue(value: unknown): string {
    if (value == null) return EMPTY_VALUE;
    const text = String(value).trim();
    return text ? text : EMPTY_VALUE;
}

export function field(label: string, value: unknown, key?: string): DetailField {
    return {
        key: key || label.toLowerCase().replace(/\s+/g, '-'),
        label,
        value: normalizeDisplayValue(value),
    };
}

export function createAttributeIndex(attributes: CustomAttribute[]): Map<string, CustomAttribute> {
    const index = new Map<string, CustomAttribute>();
    for (const attr of attributes) {
        index.set(attr.name.toLowerCase(), attr);
        index.set(attr.label.toLowerCase(), attr);
    }
    return index;
}

export function pickAttribute(
    index: Map<string, CustomAttribute>,
    candidates: string[]
): CustomAttribute | undefined {
    for (const key of candidates) {
        const direct = index.get(key.toLowerCase());
        if (direct) return direct;
    }

    // fallback: fuzzy contains
    for (const [key, value] of index) {
        if (candidates.some((candidate) => key.includes(candidate.toLowerCase()))) {
            return value;
        }
    }

    return undefined;
}

export function pickByAlias(
    index: Map<string, CustomAttribute>,
    aliasKey: keyof typeof ATTRIBUTE_NAME_ALIASES
): string | undefined {
    return pickAttribute(index, ATTRIBUTE_NAME_ALIASES[aliasKey])?.value;
}

export function buildTaskObjectsTable(taskObjects: TaskObject[]): DetailTableModel {
    const rows: DetailTableRow[] = taskObjects.map((obj, idx) => ({
        id: `${obj.objectId}-${idx}`,
        values: {
            type: normalizeDisplayValue(obj.type),
            objectId: normalizeDisplayValue(obj.objectId),
            name: normalizeDisplayValue(obj.name),
            url: normalizeDisplayValue(obj.url),
        },
    }));

    return {
        id: 'task-objects',
        title: 'Related Objects',
        columns: [
            { key: 'type', label: 'Type' },
            { key: 'objectId', label: 'Object ID' },
            { key: 'name', label: 'Name' },
            { key: 'url', label: 'URL' },
        ],
        rows,
        emptyMessage: 'No related objects',
    };
}

export function buildCustomAttributesTable(attributes: CustomAttribute[]): DetailTableModel {
    const rows: DetailTableRow[] = attributes.map((attr) => ({
        id: attr.name,
        values: {
            label: normalizeDisplayValue(attr.label),
            value: normalizeDisplayValue(attr.value),
            type: normalizeDisplayValue(attr.type),
            technicalName: normalizeDisplayValue(attr.name),
        },
    }));

    return {
        id: 'custom-attributes',
        title: 'Custom Attributes',
        columns: [
            { key: 'label', label: 'Label' },
            { key: 'value', label: 'Value' },
            { key: 'type', label: 'Type' },
            { key: 'technicalName', label: 'Name' },
        ],
        rows,
        emptyMessage: 'No custom attributes',
    };
}

export function formatFileSize(size?: number): string {
    if (size == null || Number.isNaN(size)) return EMPTY_VALUE;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildDefaultBusinessModel(detail: TaskDetail) {
    const attrIndex = createAttributeIndex(detail.customAttributes);
    const businessType = detail.businessContext?.type || 'UNKNOWN';
    const documentId =
        detail.businessContext?.documentId ||
        pickByAlias(attrIndex, 'documentId') ||
        detail.taskObjects[0]?.objectId;

    return {
        title: `${businessType} Business Data`,
        subtitle: documentId ? `Document ${documentId}` : 'General task details',
        cards: [
            {
                id: 'document-summary',
                title: 'Document Summary',
                fields: [
                    field('Document Type', businessType),
                    field('Document ID', documentId),
                    field('Supplier', pickByAlias(attrIndex, 'supplier')),
                    field('Net Value', pickByAlias(attrIndex, 'netValue')),
                    field('Currency', pickByAlias(attrIndex, 'currency')),
                ],
            },
            {
                id: 'workflow-summary',
                title: 'Workflow Summary',
                fields: [
                    field('Scenario', detail.task.scenarioId),
                    field('Task Definition', detail.task.taskDefinitionName || detail.task.taskDefinitionId),
                    field('Status', detail.task.status),
                    field('Priority', detail.task.priority),
                    field('Escalated', detail.task.isEscalated ? 'Yes' : 'No'),
                ],
            },
        ],
        tables: [
            buildCustomAttributesTable(detail.customAttributes),
            buildTaskObjectsTable(detail.taskObjects),
        ],
    };
}
