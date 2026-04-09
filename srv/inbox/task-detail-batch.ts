import {
    SapAttachmentRaw,
    SapCommentRaw,
    SapCustomAttributeRaw,
    SapDecisionOptionRaw,
    SapDescriptionRaw,
    SapProcessingLogRaw,
    SapTaskObjectRaw,
    SapWorkflowLogRaw,
} from '../types';

type HeaderValue = string | string[] | undefined;
type HeaderMap = Record<string, HeaderValue>;

interface BatchGetSpec {
    key: string;
    url: string;
    kind: 'single' | 'collection' | 'count';
    optional: boolean;
}

interface BatchPartResponse {
    status: number;
    body: string;
}

export interface TaskDetailBatchResult {
    description: SapDescriptionRaw | null;
    customAttributes: SapCustomAttributeRaw[];
    taskObjects: SapTaskObjectRaw[];
    comments: SapCommentRaw[];
    attachments: SapAttachmentRaw[];
    processingLogs: SapProcessingLogRaw[];
    workflowLogs: SapWorkflowLogRaw[];
    decisionOptions: SapDecisionOptionRaw[];
    commentsCount: number | null;
    attachmentsCount: number | null;
    taskObjectsCount: number | null;
}

export async function executeTaskDetailBatch(options: {
    instanceId: string;
    sapOrigin: string;
    sapClient: string;
    taskEntityPath: string;
    sendBatch: (payload: Buffer, boundary: string) => Promise<{ data: unknown; headers: HeaderMap }>;
    logWarning?: (message: string) => void;
}): Promise<TaskDetailBatchResult> {
    const {
        instanceId,
        sapOrigin,
        sapClient,
        taskEntityPath,
        sendBatch,
        logWarning,
    } = options;
    const escapedOrigin = escapeODataString(sapOrigin);
    const escapedInstanceId = escapeODataString(instanceId);
    const specs: BatchGetSpec[] = [
        {
            key: 'Description',
            url: `${taskEntityPath}/Description?sap-client=${sapClient}`,
            kind: 'single',
            optional: true,
        },
        {
            key: 'CustomAttributeData',
            url: `${taskEntityPath}/CustomAttributeData?sap-client=${sapClient}`,
            kind: 'collection',
            optional: true,
        },
        {
            key: 'TaskObjects',
            url: `${taskEntityPath}/TaskObjects?sap-client=${sapClient}`,
            kind: 'collection',
            optional: true,
        },
        {
            key: 'Comments',
            url: `${taskEntityPath}/Comments?sap-client=${sapClient}`,
            kind: 'collection',
            optional: true,
        },
        {
            key: 'Attachments',
            url: `${taskEntityPath}/Attachments?sap-client=${sapClient}`,
            kind: 'collection',
            optional: true,
        },
        {
            key: 'ProcessingLogs',
            url: `${taskEntityPath}/ProcessingLogs?sap-client=${sapClient}`,
            kind: 'collection',
            optional: true,
        },
        {
            key: 'WorkflowLogs',
            url: `${taskEntityPath}/WorkflowLogs?sap-client=${sapClient}`,
            kind: 'collection',
            optional: true,
        },
        {
            key: 'TaskObjectsCount',
            url: `${taskEntityPath}/TaskObjects/$count?sap-client=${sapClient}`,
            kind: 'count',
            optional: true,
        },
        {
            key: 'CommentsCount',
            url: `${taskEntityPath}/Comments/$count?sap-client=${sapClient}`,
            kind: 'count',
            optional: true,
        },
        {
            key: 'AttachmentsCount',
            url: `${taskEntityPath}/Attachments/$count?sap-client=${sapClient}`,
            kind: 'count',
            optional: true,
        },
        {
            key: 'DecisionOptions',
            url: `DecisionOptions?sap-client=${sapClient}&SAP__Origin='${escapedOrigin}'&InstanceID='${escapedInstanceId}'`,
            kind: 'collection',
            optional: true,
        },
    ];

    const boundary = `batch_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const payload = buildBatchPayload(boundary, specs);
    const payloadBuffer = Buffer.from(payload, 'utf8');
    const response = await sendBatch(payloadBuffer, boundary);

    const responseBody = toTextResponse(response.data);
    const contentType = firstHeaderValue(response.headers, 'content-type');
    const parts = parseBatchParts(responseBody, contentType);
    if (parts.length < specs.length) {
        throw new Error(
            `Invalid $batch response for task ${instanceId}: expected ${specs.length} parts, got ${parts.length}.`
        );
    }

    let description: SapDescriptionRaw | null = null;
    let customAttributes: SapCustomAttributeRaw[] = [];
    let taskObjects: SapTaskObjectRaw[] = [];
    let comments: SapCommentRaw[] = [];
    let attachments: SapAttachmentRaw[] = [];
    let processingLogs: SapProcessingLogRaw[] = [];
    let workflowLogs: SapWorkflowLogRaw[] = [];
    let decisionOptions: SapDecisionOptionRaw[] = [];
    let commentsCount: number | null = null;
    let attachmentsCount: number | null = null;
    let taskObjectsCount: number | null = null;

    for (let i = 0; i < specs.length; i += 1) {
        const spec = specs[i];
        const part = parts[i];
        if (part.status >= 400) {
            const message = extractBatchPartMessage(part.body);
            if (!spec.optional) {
                throw new Error(`$batch part ${spec.key} failed (${part.status}): ${message}`);
            }
            if (logWarning) {
                logWarning(
                    `$batch part ${spec.key} failed for task ${instanceId} (${part.status}): ${message}`
                );
            }
            continue;
        }

        switch (spec.key) {
            case 'Description':
                description = parseBatchSingle<SapDescriptionRaw>(part.body);
                break;
            case 'CustomAttributeData':
                customAttributes = parseBatchCollection<SapCustomAttributeRaw>(part.body);
                break;
            case 'TaskObjects':
                taskObjects = parseBatchCollection<SapTaskObjectRaw>(part.body);
                break;
            case 'TaskObjectsCount':
                taskObjectsCount = parseBatchCount(part.body);
                break;
            case 'Comments':
                comments = parseBatchCollection<SapCommentRaw>(part.body);
                break;
            case 'CommentsCount':
                commentsCount = parseBatchCount(part.body);
                break;
            case 'Attachments':
                attachments = parseBatchCollection<SapAttachmentRaw>(part.body);
                break;
            case 'ProcessingLogs':
                processingLogs = parseBatchCollection<SapProcessingLogRaw>(part.body);
                break;
            case 'WorkflowLogs':
                workflowLogs = parseBatchCollection<SapWorkflowLogRaw>(part.body);
                break;
            case 'AttachmentsCount':
                attachmentsCount = parseBatchCount(part.body);
                break;
            case 'DecisionOptions':
                decisionOptions = parseBatchCollection<SapDecisionOptionRaw>(part.body);
                break;
            default:
                break;
        }
    }

    return {
        description,
        customAttributes,
        taskObjects,
        comments,
        attachments,
        processingLogs,
        workflowLogs,
        decisionOptions,
        commentsCount,
        attachmentsCount,
        taskObjectsCount,
    };
}

function buildBatchPayload(boundary: string, specs: BatchGetSpec[]): string {
    const lines: string[] = [];
    for (const spec of specs) {
        lines.push(`--${boundary}`);
        lines.push('content-type: application/http');
        lines.push('content-transfer-encoding: binary');
        lines.push('');
        lines.push(`GET ${spec.url} HTTP/1.1`);
        lines.push('sap-cancel-on-close: true');
        lines.push('sap-contextid-accept: header');
        lines.push('Accept-Language: en');
        lines.push('DataServiceVersion: 2.0');
        lines.push('MaxDataServiceVersion: 2.0');
        lines.push('X-Requested-With: XMLHttpRequest');
        if (spec.kind === 'count') {
            lines.push('Accept: text/plain, */*;q=0.5');
        } else {
            lines.push('Accept: application/json');
        }
        lines.push('');
        lines.push('');
    }
    lines.push(`--${boundary}--`);
    lines.push('');
    return lines.join('\r\n');
}

function toTextResponse(data: unknown): string {
    if (typeof data === 'string') return data;
    if (Buffer.isBuffer(data)) return data.toString('utf8');
    if (data instanceof Uint8Array) return Buffer.from(data).toString('utf8');
    if (data == null) return '';
    return String(data);
}

function parseBatchParts(rawBody: string, contentType?: string): BatchPartResponse[] {
    const boundary = extractBatchBoundary(rawBody, contentType);
    if (!boundary) {
        throw new Error('Cannot determine $batch boundary from response.');
    }

    const parts = rawBody.split(`--${boundary}`);
    const parsed: BatchPartResponse[] = [];
    for (const rawPart of parts) {
        if (!rawPart || rawPart.trim() === '' || rawPart.trim() === '--') continue;
        const httpStart = rawPart.indexOf('HTTP/1.');
        if (httpStart < 0) continue;

        const httpPayload = rawPart.slice(httpStart).replace(/\r\n/g, '\n').trim();
        const [headerBlock, ...bodyBlocks] = httpPayload.split('\n\n');
        const statusMatch = headerBlock.match(/HTTP\/1\.[01]\s+(\d{3})/i);
        if (!statusMatch) continue;
        const status = Number(statusMatch[1]);
        const body = bodyBlocks.join('\n\n').trim();
        parsed.push({ status, body });
    }
    return parsed;
}

function extractBatchBoundary(rawBody: string, contentType?: string): string | null {
    const headerBoundary = contentType?.match(/boundary=\"?([^\";]+)\"?/i)?.[1];
    if (headerBoundary) return headerBoundary;

    const firstBoundary = rawBody.match(/--([^\r\n-][^\r\n]*)/);
    return firstBoundary?.[1] || null;
}

function parseBatchCollection<T>(body: string): T[] {
    const payload = parseBatchJson(body);
    if (!payload || typeof payload !== 'object') return [];
    const typed = payload as { d?: { results?: T[] } };
    return typed.d?.results || [];
}

function parseBatchSingle<T>(body: string): T | null {
    const payload = parseBatchJson(body);
    if (!payload || typeof payload !== 'object') return null;
    const typed = payload as { d?: T };
    return typed.d || null;
}

function parseBatchCount(body: string): number | null {
    if (!body) return null;
    const compact = body.replace(/\r/g, '').trim();
    const direct = compact.match(/^-?\d+$/);
    if (direct) return Number(direct[0]);

    const lines = compact.split('\n').map((line) => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        if (/^-?\d+$/.test(lines[i])) {
            return Number(lines[i]);
        }
    }
    return null;
}

function parseBatchJson(body: string): unknown {
    if (!body) return null;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start) {
        return null;
    }
    const jsonText = body.slice(start, end + 1);
    try {
        return JSON.parse(jsonText);
    } catch {
        return null;
    }
}

function extractBatchPartMessage(body: string): string {
    const json = parseBatchJson(body);
    const sapMessage = extractSapMessage(json);
    if (sapMessage) return sapMessage;
    if (!body) return 'Unknown error';
    const compact = body.replace(/\s+/g, ' ').trim();
    return compact.length > 220 ? `${compact.slice(0, 220)}...` : compact;
}

function extractSapMessage(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const err = data as {
        error?: {
            message?: { value?: string } | string;
        };
    };
    const messageNode = err.error?.message;
    if (!messageNode) return undefined;
    if (typeof messageNode === 'string') return messageNode;
    return messageNode.value;
}

function escapeODataString(value: string): string {
    return value.replace(/'/g, "''");
}

function firstHeaderValue(headers: HeaderMap, key: string): string | undefined {
    const value = headers[key.toLowerCase()];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
}
