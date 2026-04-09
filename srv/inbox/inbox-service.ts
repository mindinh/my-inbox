import {
    InboxIdentity,
    TaskListResponse,
    TaskDetailResponse,
    TaskActionResponse,
    DecisionRequest,
    InboxTask,
    TaskDetail,
    PurchaseRequisitionApprovalTreeResponse,
} from '../types';
import { ISapTaskClient, SapTaskClient } from './sap-task-client';
import { MockSapTaskClient } from './mock/mock-sap-client';
import {
    normalizeTask,
    normalizeTasks,
    normalizeDecisions,
    normalizeDescription,
    normalizeCustomAttributes,
    normalizeTaskObjects,
    normalizeComments,
    normalizeProcessingLogs,
    normalizeWorkflowLogs,
    normalizeAttachments,
} from './task-adapter';
import { resolveBusinessContext } from './business-context-resolver';
import { enrichBusinessObjectData } from './business-object-data-resolver';
import { DecisionHandler, DecisionError } from './decision-handler';
import { SapPurchaseRequisitionApprovalTreeClient } from './sap-pr-approval-tree-client';
import { MOCK_PR_APPROVAL_TREES, MOCK_PR_APPROVAL_COMMENTS } from './mock/mock-factsheet-data';

/**
 * Inbox Service — The Orchestrator
 *
 * Core BFF layer that:
 *   1. Receives identity-resolved requests from the router
 *   2. Calls SAP TASKPROCESSING via sap-task-client
 *   3. Normalizes SAP data into clean domain models
 *   4. Resolves business context (PR/PO detection)
 *   5. Validates and executes decisions
 *
 * This is the ONLY class the router talks to. All SAP complexity is hidden here.
 */

export class InboxService {
    private sapClient: ISapTaskClient;
    private decisionHandler: DecisionHandler;
    private prApprovalTreeClient: SapPurchaseRequisitionApprovalTreeClient;

    constructor() {
        this.sapClient = createSapClient();
        this.decisionHandler = new DecisionHandler(this.sapClient);
        this.prApprovalTreeClient = new SapPurchaseRequisitionApprovalTreeClient();
        console.log(
            `[InboxService] Initialized with ${this.isMockMode() ? 'MOCK' : 'REAL'} SAP client`
        );
    }

    // ─── Read Operations ──────────────────────────────────

    /**
     * Get all tasks for the given identity.
     * Returns normalized task list with business context enrichment (factsheet header data).
     */
    async getTasks(identity: InboxIdentity, pagination?: { top?: number; skip?: number }): Promise<TaskListResponse> {
        const { results: rawTasks, totalCount } = await this.sapClient.fetchTasks(identity.sapUser, identity.userJwt, pagination);
        const tasks = normalizeTasks(rawTasks);

        // Resolve business context from title parsing, then enrich with factsheet data
        // Use includeItemDetails:false to skip heavy approval tree + description fetches
        await Promise.all(tasks.map(async (task) => {
            const baseContext = resolveBusinessContext(task, [], []);
            const enrichedContext = await enrichBusinessObjectData(identity, baseContext, {
                sapOrigin: task.sapOrigin,
                includeItemDetails: false,
            });
            task.businessContext = enrichedContext;
            task.requestorName = extractRequestorName(enrichedContext) || task.requestorName;
        }));

        return {
            identity,
            items: tasks,
            total: totalCount,
        };
    }

    /**
     * Get all approved tasks for the given identity.
     * Returns normalized task list with business context enrichment (factsheet header data).
     */
    async getApprovedTasks(identity: InboxIdentity, pagination?: { top?: number; skip?: number }): Promise<TaskListResponse> {
        const { results: rawTasks, totalCount } = await this.sapClient.fetchApprovedTasks(identity.sapUser, identity.userJwt, pagination);
        const tasks = normalizeTasks(rawTasks);

        // Resolve business context from title parsing, then enrich with factsheet data
        await Promise.all(tasks.map(async (task) => {
            const baseContext = resolveBusinessContext(task, [], []);
            const enrichedContext = await enrichBusinessObjectData(identity, baseContext, {
                sapOrigin: task.sapOrigin,
                includeItemDetails: false,
            });
            task.businessContext = enrichedContext;
            task.requestorName = extractRequestorName(enrichedContext) || task.requestorName;
        }));

        return {
            identity,
            items: tasks,
            total: totalCount,
        };
    }

