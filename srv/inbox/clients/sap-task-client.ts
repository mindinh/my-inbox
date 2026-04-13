import {
    SapTaskRaw,
    SapODataResponse,
    SapODataSingleResponse,
    SapDecisionOptionRaw,
    SapCustomAttributeRaw,
    SapCustomAttributeDefinitionRaw,
    SapDescriptionRaw,
    SapTaskObjectRaw,
    SapCommentRaw,
    SapProcessingLogRaw,
    SapWorkflowLogRaw,
    SapAttachmentRaw,
} from '../../types';
import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { executeTaskDetailBatch } from '../helpers/task-detail-batch';
import { resolveAuthRuntimeConfig } from '../../core/config/auth-mode';

/**
 * ISapTaskClient — Interface for SAP TASKPROCESSING OData calls.
 * Implementations: real SAP client (production) + mock client (dev).
 */
export interface ISapTaskClient {
    /** Fetch tasks for a given SAP user with optional pagination */
    fetchTasks(sapUser: string, userJwt?: string, pagination?: { top?: number; skip?: number }): Promise<{ results: SapTaskRaw[]; totalCount: number }>;

    /** Fetch approved tasks for a given SAP user with optional pagination */
    fetchApprovedTasks(sapUser: string, userJwt?: string, pagination?: { top?: number; skip?: number }): Promise<{ results: SapTaskRaw[]; totalCount: number }>;

    /** Fetch a single task by InstanceID */
    fetchTaskDetail(sapUser: string, instanceId: string, userJwt?: string): Promise<SapTaskRaw>;

    /** Fetch task detail with all supported navigation properties expanded */
    fetchTaskDetailBundle(sapUser: string, instanceId: string, userJwt?: string, hints?: { sapOrigin?: string }): Promise<SapTaskRaw>;

    /** Fetch decision options for a task */
    fetchDecisionOptions(sapUser: string, instanceId: string, userJwt?: string): Promise<SapDecisionOptionRaw[]>;

    /** Fetch task description */
    fetchDescription(sapUser: string, instanceId: string, userJwt?: string): Promise<SapDescriptionRaw | null>;

    /** Fetch custom attribute data */
    fetchCustomAttributes(sapUser: string, instanceId: string, userJwt?: string): Promise<SapCustomAttributeRaw[]>;

    /** Fetch custom attribute definition metadata (labels/types/rank) */
    fetchCustomAttributeDefinitions(
        sapUser: string,
        taskDefinitionId: string,
        userJwt?: string
    ): Promise<SapCustomAttributeDefinitionRaw[]>;

    /** Fetch task objects / attachments */
    fetchTaskObjects(sapUser: string, instanceId: string, userJwt?: string): Promise<SapTaskObjectRaw[]>;

    /** Fetch comments */
    fetchComments(sapUser: string, instanceId: string, userJwt?: string): Promise<SapCommentRaw[]>;

    /** Fetch processing logs */
    fetchProcessingLogs(sapUser: string, instanceId: string, userJwt?: string): Promise<SapProcessingLogRaw[]>;

    /** Fetch workflow logs */
    fetchWorkflowLogs(sapUser: string, instanceId: string, userJwt?: string): Promise<SapWorkflowLogRaw[]>;

    /** Fetch attachments */
    fetchAttachments(sapUser: string, instanceId: string, userJwt?: string): Promise<SapAttachmentRaw[]>;

    /** Execute a decision (approve/reject/etc.) */
    executeDecision(
        sapUser: string,
        instanceId: string,
        decisionKey: string,
        comment?: string,
        userJwt?: string
    ): Promise<void>;

    /** Forward a task to another user */
    forwardTask(sapUser: string, instanceId: string, forwardTo: string, userJwt?: string): Promise<void>;

    /** Add a comment to a task (via OData $batch AddComment FunctionImport) */
    addComment(sapUser: string, instanceId: string, text: string, userJwt?: string): Promise<SapCommentRaw>;

    /** Upload an attachment to a task */
    addAttachment(
        sapUser: string,
        instanceId: string,
        fileName: string,
        mimeType: string,
        buffer: Buffer,
        userJwt?: string,
        sapOrigin?: string
    ): Promise<SapAttachmentRaw>;

    /** Fetch attachment binary content */
    fetchAttachmentContent(
        sapUser: string,
        instanceId: string,
        attachmentId: string,
        origin: string,
        attachmentMetadataUri?: string,
        userJwt?: string
    ): Promise<{ data: Buffer; contentType: string }>;
}

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

type HeaderValue = string | string[] | undefined;
type HeaderMap = Record<string, HeaderValue>;
type HttpMethod = 'GET' | 'POST';
type ResponseType = 'json' | 'text' | 'arraybuffer';

