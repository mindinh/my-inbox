import {
    SapCustomAttributeRaw,
    SapDecisionOptionRaw,
    SapDescriptionRaw,
    SapTaskObjectRaw,
} from '../../types';

type HeaderValue = string | string[] | undefined;
type HeaderMap = Record<string, HeaderValue>;

interface BatchGetSpec {
    key: string;
    url: string;
    kind: 'single' | 'collection';
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
    decisionOptions: SapDecisionOptionRaw[];
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
    let decisionOptions: SapDecisionOptionRaw[] = [];

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
        decisionOptions,
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
        lines.push('Accept: application/json');
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

// ─── Overview-only Batch ──────────────────────────────────
// Lightweight batch that fetches only the three segments needed for
// the first "Overview" render: Description, CustomAttributeData,
// and DecisionOptions. Excludes heavy TaskObjects and Attachments
// to cut total SAP Gateway processing time roughly in half.

export interface TaskOverviewBatchResult {
    description: SapDescriptionRaw | null;
    customAttributes: SapCustomAttributeRaw[];
    decisionOptions: SapDecisionOptionRaw[];
}

export async function executeTaskOverviewBatch(options: {
    instanceId: string;
    sapOrigin: string;
    sapClient: string;
    taskEntityPath: string;
    sendBatch: (payload: Buffer, boundary: string) => Promise<{ data: unknown; headers: HeaderMap }>;
    logWarning?: (message: string) => void;
}): Promise<TaskOverviewBatchResult> {
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
            key: 'DecisionOptions',
            url: `DecisionOptions?sap-client=${sapClient}&SAP__Origin='${escapedOrigin}'&InstanceID='${escapedInstanceId}'`,
            kind: 'collection',
            optional: true,
        },
    ];

    const boundary = `batch_ov_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const payload = buildBatchPayload(boundary, specs);
    const payloadBuffer = Buffer.from(payload, 'utf8');
    const response = await sendBatch(payloadBuffer, boundary);

    const responseBody = toTextResponse(response.data);
    const contentType = firstHeaderValue(response.headers, 'content-type');
    const parts = parseBatchParts(responseBody, contentType);
    if (parts.length < specs.length) {
        throw new Error(
            `Invalid $batch (overview) response for task ${instanceId}: expected ${specs.length} parts, got ${parts.length}.`
        );
    }

    let description: SapDescriptionRaw | null = null;
    let customAttributes: SapCustomAttributeRaw[] = [];
    let decisionOptions: SapDecisionOptionRaw[] = [];

    for (let i = 0; i < specs.length; i += 1) {
        const spec = specs[i];
        const part = parts[i];
        if (part.status >= 400) {
            const message = extractBatchPartMessage(part.body);
            if (!spec.optional) {
                throw new Error(`$batch (overview) part ${spec.key} failed (${part.status}): ${message}`);
            }
            if (logWarning) {
                logWarning(
                    `$batch (overview) part ${spec.key} failed for task ${instanceId} (${part.status}): ${message}`
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
        decisionOptions,
    };
}