    /**
     * Get full task detail with all navigation properties resolved.
     * Uses SAP $batch orchestration in the client to avoid unstable direct sub-requests.
     */
    async getTaskDetail(identity: InboxIdentity, instanceId: string): Promise<TaskDetailResponse> {
        const rawTask = await this.sapClient.fetchTaskDetailBundle(
            identity.sapUser,
            instanceId,
            identity.userJwt
        );
        const attrDefinitionsFromExpand =
            rawTask.TaskDefinitionData?.CustomAttributeDefinitionData?.results || [];
        const attrDefinitions =
            attrDefinitionsFromExpand.length > 0
                ? attrDefinitionsFromExpand
                : rawTask.TaskDefinitionID
                    ? await this.sapClient
                        .fetchCustomAttributeDefinitions(
                            identity.sapUser,
                            rawTask.TaskDefinitionID,
                            identity.userJwt
                        )
                        .catch(() => [])
                    : [];

        // Normalize all responses
        const task: InboxTask = normalizeTask(rawTask);
        const decisions = normalizeDecisions(rawTask.DecisionOptions?.results || []);
        const description = normalizeDescription(rawTask.Description || null);
        const customAttributes = normalizeCustomAttributes(
            rawTask.CustomAttributeData?.results || [],
            attrDefinitions
        );
        const taskObjects = normalizeTaskObjects(rawTask.TaskObjects?.results || []);
        const comments = normalizeComments(rawTask.Comments?.results || []);
        const processingLogs = normalizeProcessingLogs(rawTask.ProcessingLogs?.results || []);
        const workflowLogs = normalizeWorkflowLogs(rawTask.WorkflowLogs?.results || []);
        const attachments = normalizeAttachments(rawTask.Attachments?.results || []);

        // Full business context resolution using all available data
        const resolvedContext = resolveBusinessContext(task, customAttributes, taskObjects);
        const businessContext = await enrichBusinessObjectData(identity, resolvedContext, {
            sapOrigin: rawTask.SAP__Origin,
        });
        task.businessContext = businessContext;
        task.requestorName = extractRequestorName(businessContext) || task.requestorName;

        const detail: TaskDetail = {
            task,
            description,
            decisions,
            customAttributes,
            taskObjects,
            comments,
            processingLogs,
            workflowLogs,
            attachments,
            businessContext,
        };

        return { identity, detail };
    }

    async getPurchaseRequisitionApprovalTree(
        identity: InboxIdentity,
        instanceId: string,
        queryDocumentId?: string,
        querySapOrigin?: string
    ): Promise<PurchaseRequisitionApprovalTreeResponse> {
        let prNumber = queryDocumentId;
        let origin = querySapOrigin;

        // If the frontend does not provide the PR number, we fall back to a heavy fetch
        // to parse the PR number.
        if (!prNumber) {
            const rawTask = await this.sapClient.fetchTaskDetailBundle(
                identity.sapUser,
                instanceId,
                identity.userJwt
            );

            const task: InboxTask = normalizeTask(rawTask);
            const customAttributes = normalizeCustomAttributes(rawTask.CustomAttributeData?.results || []);
            const taskObjects = normalizeTaskObjects(rawTask.TaskObjects?.results || []);

            const resolvedContext = resolveBusinessContext(task, customAttributes, taskObjects);
            const enrichedContext = await enrichBusinessObjectData(identity, resolvedContext, {
                sapOrigin: rawTask.SAP__Origin,
                includeItemDetails: false,
            });

            prNumber =
                enrichedContext.type === 'PR'
                    ? enrichedContext.documentId ||
                        ((enrichedContext.pr as { header?: { purchaseRequisition?: string } } | undefined)?.header
                            ?.purchaseRequisition)
                    : undefined;
            origin = rawTask.SAP__Origin;
        }

        if (!prNumber) {
            return { steps: [] };
        }

        if (this.isMockMode()) {
            const mockSteps = MOCK_PR_APPROVAL_TREES[prNumber] || [];
            const mockComments = MOCK_PR_APPROVAL_COMMENTS[prNumber] || [];
            return {
                prNumber,
                steps: mockSteps.map((step) => ({ ...step })),
                comments: mockComments.map((c) => ({ ...c })),
            };
        }

        const res = await this.prApprovalTreeClient.fetchApprovalTree(prNumber, {
            origin: origin,
            userJwt: identity.userJwt,
        });

        return {
            prNumber,
            releaseStrategyName: res.releaseStrategyName,
            steps: res.steps,
            comments: res.comments,
        };
    }