/**
 * SapTaskClient — Production client calling /IWPGW/TASKPROCESSING OData service.
 *
 * Expects destination-based connectivity or direct URL+credentials via env vars:
 *   SAP_TASK_BASE_URL  — e.g. https://sap-host:port/sap/opu/odata/IWPGW/TASKPROCESSING;mo
 *   SAP_TASK_CLIENT    — SAP client number (e.g. 400)
 *   SAP_TASK_USER      — Technical user (Phase 1 only; Phase 2 uses propagation)
 *   SAP_TASK_PASSWORD  — Technical password
 */
export class SapTaskClient implements ISapTaskClient {
    private http?: AxiosInstance;
    private readonly baseUrl: string;
    private readonly useDestination: boolean;
    private readonly destinationName: string;
    private readonly odataPath: string;
    private readonly sapOrigin: string;
    private readonly hardcodedSapUser?: string;
    private readonly sendSapUserHeader: boolean;

    constructor() {
        const runtimeAuth = resolveAuthRuntimeConfig();
        this.useDestination = runtimeAuth.useDestination;
        this.destinationName = runtimeAuth.destinationName;
        this.odataPath =
            process.env.SAP_TASK_ODATA_PATH ||
            '/sap/opu/odata/IWPGW/TASKPROCESSING;v=2';
        this.sapOrigin = process.env.SAP_TASK_ORIGIN || 'LOCAL';
        this.hardcodedSapUser = process.env.SAP_TASK_HARDCODED_USER?.trim().toUpperCase();
        const explicitUserHeader = process.env.SAP_SEND_USER_HEADER;
        this.sendSapUserHeader =
            explicitUserHeader != null ? explicitUserHeader === 'true' : !this.useDestination;

        if (this.useDestination) {
            console.log(
                `[SapTaskClient] Destination mode enabled (destination=${this.destinationName}, path=${this.odataPath})`
            );
            console.log(
                `[SapTaskClient] sap-user header ${this.sendSapUserHeader ? 'ENABLED' : 'DISABLED'}`
            );
            this.baseUrl = '';
            return;
        }

        this.baseUrl = process.env.SAP_TASK_BASE_URL || '';
        if (!this.baseUrl) {
            console.warn(
                '[SapTaskClient] SAP_TASK_BASE_URL not set (and SAP_USE_DESTINATION=false). SAP calls will fail.'
            );
        }

        const config: AxiosRequestConfig = {
            baseURL: this.baseUrl,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'sap-client': process.env.SAP_TASK_CLIENT || '100',
            },
            timeout: 30_000,
        };

        // Phase 1: technical user auth
        if (process.env.SAP_TASK_USER && process.env.SAP_TASK_PASSWORD) {
            config.auth = {
                username: process.env.SAP_TASK_USER,
                password: process.env.SAP_TASK_PASSWORD,
            };
        }

