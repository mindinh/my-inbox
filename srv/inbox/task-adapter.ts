import {
    SapTaskRaw,
    SapDecisionOptionRaw,
    SapCustomAttributeRaw,
    SapCustomAttributeDefinitionRaw,
    SapDescriptionRaw,
    SapTaskObjectRaw,
    SapCommentRaw,
    SapProcessingLogRaw,
    SapWorkflowLogRaw,
    SapAttachmentRaw,
    InboxTask,
    TaskSupports,
    Decision,
    CustomAttribute,
    TaskDescription,
    TaskObject,
    TaskComment,
    ProcessingLog,
    WorkflowLog,
    TaskAttachment,
} from '../types';

/**
 * Task Adapter
 * Normalizes SAP TASKPROCESSING OData responses into clean domain models.
 * All SAP-specific field names and structures are contained here.
 */

// ─── Task List Normalization ──────────────────────────────

export function normalizeTask(raw: SapTaskRaw): InboxTask {
    return {
        instanceId: raw.InstanceID,
        sapOrigin: raw.SAP__Origin,
        title: raw.TaskTitle || '',
        status: normalizeStatus(raw.Status),
        priority: normalizePriority(raw.Priority),
        createdOn: normalizeDate(raw.CreatedOn),
        createdByName: raw.CreatedByName || undefined,
        processorName: raw.ProcessorName || undefined,
        scenarioId: raw.ScenarioID || undefined,
        taskDefinitionId: raw.TaskDefinitionID || undefined,
        taskDefinitionName: raw.TaskDefinitionName || undefined,
        startDeadline: normalizeDate(raw.StartDeadLine),
        completionDeadline: normalizeDate(raw.CompletionDeadLine),
        expiryDate: normalizeDate(raw.ExpiryDate),
        completedOn: normalizeDate(raw.CompletedOn),
        forwardedOn: normalizeDate(raw.ForwardedOn),
        isEscalated: raw.IsEscalated ?? false,
        hasComments: raw.HasComments ?? false,
        hasAttachments: raw.HasAttachments ?? false,
        guiLink: raw.GUI_Link || undefined,
        supports: normalizeSupports(raw),
    };
}

export function normalizeTasks(rawTasks: SapTaskRaw[]): InboxTask[] {
    return rawTasks.map(normalizeTask);
}

// ─── Decision Options Normalization ───────────────────────

export function normalizeDecisions(raw: SapDecisionOptionRaw[]): Decision[] {
    return raw.map((opt) => ({
        key: opt.DecisionKey,
        text: opt.DecisionText || opt.DecisionKey,
        nature: normalizeDecisionNature(opt.Nature),
        commentMandatory: opt.CommentMandatory ?? false,
        commentSupported: opt.CommentSupported ?? true, // SAP default is true
    }));
}

// ─── Description Normalization ────────────────────────────

export function normalizeDescription(raw: SapDescriptionRaw | null): TaskDescription | undefined {
    if (!raw) return undefined;

    if (raw.DescriptionAsHtml) {
        return { type: 'html', value: raw.DescriptionAsHtml };
    }
    if (raw.Description) {
        return { type: 'text', value: raw.Description };
    }
    return undefined;
}

// ─── Custom Attributes Normalization ──────────────────────

export function normalizeCustomAttributes(
    raw: SapCustomAttributeRaw[],
    definitions: SapCustomAttributeDefinitionRaw[] = []
): CustomAttribute[] {
    const definitionByName = new Map<string, SapCustomAttributeDefinitionRaw>();
    for (const def of definitions) {
        definitionByName.set(def.Name.toLowerCase(), def);
    }

    const normalized = raw.map((attr) => {
        const def = definitionByName.get(attr.Name.toLowerCase());
        return {
            item: {
                name: attr.Name,
                label: def?.Label || attr.Label || attr.Name,
                value: attr.Value || '',
                type: def?.Type || attr.Type || undefined,
            },
            rank: def?.Rank ?? Number.MAX_SAFE_INTEGER,
        };
    });

    normalized.sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name));
    return normalized.map((entry) => entry.item);
}

// ─── Task Objects Normalization ───────────────────────────

export function normalizeTaskObjects(raw: SapTaskObjectRaw[]): TaskObject[] {
    return raw.map((obj) => ({
        objectId: obj.ObjectID,
        type: obj.ObjectType || 'UNKNOWN',
        name: obj.ObjectName || undefined,
        url: obj.ObjectUrl || undefined,
        mimeType: obj.MimeType || undefined,
    }));
}

export function normalizeComments(raw: SapCommentRaw[]): TaskComment[] {
    return raw
        .map((item) => ({
            id: item.ID || '',
            createdAt: normalizeDate(item.CreatedAt),
            createdBy: item.CreatedBy || undefined,
            createdByName: item.CreatedByName || undefined,
            text: item.Text || '',
        }))
        .filter((item) => item.id || item.text);
}

export function normalizeProcessingLogs(raw: SapProcessingLogRaw[]): ProcessingLog[] {
    return raw
        .map((item) => ({
            orderId: item.OrderID,
            timestamp: normalizeDate(item.Timestamp),
            actionName: item.ActionName || undefined,
            performedBy: item.PerformedBy || undefined,
            performedByName: item.PerformedByName || undefined,
            comments: item.Comments || undefined,
            taskStatus: item.TaskStatus || undefined,
        }))
        .sort((a, b) => {
            const aTime = a.timestamp ? Date.parse(a.timestamp) : 0;
            const bTime = b.timestamp ? Date.parse(b.timestamp) : 0;
            return bTime - aTime;
        });
}