    // ─── Write Operations ─────────────────────────────────

    /**
     * Execute a decision on a task (approve, reject, etc.)
     */
    async executeDecision(
        identity: InboxIdentity,
        instanceId: string,
        request: DecisionRequest
    ): Promise<TaskActionResponse> {
        try {
            const clientCtx = request._context;

            if (request.comment) {
                // If FE provided context, we know the document ID upfront
                if (clientCtx?.documentId) {
                    try {
                        await this.prApprovalTreeClient.addPrComment(
                            clientCtx.documentId,
                            request.comment,
                            { origin: clientCtx.sapOrigin, userJwt: identity.userJwt, type: 'APPR' }
                        );
                        console.log(`[InboxService] Pushed approval comment via client context for ${clientCtx.documentId}`);
                    } catch (err) {
                        console.warn(`[InboxService] Non-fatal: Could not push approval comment: ${err instanceof Error ? err.message : String(err)}`);
                    }
                } else {
                    // No client context — fallback: lightly fetch task bundle to check if PR
                    try {
                        const rawTask = await this.sapClient.fetchTaskDetailBundle(
                            identity.sapUser, instanceId, identity.userJwt
                        );
                        const task = normalizeTask(rawTask);
                        const customAttributes = normalizeCustomAttributes(rawTask.CustomAttributeData?.results || []);
                        const taskObjects = normalizeTaskObjects(rawTask.TaskObjects?.results || []);
                        const resolvedContext = resolveBusinessContext(task, customAttributes, taskObjects);
                        if (resolvedContext.documentId) {
                            await this.prApprovalTreeClient.addPrComment(
                                resolvedContext.documentId,
                                request.comment,
                                { origin: rawTask.SAP__Origin, userJwt: identity.userJwt, type: 'APPR' }
                            );
                            console.log(`[InboxService] Pushed approval comment via bundle fallback for ${resolvedContext.documentId}`);
                        }
                    } catch (err) {
                        console.warn(`[InboxService] Non-fatal: Could not push PR comment bundle fallback: ${err instanceof Error ? err.message : String(err)}`);
                    }
                }
            }

            // Execute immediately without fetching decision options
            await this.decisionHandler.execute(
                identity.sapUser,
                instanceId,
                request,
                [], // Pass empty, validation skipped for decisions check
                identity.userJwt
            );

            return {
                success: true,
                message: `Decision executed successfully.`,
                // We no longer reload the task after decision; UI invalidates automatically.
            };
        } catch (error) {
            if (error instanceof DecisionError) {
                throw error;
            }
            throw new DecisionError(
                `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
                'SAP_ERROR'
            );
        }
    }

    /**
     * Claim a task for the current user.
     */
    async claimTask(identity: InboxIdentity, instanceId: string): Promise<TaskActionResponse> {
        await this.decisionHandler.claim(identity.sapUser, instanceId, identity.userJwt);
        return {
            success: true,
            message: `Task ${instanceId} claimed successfully.`,
        };
    }

    /**
     * Release a claimed task.
     */
    async releaseTask(identity: InboxIdentity, instanceId: string): Promise<TaskActionResponse> {
        await this.decisionHandler.release(identity.sapUser, instanceId, identity.userJwt);
        return {
            success: true,
            message: `Task ${instanceId} released successfully.`,
        };
    }

    /**
     * Forward a task to another user.
     */
    async forwardTask(
        identity: InboxIdentity,
        instanceId: string,
        forwardTo: string
    ): Promise<TaskActionResponse> {
        await this.decisionHandler.forward(identity.sapUser, instanceId, forwardTo, identity.userJwt);
        return {
            success: true,
            message: `Task ${instanceId} forwarded to ${forwardTo}.`,
        };
    }

    /**
     * Add a comment to a task.
     * Validates text, resolves origin, and delegates to SAP via $batch AddComment.
     */
    async addComment(
        identity: InboxIdentity,
        instanceId: string,
        text: string,
        _clientCtx?: { sapOrigin?: string; documentId?: string; businessObjectType?: string }
    ): Promise<TaskActionResponse> {
        if (!text?.trim()) {
            throw Object.assign(new Error('Comment text is required.'), { httpStatus: 400 });
        }

        const addSapTaskCommentPromise = this.sapClient.addComment(
            identity.sapUser,
            instanceId,
            text.trim(),
            identity.userJwt
        ).then(rawComment => {
            console.log(`[InboxService] Comment added to task ${instanceId}: ${rawComment.ID}`);
            return rawComment;
        });

        const promises: Promise<any>[] = [addSapTaskCommentPromise];

        if (_clientCtx?.businessObjectType === 'PR' && _clientCtx?.documentId) {
            const addPrTreeCommentPromise = this.prApprovalTreeClient.addPrComment(
                _clientCtx.documentId,
                text.trim(),
                { origin: _clientCtx.sapOrigin, userJwt: identity.userJwt, type: 'NORM' }
            ).then(() => {
                console.log(`[InboxService] NORM Comment added to PR tree for ${_clientCtx.documentId}`);
            }).catch(err => {
                console.warn(`[InboxService] Non-fatal: Could not push NORM comment to PR tree: ${err instanceof Error ? err.message : String(err)}`);
            });
            promises.push(addPrTreeCommentPromise);
        }

        await Promise.allSettled(promises);

        return {
            success: true,
            message: 'Comment added successfully.',
        };
    }

    /**
     * Stream attachment binary content through the BFF.
     * Resolves attachment metadata (origin, filename, mime type) then fetches binary.
     */
    async streamAttachmentContent(
        identity: InboxIdentity,
        instanceId: string,
        attachmentId: string
    ): Promise<{ data: Buffer; contentType: string; fileName?: string }> {
        const normalizedAttachmentId = decodeURIComponentSafeDeep(attachmentId);

        // Fetch attachment metadata to resolve SAP__Origin and file info
        const rawTask = await this.sapClient.fetchTaskDetailBundle(
            identity.sapUser,
            instanceId,
            identity.userJwt
        );
        const origin = rawTask.SAP__Origin || process.env.SAP_TASK_ORIGIN || 'LOCAL';

        // Use attachment metadata from task detail bundle to avoid extra key-predicate calls.
        const attachments = rawTask.Attachments?.results || [];

        const matchingAtt = attachments.find((a) => {
            if (a.ID === normalizedAttachmentId || a.ID === attachmentId) return true;
            return decodeURIComponentSafeDeep(a.ID) === normalizedAttachmentId;
        });
        const fileName = matchingAtt?.FileName || matchingAtt?.FileDisplayName;
        const attachmentMetadataUri = matchingAtt?.__metadata?.uri;

        const { data, contentType: rawContentType } = await this.sapClient.fetchAttachmentContent(
            identity.sapUser,
            instanceId,
            normalizedAttachmentId,
            origin,
            attachmentMetadataUri,
            identity.userJwt
        );

        // File size guard: 10MB default
        const maxSize = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '10', 10) * 1024 * 1024;
        if (data.byteLength > maxSize) {
            throw Object.assign(
                new Error(`Attachment exceeds maximum size of ${process.env.MAX_ATTACHMENT_SIZE_MB || '10'}MB.`),
                { httpStatus: 413 }
            );
        }

        // SAP often returns application/octet-stream — infer from file extension when possible
        const contentType = (rawContentType === 'application/octet-stream' && fileName)
            ? (inferMimeFromExtension(fileName) || rawContentType)
            : rawContentType;

        // Clean duplicate extensions from filename (e.g. "report.xlsx.xlsx" → "report.xlsx")
        const cleanedFileName = cleanDuplicateExtension(fileName);

        return { data, contentType, fileName: cleanedFileName };
    }

    /**
     * Upload an attachment to a task.
     * Validates file size and type, then delegates to SAP client.
     */
    async addAttachment(
        identity: InboxIdentity,
        instanceId: string,
        fileName: string,
        mimeType: string,
        buffer: Buffer,
        sapOrigin?: string
    ): Promise<TaskActionResponse> {
        const maxSizeMB = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '10', 10);
        const maxSizeBytes = maxSizeMB * 1024 * 1024;

        if (buffer.byteLength > maxSizeBytes) {
            throw Object.assign(
                new Error(`File exceeds maximum size of ${maxSizeMB}MB.`),
                { httpStatus: 413 }
            );
        }

        const rawAttachment = await this.sapClient.addAttachment(
            identity.sapUser,
            instanceId,
            fileName,
            mimeType,
            buffer,
            identity.userJwt,
            sapOrigin
        );

        console.log(`[InboxService] Attachment uploaded to task ${instanceId}: ${rawAttachment.ID} (${fileName})`);

        return {
            success: true,
            message: `Attachment "${fileName}" uploaded successfully.`,
        };
    }

    // ─── Helpers ──────────────────────────────────────────

    private isMockMode(): boolean {
        return shouldUseMock();
    }
}

// ─── Factory ──────────────────────────────────────────────

function createSapClient(): ISapTaskClient {
    const useMock = shouldUseMock();

    if (useMock) {
        console.log(
            '[SapClient] Using MOCK SAP client (set SAP_TASK_DESTINATION or SAP_TASK_BASE_URL for real SAP)'
        );
        return new MockSapTaskClient();
    }

    const destinationName = process.env.SAP_TASK_DESTINATION || 'S4H_ODATA';
    if (process.env.SAP_USE_DESTINATION !== 'false') {
        console.log(`[SapClient] Using REAL SAP client via destination → ${destinationName}`);
    } else {
        console.log(`[SapClient] Using REAL SAP client via base URL → ${process.env.SAP_TASK_BASE_URL}`);
    }
    return new SapTaskClient();
}

function shouldUseMock(): boolean {
    if (process.env.USE_MOCK_SAP === 'true') return true;
    if (process.env.USE_MOCK_SAP === 'false') return false;

    const destinationEnabled = process.env.SAP_USE_DESTINATION !== 'false';
    const hasDestination = !!(process.env.SAP_TASK_DESTINATION || 'S4H_ODATA');
    const hasBaseUrl = !!process.env.SAP_TASK_BASE_URL;

    return !((destinationEnabled && hasDestination) || hasBaseUrl);
}

function extractRequestorName(
    context: InboxTask['businessContext']
): string | undefined {
    if (!context || context.type !== 'PR') return undefined;

    const pr = context.pr as
        | {
            header?: {
                userFullName?: string;
                purReqnRequestor?: string;
                createdByUser?: string;
            };
        }
        | undefined;
    const header = pr?.header;
    return (
        header?.userFullName ||
        header?.purReqnRequestor ||
        header?.createdByUser ||
        undefined
    );
}

function decodeURIComponentSafe(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function decodeURIComponentSafeDeep(value: string, maxRounds = 3): string {
    let current = value;
    for (let i = 0; i < maxRounds; i += 1) {
        const next = decodeURIComponentSafe(current);
        if (next === current) return current;
        current = next;
    }
    return current;
}

/** Infer MIME type from file extension when SAP returns application/octet-stream */
function inferMimeFromExtension(fileName: string): string | undefined {
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
        odt: 'application/vnd.oasis.opendocument.text',
        ods: 'application/vnd.oasis.opendocument.spreadsheet',
        odp: 'application/vnd.oasis.opendocument.presentation',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        txt: 'text/plain',
        csv: 'text/csv',
        html: 'text/html',
        json: 'application/json',
        xml: 'application/xml',
        zip: 'application/zip',
    };
    return map[ext];
}

/** Clean duplicate file extensions: "report.xlsx.xlsx" → "report.xlsx" */
function cleanDuplicateExtension(fileName?: string): string | undefined {
    if (!fileName) return undefined;
    const match = fileName.match(/^(.+)\.([^.]+)\.([^.]+)$/);
    if (match && match[2].toLowerCase() === match[3].toLowerCase()) {
        return `${match[1]}.${match[3]}`;
    }
    return fileName;
}

// Singleton instance
let _instance: InboxService | null = null;

export function getInboxService(): InboxService {
    if (!_instance) {
        _instance = new InboxService();
    }
    return _instance;
}