        this.http = axios.create(config);
    }

    // ─── CSRF handling ────────────────────────────────────
    private async fetchCsrfToken(
        sapUser: string,
        userJwt?: string
    ): Promise<{ token: string; cookie?: string }> {
        const response = await this.request<unknown>({
            sapUser,
            userJwt,
            method: 'GET',
            path: '/',
            headers: {
                'x-csrf-token': 'Fetch',
            },
        });

        const token = this.firstHeaderValue(response.headers, 'x-csrf-token');
        const cookie = this.toCookieHeader(response.headers['set-cookie']);

        return { token: token || '', cookie };
    }

    private async postWithCsrf(
        sapUser: string,
        path: string,
        data: Record<string, unknown> = {},
        userJwt?: string
    ): Promise<void> {
        const { token, cookie } = await this.fetchCsrfToken(sapUser, userJwt);
        const headers: Record<string, string> = {
            'x-csrf-token': token,
        };
        if (cookie) {
            headers.Cookie = cookie;
        }

        await this.request<unknown>({
            sapUser,
            userJwt,
            method: 'POST',
            path,
            data,
            headers,
        });
    }

    // ─── Read operations ──────────────────────────────────

    async fetchTasks(sapUser: string, userJwt?: string, pagination?: { top?: number; skip?: number }): Promise<{ results: SapTaskRaw[]; totalCount: number }> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        const params: Record<string, string> = {
            $format: 'json',
            $filter: `Status eq 'READY' or Status eq 'RESERVED' or Status eq 'IN_PROGRESS'`,
            $orderby: 'CreatedOn desc',
            $inlinecount: 'allpages',
            // Do NOT $expand here — keep list call lightweight
        };
        if (pagination?.top != null) params.$top = String(pagination.top);
        if (pagination?.skip != null) params.$skip = String(pagination.skip);

        const res = await this.request<SapODataResponse<SapTaskRaw>>({
            sapUser: effectiveSapUser,
            userJwt,
            method: 'GET',
            path: '/TaskCollection',
            params,
        });

        const results = res.data.d?.results || [];
        const totalCount = parseInt(res.data.d?.__count || '0', 10) || results.length;
        return { results, totalCount };
    }

    async fetchApprovedTasks(sapUser: string, userJwt?: string, pagination?: { top?: number; skip?: number }): Promise<{ results: SapTaskRaw[]; totalCount: number }> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        const params: Record<string, string> = {
            $format: 'json',
            $filter: `Status eq 'COMPLETED' or Status eq 'FOR_RESUBMISSION'`,
            $orderby: 'CreatedOn desc',
            $inlinecount: 'allpages',
        };
        if (pagination?.top != null) params.$top = String(pagination.top);
        if (pagination?.skip != null) params.$skip = String(pagination.skip);

        const res = await this.request<SapODataResponse<SapTaskRaw>>({
            sapUser: effectiveSapUser,
            userJwt,
            method: 'GET',
            path: '/TaskCollection',
            params,
        });

        const results = res.data.d?.results || [];
        const totalCount = parseInt(res.data.d?.__count || '0', 10) || results.length;
        return { results, totalCount };
    }

    async fetchTaskDetail(
        sapUser: string,
        instanceId: string,
        userJwt?: string
    ): Promise<SapTaskRaw> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        const task = await this.fetchTaskByFilter(effectiveSapUser, instanceId, undefined, userJwt);
        if (!task) {
            throw new Error(`Task ${instanceId} not found in SAP TASKPROCESSING.`);
        }
        return task;
    }

    async fetchTaskDetailBundle(
        sapUser: string,
        instanceId: string,
        userJwt?: string,
        hints?: { sapOrigin?: string }
    ): Promise<SapTaskRaw> {
        const effectiveSapUser = this.resolveSapUser(sapUser);

        // When the caller already knows SAP__Origin (e.g. from the task list),
        // we can construct the entity key directly and skip the extra
        // fetchTaskByFilter round-trip (~500ms saving).
        let task: SapTaskRaw | null = null;
        let origin: string;
        let taskEntityPath: string;

        if (hints?.sapOrigin) {
            origin = hints.sapOrigin;
            taskEntityPath = this.taskCollectionKey(origin, instanceId);
            console.log(`[SapTaskClient] Fast path: skipping origin lookup (sapOrigin=${origin})`);
        } else {
            task = await this.fetchTaskByFilter(effectiveSapUser, instanceId, undefined, userJwt);
            if (!task) {
                throw new Error(`Task ${instanceId} not found in SAP TASKPROCESSING.`);
            }
            origin = task.SAP__Origin || this.sapOrigin;
            taskEntityPath = this.resolveTaskEntityPath(task, origin, instanceId);
        }

        const batchData = await this.fetchTaskDetailSegmentsBatch(
            effectiveSapUser,
            instanceId,
            origin,
            taskEntityPath,
            userJwt
        );

        // If we skipped the initial task fetch, synthesize a minimal task shell
        // so the caller still gets a valid SapTaskRaw back.
        if (!task) {
            task = {
                InstanceID: instanceId,
                SAP__Origin: origin,
            } as SapTaskRaw;
        }

        task.Description = batchData.description || undefined;
        task.CustomAttributeData = { results: batchData.customAttributes };
        task.TaskObjects = { results: batchData.taskObjects };
        task.Attachments = { results: batchData.attachments };
        task.DecisionOptions = { results: batchData.decisionOptions };
        if ((batchData.attachments?.length || 0) > 0) {
            task.HasAttachments = true;
        }

        return task;
    }

    async fetchDecisionOptions(
        sapUser: string,
        instanceId: string,
        userJwt?: string
    ): Promise<SapDecisionOptionRaw[]> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        const origin = await this.resolveOriginForTask(effectiveSapUser, instanceId, userJwt);
        try {
            const res = await this.request<SapODataResponse<SapDecisionOptionRaw>>({
                sapUser: effectiveSapUser,
                userJwt,
                method: 'GET',
                path: '/DecisionOptions',
                params: {
                    $format: 'json',
                    SAP__Origin: `'${this.escapeODataString(origin)}'`,
                    InstanceID: `'${this.escapeODataString(instanceId)}'`,
                },
            });
            return res.data.d?.results || [];
        } catch (error) {
            if (this.isMissingSegmentError(error, 'DecisionOptions') || this.isMissingFunctionError(error, 'DecisionOptions')) {
                console.warn(
                    '[SapTaskClient] DecisionOptions API not available in this SAP service. Falling back to empty decisions.'
                );
                return [];
            }
            throw error;
        }
    }

    async fetchDescription(
        sapUser: string,
        instanceId: string,
        userJwt?: string
    ): Promise<SapDescriptionRaw | null> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        try {
            return await this.fetchTaskNavigationSingle<SapDescriptionRaw>(
                effectiveSapUser,
                instanceId,
                'Description',
                userJwt
            );
        } catch (error) {
            if (this.isMissingSegmentError(error, 'Description')) {
                return null;
            }
            throw error;
        }
    }

    async fetchCustomAttributes(
        sapUser: string,
        instanceId: string,
        userJwt?: string
    ): Promise<SapCustomAttributeRaw[]> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        try {
            return await this.fetchTaskNavigationCollection<SapCustomAttributeRaw>(
                effectiveSapUser,
                instanceId,
                'CustomAttributeData',
                userJwt
            );
        } catch (error) {
            if (this.isMissingSegmentError(error, 'CustomAttributeData')) {
                return [];
            }
            throw error;
        }
    }

    async fetchCustomAttributeDefinitions(
        sapUser: string,
        taskDefinitionId: string,
        userJwt?: string
    ): Promise<SapCustomAttributeDefinitionRaw[]> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        if (!taskDefinitionId) return [];

        try {
            const res = await this.request<SapODataResponse<SapCustomAttributeDefinitionRaw>>({
                sapUser: effectiveSapUser,
                userJwt,
                method: 'GET',
                path: `/TaskDefinitionCollection(TaskDefinitionID='${encodeURIComponent(taskDefinitionId)}')/CustomAttributeDefinitionData`,
                params: { $format: 'json' },
            });
            return res.data.d?.results || [];
        } catch (error) {
            if (this.isMissingSegmentError(error, 'CustomAttributeDefinitionData')) {
                return [];
            }
            throw error;
        }
    }

    async fetchTaskObjects(
        sapUser: string,
        instanceId: string,
        userJwt?: string
    ): Promise<SapTaskObjectRaw[]> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        try {
            return await this.fetchTaskNavigationCollection<SapTaskObjectRaw>(
                effectiveSapUser,
                instanceId,
                'TaskObjects',
                userJwt
            );
        } catch (error) {
            if (this.isMissingSegmentError(error, 'TaskObjects')) {
                return [];
            }
            if (this.isRuntimeDumpCode(error, 'OBJECTS_TABLES_NOT_COMPATIBLE')) {
                console.warn(
                    `[SapTaskClient] TaskObjects failed with OBJECTS_TABLES_NOT_COMPATIBLE for task ${instanceId}. Falling back to empty task objects.`
                );
                return [];
            }
            throw error;
        }
    }

    async fetchComments(
        sapUser: string,
        instanceId: string,
        userJwt?: string
    ): Promise<SapCommentRaw[]> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        try {
            return await this.fetchTaskNavigationCollection<SapCommentRaw>(
                effectiveSapUser,
                instanceId,
                'Comments',
                userJwt
            );
        } catch (error) {
            if (this.isMissingSegmentError(error, 'Comments')) {
                return [];
            }
            throw error;
        }
    }

    async fetchProcessingLogs(
        sapUser: string,
        instanceId: string,
        userJwt?: string
    ): Promise<SapProcessingLogRaw[]> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        try {
            return await this.fetchTaskNavigationCollection<SapProcessingLogRaw>(
                effectiveSapUser,
                instanceId,
                'ProcessingLogs',
                userJwt
            );
        } catch (error) {
            if (this.isMissingSegmentError(error, 'ProcessingLogs')) {
                return [];
            }
            return [];
        }
    }

    async fetchWorkflowLogs(
        sapUser: string,
        instanceId: string,
        userJwt?: string
    ): Promise<SapWorkflowLogRaw[]> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        try {
            return await this.fetchTaskNavigationCollection<SapWorkflowLogRaw>(
                effectiveSapUser,
                instanceId,
                'WorkflowLogs',
                userJwt
            );
        } catch (error) {
            if (this.isMissingSegmentError(error, 'WorkflowLogs')) {
                return [];
            }
            return [];
        }
    }

    async fetchAttachments(
        sapUser: string,
        instanceId: string,
        userJwt?: string
    ): Promise<SapAttachmentRaw[]> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        try {
            return await this.fetchTaskNavigationCollection<SapAttachmentRaw>(
                effectiveSapUser,
                instanceId,
                'Attachments',
                userJwt
            );
        } catch (error) {
            if (this.isMissingSegmentError(error, 'Attachments')) {
                return [];
            }
            throw error;
        }
    }

    // ─── Write operations ─────────────────────────────────

    private async fetchTaskDetailSegmentsBatch(
        sapUser: string,
        instanceId: string,
        sapOrigin: string,
        taskEntityPath: string,
        userJwt?: string
    ): Promise<{
        description: SapDescriptionRaw | null;
        customAttributes: SapCustomAttributeRaw[];
        taskObjects: SapTaskObjectRaw[];
        attachments: SapAttachmentRaw[];
        decisionOptions: SapDecisionOptionRaw[];
    }> {
        const sapClient = process.env.SAP_TASK_CLIENT || '400';
        return executeTaskDetailBatch({
            instanceId,
            sapOrigin,
            sapClient,
            taskEntityPath,
            sendBatch: async (payload, boundary) => {
                const response = await this.request<string>({
                    sapUser,
                    userJwt,
                    method: 'POST',
                    path: '/$batch',
                    data: payload,
                    headers: {
                        Accept: 'multipart/mixed',
                        'Content-Type': `multipart/mixed; boundary=${boundary}`,
                        'Content-Length': String(payload.byteLength),
                    },
                    responseType: 'text',
                    appendSapClient: false,
                });
                return { data: response.data, headers: response.headers };
            },
            logWarning: (message) => console.warn(`[SapTaskClient] ${message}`),
        });
    }

    async executeDecision(
        sapUser: string,
        instanceId: string,
        decisionKey: string,
        comment?: string,
        userJwt?: string
    ): Promise<void> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        const origin = await this.resolveOriginForTask(effectiveSapUser, instanceId, userJwt);
        // SAP uses a function import for decisions
        const url = `/Decision?InstanceID='${encodeURIComponent(instanceId)}'&SAP__Origin='${encodeURIComponent(origin)}'&DecisionKey='${encodeURIComponent(decisionKey)}'`;
        const { token, cookie } = await this.fetchCsrfToken(effectiveSapUser, userJwt);

        const headers: Record<string, string> = {
            'x-csrf-token': token,
        };
        if (cookie) {
            headers.Cookie = cookie;
        }

        const data: Record<string, unknown> = {};
        if (comment) {
            data.Comments = comment;
        }

        await this.request<unknown>({
            sapUser: effectiveSapUser,
            userJwt,
            method: 'POST',
            path: url,
            data,
            headers,
        });
    }

    async forwardTask(
        sapUser: string,
        instanceId: string,
        forwardTo: string,
        userJwt?: string
    ): Promise<void> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        const origin = await this.resolveOriginForTask(effectiveSapUser, instanceId, userJwt);
        const url = `/Forward?InstanceID='${encodeURIComponent(instanceId)}'&SAP__Origin='${encodeURIComponent(origin)}'&ForwardTo='${encodeURIComponent(forwardTo)}'`;
        await this.postWithCsrf(effectiveSapUser, url, {}, userJwt);
    }

    // ─── Comment & Attachment operations ──────────────────

    async addComment(
        sapUser: string,
        instanceId: string,
        text: string,
        userJwt?: string
    ): Promise<SapCommentRaw> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        const origin = await this.resolveOriginForTask(effectiveSapUser, instanceId, userJwt);
        const { token, cookie } = await this.fetchCsrfToken(effectiveSapUser, userJwt);
        const sapClient = process.env.SAP_TASK_CLIENT || '400';

        // Build the $batch multipart payload for AddComment FunctionImport
        const batchBoundary = `batch_comment_${Date.now()}`;
        const changesetBoundary = `changeset_comment_${Date.now()}`;
        const encodedText = encodeURIComponent(text).replace(/'/g, "''");

        const innerRequest = [
            `POST AddComment?sap-client=${sapClient}&SAP__Origin='${this.escapeODataString(origin)}'&InstanceID='${this.escapeODataString(instanceId)}'&Text='${encodedText}' HTTP/1.1`,
            `Content-Type: application/json`,
            `Accept: application/json`,
            ``,
            `{}`,
        ].join('\r\n');

        const changeset = [
            `--${changesetBoundary}`,
            `Content-Type: application/http`,
            `Content-Transfer-Encoding: binary`,
            ``,
            innerRequest,
            `--${changesetBoundary}--`,
        ].join('\r\n');

        const batchBody = [
            `--${batchBoundary}`,
            `Content-Type: multipart/mixed; boundary=${changesetBoundary}`,
            ``,
            changeset,
            `--${batchBoundary}--`,
        ].join('\r\n');

        const payload = Buffer.from(batchBody, 'utf-8');

        const headers: Record<string, string> = {
            Accept: 'multipart/mixed',
            'Content-Type': `multipart/mixed; boundary=${batchBoundary}`,
            'Content-Length': String(payload.byteLength),
            'x-csrf-token': token,
        };
        if (cookie) {
            headers.Cookie = cookie;
        }

        const response = await this.request<string>({
            sapUser: effectiveSapUser,
            userJwt,
            method: 'POST',
            path: '/$batch',
            data: payload,
            headers,
            responseType: 'text',
            appendSapClient: false,
        });

        // Parse the $batch response to extract the created comment
        const commentData = this.parseAddCommentBatchResponse(response.data, text, effectiveSapUser);
        return commentData;
    }

    private parseAddCommentBatchResponse(
        batchResponseBody: string,
        originalText: string,
        sapUser: string
    ): SapCommentRaw {
        // Try to extract JSON from the batch response
        const jsonMatch = batchResponseBody.match(/\{[^{}]*"ID"[^{}]*\}/s);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    ID: parsed.ID || parsed.id || `comment-${Date.now()}`,
                    Text: parsed.Text || parsed.text || originalText,
                    CreatedAt: parsed.CreatedAt || parsed.CreatedOn || new Date().toISOString(),
                    CreatedBy: parsed.CreatedBy || sapUser,
                    CreatedByName: parsed.CreatedByName,
                };
            } catch {
                // Fall through to fallback
            }
        }

        // Check for HTTP error in batch response
        const statusMatch = batchResponseBody.match(/HTTP\/1\.1\s+(\d+)/);
        if (statusMatch) {
            const status = parseInt(statusMatch[1], 10);
            if (status >= 400) {
                const errorMsg = this.extractSapMessage(batchResponseBody) || `Batch sub-request failed with status ${status}`;
                throw new Error(errorMsg);
            }
        }

        // Fallback: assume success if no error detected
        console.warn('[SapTaskClient] Could not parse AddComment response body; returning synthetic comment.');
        return {
            ID: `comment-${Date.now()}`,
            Text: originalText,
            CreatedAt: new Date().toISOString(),
            CreatedBy: sapUser,
        };
    }

    async addAttachment(
        sapUser: string,
        instanceId: string,
        fileName: string,
        mimeType: string,
        buffer: Buffer,
        userJwt?: string,
        sapOrigin?: string
    ): Promise<SapAttachmentRaw> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        let origin = sapOrigin;
        let taskEntityPath = '';

        if (!origin) {
            const task = await this.fetchTaskByFilter(effectiveSapUser, instanceId, undefined, userJwt);
            if (!task) {
                throw new Error(`Task ${instanceId} not found in SAP TASKPROCESSING.`);
            }
            origin = task.SAP__Origin || this.sapOrigin;
            taskEntityPath = this.resolveTaskEntityPath(task, origin, instanceId);
        } else {
            taskEntityPath = `TaskCollection(SAP__Origin='${this.escapeODataString(origin)}',InstanceID='${this.escapeODataString(instanceId)}')`;
        }
        const { token, cookie } = await this.fetchCsrfToken(effectiveSapUser, userJwt);

        const headers: Record<string, string> = {
            'x-csrf-token': token,
            'Content-Type': mimeType,
            Accept: 'application/json',
            Slug: encodeURIComponent(fileName),
        };
        if (cookie) {
            headers.Cookie = cookie;
        }

        const response = await this.request<{ d: SapAttachmentRaw }>({
            sapUser: effectiveSapUser,
            userJwt,
            method: 'POST',
            path: `/${taskEntityPath}/Attachments`,
            data: buffer,
            headers,
        });

        return response.data.d;
    }

    async fetchAttachmentContent(
        sapUser: string,
        instanceId: string,
        attachmentId: string,
        origin: string,
        attachmentMetadataUri?: string,
        userJwt?: string
    ): Promise<{ data: Buffer; contentType: string }> {
        const effectiveSapUser = this.resolveSapUser(sapUser);
        const escapedOrigin = this.escapeODataString(origin);
        const escapedInstanceId = this.escapeODataString(instanceId);
        const normalizedAttachmentId = this.decodeURIComponentSafeDeep(attachmentId);
        // The attachment ID may contain special OData chars like / and :
        const escapedAttachmentId = this.escapeODataString(normalizedAttachmentId);
        const fallbackPath = `/AttachmentCollection(SAP__Origin='${escapedOrigin}',InstanceID='${escapedInstanceId}',ID='${escapedAttachmentId}')/$value`;
        const path = this.resolveAttachmentValuePath(attachmentMetadataUri, fallbackPath);

        const response = await this.request<Buffer>({
            sapUser: effectiveSapUser,
            userJwt,
            method: 'GET',
            path,
            headers: {
                Accept: '*/*',
            },
            responseType: 'arraybuffer',
        });

        const contentType =
            this.firstHeaderValue(response.headers, 'content-type') || 'application/octet-stream';

        return {
            data: Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data as unknown as ArrayBuffer),
            contentType,
        };
    }

    // ─── Helpers ──────────────────────────────────────────

    /**
     * In Phase 1 with technical user auth, we pass the target SAP user
     * as a custom header so the gateway knows who the "real" user is.
     * In Phase 2 with principal propagation, this header is not needed.
     */
    private resolveSapUser(sapUser: string): string {
        return this.hardcodedSapUser || sapUser;
    }

    private userHeaders(sapUser: string): Record<string, string> {
        const headers: Record<string, string> = {
            'sap-client': process.env.SAP_TASK_CLIENT || '400',
        };
        if (this.sendSapUserHeader && sapUser) {
            headers['sap-user'] = sapUser;
        }
        return headers;
    }

    private async request<T>(options: {
        sapUser: string;
        userJwt?: string;
        method: HttpMethod;
        path: string;
        params?: Record<string, string>;
        data?: unknown;
        headers?: Record<string, string>;
        responseType?: ResponseType;
        appendSapClient?: boolean;
    }): Promise<{ data: T; headers: HeaderMap }> {
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...this.userHeaders(options.sapUser),
            ...(options.headers || {}),
        };
        const queryParams =
            options.appendSapClient === false
                ? { ...(options.params || {}) }
                : this.withSapClientParam(options.params);
        const requestUrl = this.appendQuery(
            this.toDestinationUrl(options.path),
            queryParams
        );

        if (this.useDestination) {
            const destination =
                options.userJwt && options.userJwt.trim()
                    ? { destinationName: this.destinationName, jwt: options.userJwt }
                    : { destinationName: this.destinationName };
            const response = await executeHttpRequest(
                destination,
                {
                    method: options.method,
                    url: requestUrl,
                    data: options.data,
                    headers,
                    responseType: options.responseType,
                }
            );

            return {
                data: response.data as T,
                headers: this.normalizeHeaders(response.headers),
            };
        }

        if (!this.http) {
            throw new Error(
                'SAP HTTP client is not initialized. Either configure destination or SAP_TASK_BASE_URL.'
            );
        }

        const response = await this.http.request<T>({
            method: options.method,
            url: requestUrl,
            data: options.data,
            headers,
            responseType: options.responseType,
        });

        return {
            data: response.data,
            headers: this.normalizeHeaders(response.headers),
        };
    }

    private toDestinationUrl(path: string): string {
        if (!path || path === '/') {
            return `${this.odataPath}/`;
        }

        if (path.startsWith('/')) {
            return `${this.odataPath}${path}`;
        }

        return `${this.odataPath}/${path}`;
    }

    private async fetchTaskByFilter(
        sapUser: string,
        instanceId: string,
        expand?: string,
        userJwt?: string
    ): Promise<SapTaskRaw | null> {
        const params: Record<string, string> = {
            $format: 'json',
            $top: '1',
            $filter: `InstanceID eq '${this.escapeODataString(instanceId)}'`,
        };

        if (expand) {
            params.$expand = expand;
        }

        const res = await this.request<SapODataResponse<SapTaskRaw>>({
            sapUser,
            userJwt,
            method: 'GET',
            path: '/TaskCollection',
            params,
        });

        const rows = res.data.d?.results || [];
        return rows.length > 0 ? rows[0] : null;
    }

    private async fetchTaskNavigationCollection<T>(
        sapUser: string,
        instanceId: string,
        navigationPath: string,
        userJwt?: string
    ): Promise<T[]> {
        const task = await this.fetchTaskByFilter(sapUser, instanceId, undefined, userJwt);
        if (!task) {
            throw new Error(`Task ${instanceId} not found in SAP TASKPROCESSING.`);
        }
        const origin = task.SAP__Origin || this.sapOrigin;
        const taskEntityPath = this.resolveTaskEntityPath(task, origin, instanceId);
        const res = await this.request<SapODataResponse<T>>({
            sapUser,
            userJwt,
            method: 'GET',
            path: `/${taskEntityPath}/${navigationPath}`,
            params: {
                $format: 'json',
            },
        });
        return res.data.d?.results || [];
    }

    private async fetchTaskNavigationSingle<T>(
        sapUser: string,
        instanceId: string,
        navigationPath: string,
        userJwt?: string
    ): Promise<T | null> {
        const task = await this.fetchTaskByFilter(sapUser, instanceId, undefined, userJwt);
        if (!task) {
            throw new Error(`Task ${instanceId} not found in SAP TASKPROCESSING.`);
        }
        const origin = task.SAP__Origin || this.sapOrigin;
        const taskEntityPath = this.resolveTaskEntityPath(task, origin, instanceId);
        const res = await this.request<SapODataSingleResponse<T>>({
            sapUser,
            userJwt,
            method: 'GET',
            path: `/${taskEntityPath}/${navigationPath}`,
            params: {
                $format: 'json',
            },
        });
        return res.data.d || null;
    }

    private async resolveOriginForTask(
        sapUser: string,
        instanceId: string,
        userJwt?: string
    ): Promise<string> {
        const task = await this.fetchTaskByFilter(sapUser, instanceId, undefined, userJwt);
        return task?.SAP__Origin || this.sapOrigin;
    }

    private taskCollectionKey(sapOrigin: string, instanceId: string): string {
        const escapedOrigin = this.escapeODataString(sapOrigin);
        const escapedInstanceId = this.escapeODataString(instanceId);
        return `TaskCollection(SAP__Origin='${escapedOrigin}',InstanceID='${escapedInstanceId}')`;
    }

    private resolveTaskEntityPath(task: SapTaskRaw, sapOrigin: string, instanceId: string): string {
        const metadataUri = task.__metadata?.uri;
        if (metadataUri) {
            const uri = metadataUri.replace(/\\/g, '/');
            const marker = '/TaskCollection';
            const idx = uri.indexOf(marker);
            if (idx >= 0) {
                const tail = uri.slice(idx + 1);
                const queryIdx = tail.indexOf('?');
                const resolved = queryIdx >= 0 ? tail.slice(0, queryIdx) : tail;
                console.log(`[SapTaskClient] Using canonical task path from __metadata: ${resolved}`);
                return resolved;
            }
        }
        const fallback = this.taskCollectionKey(sapOrigin, instanceId);
        console.log(`[SapTaskClient] Using fallback task path: ${fallback}`);
        return fallback;
    }

    private escapeODataString(value: string): string {
        return value.replace(/'/g, "''");
    }

    private decodeURIComponentSafe(value: string): string {
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }

    private decodeURIComponentSafeDeep(value: string, maxRounds = 3): string {
        let current = value;
        for (let i = 0; i < maxRounds; i += 1) {
            const next = this.decodeURIComponentSafe(current);
            if (next === current) return current;
            current = next;
        }
        return current;
    }

    private resolveAttachmentValuePath(
        attachmentMetadataUri: string | undefined,
        fallbackPath: string
    ): string {
        if (!attachmentMetadataUri) return fallbackPath;

        const uri = attachmentMetadataUri.replace(/\\/g, '/');
        const marker = '/AttachmentCollection';
        const idx = uri.indexOf(marker);
        if (idx < 0) return fallbackPath;

        const tail = uri.slice(idx + 1);
        const queryIdx = tail.indexOf('?');
        const entityPath = queryIdx >= 0 ? tail.slice(0, queryIdx) : tail;
        if (!entityPath) return fallbackPath;

        return `/${entityPath}/$value`;
    }

    private appendQuery(url: string, params?: Record<string, string>): string {
        if (!params || Object.keys(params).length === 0) {
            return url;
        }

        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            search.append(key, value);
        }

        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}${search.toString()}`;
    }

    private withSapClientParam(params?: Record<string, string>): Record<string, string> {
        const merged: Record<string, string> = { ...(params || {}) };
        if (!merged['sap-client']) {
            merged['sap-client'] = process.env.SAP_TASK_CLIENT || '400';
        }
        return merged;
    }

    private isMissingSegmentError(error: unknown, segment: string): boolean {
        const err = error as Record<string, unknown> | null;
        if (!err) return false;

        const response =
            (err.response as Record<string, unknown> | undefined) ||
            ((err.cause as Record<string, unknown> | undefined)?.response as Record<string, unknown> | undefined);
        if (!response) return false;

        const status = response.status as number | undefined;
        if (status !== 404) return false;

        const message = this.extractSapMessage(response.data);
        return !!message && message.toLowerCase().includes(`segment '${segment.toLowerCase()}'`);
    }

    private isMissingFunctionError(error: unknown, functionName: string): boolean {
        const err = error as Record<string, unknown> | null;
        if (!err) return false;

        const response =
            (err.response as Record<string, unknown> | undefined) ||
            ((err.cause as Record<string, unknown> | undefined)?.response as Record<string, unknown> | undefined);
        if (!response) return false;

        const status = response.status as number | undefined;
        if (status !== 404) return false;

        const message = this.extractSapMessage(response.data)?.toLowerCase() || '';
        return message.includes(functionName.toLowerCase());
    }

    private isRuntimeDumpCode(error: unknown, dumpCode: string): boolean {
        const err = error as Record<string, unknown> | null;
        if (!err) return false;

        const response =
            (err.response as Record<string, unknown> | undefined) ||
            ((err.cause as Record<string, unknown> | undefined)?.response as Record<string, unknown> | undefined);
        if (!response) return false;

        const dataText = this.extractErrorText(response.data).toUpperCase();
        return dataText.includes(dumpCode.toUpperCase());
    }

    private extractErrorText(data: unknown): string {
        if (typeof data === 'string') return data;
        const sapMessage = this.extractSapMessage(data);
        if (sapMessage) return sapMessage;
        if (!data) return '';
        try {
            return JSON.stringify(data);
        } catch {
            return String(data);
        }
    }

    private extractSapMessage(data: unknown): string | undefined {
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

    private normalizeHeaders(headers: unknown): HeaderMap {
        if (!headers || typeof headers !== 'object') {
            return {};
        }

        const source =
            typeof (headers as { toJSON?: () => Record<string, unknown> }).toJSON === 'function'
                ? (headers as { toJSON: () => Record<string, unknown> }).toJSON()
                : (headers as Record<string, unknown>);

        const normalized: HeaderMap = {};
        for (const [key, value] of Object.entries(source)) {
            if (typeof value === 'string' || Array.isArray(value)) {
                normalized[key.toLowerCase()] = value;
            } else if (value != null) {
                normalized[key.toLowerCase()] = String(value);
            }
        }
        return normalized;
    }

    private firstHeaderValue(headers: HeaderMap, key: string): string | undefined {
        const value = headers[key.toLowerCase()];
        if (!value) return undefined;
        return Array.isArray(value) ? value[0] : value;
    }

    private toCookieHeader(value: HeaderValue): string | undefined {
        if (!value) return undefined;

        if (Array.isArray(value)) {
            return value.map((item) => item.split(';')[0]).join('; ');
        }

        return value.split(';')[0];
    }
}