export function normalizeWorkflowLogs(raw: SapWorkflowLogRaw[]): WorkflowLog[] {
    const logs = raw.map((item, index) => {
        const typed = item as Record<string, unknown>;
        const idCandidate = asString(typed.ID) || asString(typed.OrderID) || String(index + 1);
        const timestamp = normalizeDate(asString(typed.Timestamp) || asString(typed.CreatedAt));
        const action =
            asString(typed.ActionName) ||
            asString(typed.EventName) ||
            asString(typed.TaskStatus) ||
            undefined;
        const user = asString(typed.PerformedBy) || asString(typed.User) || undefined;
        const userName = asString(typed.PerformedByName) || asString(typed.UserName) || undefined;
        const details =
            asString(typed.Comments) ||
            asString(typed.Text) ||
            asString(typed.Description) ||
            undefined;

        return {
            id: idCandidate,
            timestamp,
            action,
            user,
            userName,
            details,
            raw: typed,
        };
    });

    return logs.sort((a, b) => {
        const aTime = a.timestamp ? Date.parse(a.timestamp) : 0;
        const bTime = b.timestamp ? Date.parse(b.timestamp) : 0;
        return bTime - aTime;
    });
}

export function normalizeAttachments(raw: SapAttachmentRaw[]): TaskAttachment[] {
    return raw.map((item) => {
        const rawMime = item.mime_type || undefined;
        const rawFileName = item.FileName || undefined;
        // SAP often returns application/octet-stream; try to infer from extension
        const mimeType = (rawMime === 'application/octet-stream' && rawFileName)
            ? (inferMimeFromFileName(rawFileName) || rawMime)
            : rawMime;
        return {
            id: item.ID,
            fileName: cleanDuplicateExt(rawFileName),
            fileDisplayName: cleanDuplicateExt(item.FileDisplayName) || undefined,
            mimeType,
            fileSize: item.FileSize,
            link: item.Link || undefined,
            linkDisplayName: item.LinkDisplayName || undefined,
            createdAt: normalizeDate(item.CreatedAt),
            createdBy: item.CreatedBy || undefined,
            createdByName: item.CreatedByName || undefined,
        };
    });
}

function inferMimeFromFileName(fileName: string): string | undefined {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return undefined;
    const map: Record<string, string> = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        txt: 'text/plain',
        csv: 'text/csv',
    };
    return map[ext];
}

function cleanDuplicateExt(name?: string): string | undefined {
    if (!name) return undefined;
    const match = name.match(/^(.+)\.([^.]+)\.([^.]+)$/);
    if (match && match[2].toLowerCase() === match[3].toLowerCase()) {
        return `${match[1]}.${match[3]}`;
    }
    return name;
}

// ─── Helpers ──────────────────────────────────────────────

function normalizeSupports(raw: SapTaskRaw): TaskSupports {
    return {
        claim: raw.SupportsClaim ?? false,
        release: raw.SupportsRelease ?? false,
        forward: raw.SupportsForward ?? false,
        comments: raw.SupportsComments ?? true, // default true — most tasks support comments
    };
}

function normalizeStatus(status: string): string {
    // SAP statuses: READY, RESERVED, IN_PROGRESS, EXECUTED, COMPLETED, FOR_RESUBMISSION
    // Keep as-is but uppercase for consistency
    return (status || 'UNKNOWN').toUpperCase();
}

function normalizePriority(priority: string): string {
    // SAP priorities: VERY_HIGH, HIGH, MEDIUM, LOW
    const map: Record<string, string> = {
        '1': 'VERY_HIGH',
        '2': 'HIGH',
        '3': 'MEDIUM',
        '4': 'LOW',
        VERY_HIGH: 'VERY_HIGH',
        HIGH: 'HIGH',
        MEDIUM: 'MEDIUM',
        LOW: 'LOW',
    };
    return map[(priority || '').toUpperCase()] || priority || 'MEDIUM';
}

function normalizeDecisionNature(nature?: string): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
    if (!nature) return 'NEUTRAL';
    const upper = nature.toUpperCase();
    if (upper.includes('POSITIVE') || upper.includes('APPROVE')) return 'POSITIVE';
    if (upper.includes('NEGATIVE') || upper.includes('REJECT')) return 'NEGATIVE';
    return 'NEUTRAL';
}

/**
 * Normalize SAP OData date formats.
 * SAP returns dates as: "/Date(1696118400000)/" or ISO strings.
 */
function normalizeDate(dateValue: string | undefined): string | undefined {
    if (!dateValue) return undefined;

    // Handle /Date(milliseconds)/ format
    const msMatch = dateValue.match(/\/Date\((\d+)\)\//);
    if (msMatch) {
        return new Date(parseInt(msMatch[1], 10)).toISOString();
    }

    // Already ISO or standard format
    try {
        return new Date(dateValue).toISOString();
    } catch {
        return dateValue;
    }
}

function asString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return undefined;
}
