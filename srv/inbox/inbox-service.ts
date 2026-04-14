import {
    InboxIdentity,
    TaskListResponse,
    TaskDetailResponse,
    TaskActionResponse,
    DecisionRequest,
    InboxTask,
    TaskAttachment,
    PurchaseRequisitionApprovalTreeResponse,
    DashboardResponse,
} from '../types';
import {
    assembleTaskListResponse,
    assembleFullDetailResponse,
    assembleInformationResponse,
    assembleOverviewResponse,
    assembleActionResponse,
} from './handlers/task-response-assembler';
import { ISapTaskClient, SapTaskClient } from './clients/sap-task-client';
import { MockSapTaskClient } from './mock/mock-sap-client';
import { resolveBusinessContext } from './resolvers/business-context-resolver';
import { enrichBusinessObjectData } from './resolvers/business-object-data-resolver';
import { DecisionError } from './handlers/decision-handler';
import { SapPurchaseRequisitionApprovalTreeClient } from './clients/sap-pr-approval-tree-client';
import { SapDashboardClient } from './clients/sap-dashboard-client';
import { MOCK_PR_APPROVAL_TREES, MOCK_PR_APPROVAL_COMMENTS } from './mock/mock-factsheet-data';
import { MOCK_DASHBOARD_TASKS } from './mock/mock-dashboard-data';
import { resolveAuthRuntimeConfig } from '../core/config/auth-mode';
import { AppRequestContext } from '../core/context/app-request-context';
import { SAPExecutionContext } from '../core/context/sap-execution-context';
import {
    logSapReadFinished,
    logSapReadStarted,
} from '../core/logging/sap-call-log';
import {
    executeTaskDecisionBoundary,
    inferDecisionKind,
} from '../integrations/sap/task-decision-boundary';

// Phase 2: Modular adapters replace direct sapClient usage
import { TaskQueryAdapter } from '../integrations/sap/task-query-adapter';
import { TaskDetailAdapter } from '../integrations/sap/task-detail-adapter';
import { TaskDecisionAdapter } from '../integrations/sap/task-decision-adapter';
import type { AdapterContext } from '../integrations/sap/task-transport-utils';

/**
 * Inbox Service — The Orchestrator
 *
 * Core BFF layer that:
 *   1. Receives identity-resolved requests from the router
 *   2. Delegates SAP TASKPROCESSING calls to capability-specific adapters
 *   3. Resolves business context (PR/PO detection)
 *   4. Enriches domain models with factsheet data
 *   5. Validates and executes decisions
 *
 * Phase 2: SAP transport concerns are fully delegated to adapters.
 *   - TaskQueryAdapter  → task list retrieval
 *   - TaskDetailAdapter → task detail / information / attachment streaming
 *   - TaskDecisionAdapter → approve / reject / forward / comment / attachment upload
 *
 * This is the ONLY class the router talks to. All SAP complexity is hidden here.
 */

export interface ServiceExecutionContext {
    appContext: AppRequestContext;
    sapContext: SAPExecutionContext;
}

export class InboxService {
    private queryAdapter: TaskQueryAdapter;
    private detailAdapter: TaskDetailAdapter;
    private decisionAdapter: TaskDecisionAdapter;
    private dashboardClient: SapDashboardClient;
    private prApprovalTreeClient: SapPurchaseRequisitionApprovalTreeClient;

    constructor() {
        const sapClient = createSapClient();
        this.queryAdapter = new TaskQueryAdapter(sapClient);
        this.detailAdapter = new TaskDetailAdapter(sapClient);
        this.decisionAdapter = new TaskDecisionAdapter(sapClient);
        this.prApprovalTreeClient = new SapPurchaseRequisitionApprovalTreeClient();
        this.dashboardClient = new SapDashboardClient();
        console.log(
            `[InboxService] Initialized with ${this.isMockMode() ? 'MOCK' : 'REAL'} SAP client`
        );
    }

    // ─── Dashboard ────────────────────────────────────────

    /**
     * Get dashboard data for the authenticated user.
     * Returns all task-level records from the ZI_PR_DASH_BOARD entity.
     */
    async getDashboard(
        identity: InboxIdentity,
        executionContext?: ServiceExecutionContext
    ): Promise<DashboardResponse> {
        if (this.isMockMode()) {
            return { items: MOCK_DASHBOARD_TASKS, total: MOCK_DASHBOARD_TASKS.length };
        }

        const result = await this.withSapReadLogging(
            executionContext,
            'fetchDashboard',
            () => this.dashboardClient.fetchDashboard({ userJwt: identity.userJwt })
        );

        return { items: result.items, total: result.total };
    }

    // ─── Read Operations ──────────────────────────────────

    /**
     * Get all tasks for the given identity.
     * Returns normalized task list with business context enrichment (factsheet header data).
     */
    async getTasks(
        identity: InboxIdentity,
        pagination?: { top?: number; skip?: number },
        executionContext?: ServiceExecutionContext
    ): Promise<TaskListResponse> {
        const adapterCtx = toAdapterContext(identity);

        const { items: tasks, total } = await this.withSapReadLogging(
            executionContext,
            'fetchTasks',
            () => this.queryAdapter.fetchTasks(adapterCtx, pagination)
        );

        await Promise.all(
            tasks.map((task) => this.enrichTaskForList(identity, task))
        );

        return assembleTaskListResponse(identity, tasks, total);
    }

    /**
     * Get all approved tasks for the given identity.
     * Returns normalized task list with business context enrichment (factsheet header data).
     */
    async getApprovedTasks(
        identity: InboxIdentity,
        pagination?: { top?: number; skip?: number },
        executionContext?: ServiceExecutionContext
    ): Promise<TaskListResponse> {
        const adapterCtx = toAdapterContext(identity);

        const { items: tasks, total } = await this.withSapReadLogging(
            executionContext,
            'fetchApprovedTasks',
            () => this.queryAdapter.fetchApprovedTasks(adapterCtx, pagination)
        );

        await Promise.all(
            tasks.map((task) => this.enrichTaskForList(identity, task))
        );

        return assembleTaskListResponse(identity, tasks, total);
    }

    /**
     * Get full task detail with all navigation properties resolved.
     * Uses SAP $batch orchestration in the detail adapter to avoid unstable direct sub-requests.
     */
    async getTaskDetail(
        identity: InboxIdentity,
        instanceId: string,
        executionContext?: ServiceExecutionContext
    ): Promise<TaskDetailResponse> {
        const adapterCtx = toAdapterContext(identity);

        const bundle = await this.withSapReadLogging(
            executionContext,
            'fetchTaskDetailBundle',
            () => this.detailAdapter.fetchTaskDetailBundle(adapterCtx, instanceId)
        );

        // Full business context resolution using all available data
        const resolvedContext = resolveBusinessContext(
            bundle.task,
            bundle.customAttributes,
            bundle.taskObjects
        );
        const businessContext = await enrichBusinessObjectData(identity, resolvedContext, {
            sapOrigin: bundle.sapIdentifiers.sapOrigin,
            includeItemDetails: true,
            includePrInfo: true,
            includeApprovalTree: false,
        });
        bundle.task.businessContext = businessContext;
        bundle.task.requestorName = extractRequestorName(businessContext) || bundle.task.requestorName;

        return assembleFullDetailResponse(identity, bundle, businessContext);
    }

    /**
     * Get lightweight task information for fast first render in detail pane.
     * Excludes heavy tab payloads (comments, attachments, logs).
     *
     * When the frontend forwards client hints (sapOrigin, documentId),
     * the adapter skips the origin-lookup fetch and the service runs
     * PR / PO enrichment in parallel with the SAP $batch call — cutting
     * total latency roughly in half.
     */
    async getTaskInformation(
        identity: InboxIdentity,
        instanceId: string,
        executionContext?: ServiceExecutionContext,
        clientHints?: { sapOrigin?: string; documentId?: string; businessObjectType?: string }
    ): Promise<TaskDetailResponse> {
        const adapterCtx = toAdapterContext(identity);

        // When the caller already knows the document ID (e.g. PR number),
        // we can start enrichment immediately — in parallel with the SAP
        // $batch fetch — instead of waiting for the $batch result first.
        const earlyEnrichPromise =
            clientHints?.documentId && clientHints?.businessObjectType
                ? enrichBusinessObjectData(
                      identity,
                      {
                          type: clientHints.businessObjectType as 'PR' | 'PO',
                          documentId: clientHints.documentId,
                      },
                      {
                          sapOrigin: clientHints.sapOrigin,
                          includeItemDetails: false,
                          includePrInfo: true,
                          includeApprovalTree: false,
                      }
                  ).catch(() => undefined)
                : Promise.resolve(undefined);

        const [bundle, earlyEnriched] = await Promise.all([
            this.withSapReadLogging(
                executionContext,
                'fetchTaskInformation',
                () => this.detailAdapter.fetchTaskInformation(adapterCtx, instanceId, clientHints)
            ),
            earlyEnrichPromise,
        ]);

        // If early enrichment was available, merge it. Otherwise fall back to
        // the sequential path as before.
        let businessContext;
        if (earlyEnriched && earlyEnriched.documentId) {
            businessContext = earlyEnriched;
        } else {
            const resolvedContext = resolveBusinessContext(
                bundle.task,
                bundle.customAttributes,
                bundle.taskObjects
            );
            businessContext = await enrichBusinessObjectData(identity, resolvedContext, {
                sapOrigin: bundle.sapIdentifiers.sapOrigin,
                includeItemDetails: false,
                includePrInfo: true,
                includeApprovalTree: false,
            });
        }

        bundle.task.businessContext = businessContext;
        bundle.task.requestorName =
            extractRequestorName(businessContext) || bundle.task.requestorName || bundle.task.createdByName;

        return assembleInformationResponse(identity, bundle, businessContext);
    }

    /**
     * Get ultra-lightweight task overview for the fastest possible first render.
     *
     * Uses a 3-segment SAP $batch (vs 5 for getTaskInformation) to exclude
     * the heavy TaskObjects and Attachments queries. The frontend loads those
     * in the background after the overview renders.
     *
     * When the frontend forwards client hints (sapOrigin, documentId),
     * the adapter skips the origin-lookup fetch and the service runs
     * PR / PO enrichment in parallel — cutting total latency further.
     */
    async getTaskOverview(
        identity: InboxIdentity,
        instanceId: string,
        executionContext?: ServiceExecutionContext,
        clientHints?: { sapOrigin?: string; documentId?: string; businessObjectType?: string }
    ): Promise<TaskDetailResponse> {
        const adapterCtx = toAdapterContext(identity);

        // When the caller already knows the document ID (e.g. PR number),
        // we can start enrichment immediately — in parallel with the SAP
        // $batch fetch — instead of waiting for the $batch result first.
        const earlyEnrichPromise =
            clientHints?.documentId && clientHints?.businessObjectType
                ? enrichBusinessObjectData(
                      identity,
                      {
                          type: clientHints.businessObjectType as 'PR' | 'PO',
                          documentId: clientHints.documentId,
                      },
                      {
                          sapOrigin: clientHints.sapOrigin,
                          includeItemDetails: false,
                          includePrInfo: true,
                          includeApprovalTree: false,
                      }
                  ).catch(() => undefined)
                : Promise.resolve(undefined);

        const [bundle, earlyEnriched] = await Promise.all([
            this.withSapReadLogging(
                executionContext,
                'fetchTaskOverview',
                () => this.detailAdapter.fetchTaskOverview(adapterCtx, instanceId, clientHints)
            ),
            earlyEnrichPromise,
        ]);

        // If early enrichment was available, merge it. Otherwise fall back to
        // the sequential path.
        let businessContext;
        if (earlyEnriched && earlyEnriched.documentId) {
            businessContext = earlyEnriched;
        } else {
            const resolvedContext = resolveBusinessContext(
                bundle.task,
                bundle.customAttributes,
                [] // No taskObjects in overview
            );
            businessContext = await enrichBusinessObjectData(identity, resolvedContext, {
                sapOrigin: bundle.sapIdentifiers.sapOrigin,
                includeItemDetails: false,
                includePrInfo: true,
                includeApprovalTree: false,
            });
        }

        bundle.task.businessContext = businessContext;
        bundle.task.requestorName =
            extractRequestorName(businessContext) || bundle.task.requestorName || bundle.task.createdByName;

        return assembleOverviewResponse(identity, bundle, businessContext);
    }

    async getPurchaseRequisitionApprovalTree(
        identity: InboxIdentity,
        instanceId: string,
        queryDocumentId?: string,
        querySapOrigin?: string,
        executionContext?: ServiceExecutionContext
    ): Promise<PurchaseRequisitionApprovalTreeResponse> {
        let prNumber = queryDocumentId;
        let origin = querySapOrigin;

        // If the frontend does not provide the PR number, we fall back to a heavy fetch
        // to parse the PR number.
        if (!prNumber) {
            const adapterCtx = toAdapterContext(identity);

            const bundle = await this.withSapReadLogging(
                executionContext,
                'fetchTaskDetailBundle',
                () => this.detailAdapter.fetchTaskDetailBundle(adapterCtx, instanceId)
            );

            const resolvedContext = resolveBusinessContext(
                bundle.task,
                bundle.customAttributes,
                bundle.taskObjects
            );
            const enrichedContext = await enrichBusinessObjectData(identity, resolvedContext, {
                sapOrigin: bundle.sapIdentifiers.sapOrigin,
                includeItemDetails: false,
                includePrInfo: false,
                includeApprovalTree: false,
            });

            prNumber =
                enrichedContext.type === 'PR'
                    ? enrichedContext.documentId ||
                        ((enrichedContext.pr as { header?: { purchaseRequisition?: string } } | undefined)?.header
                            ?.purchaseRequisition)
                    : undefined;
            origin = bundle.sapIdentifiers.sapOrigin;
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
        request: DecisionRequest,
        executionContext?: ServiceExecutionContext
    ): Promise<TaskActionResponse> {
        if (!executionContext) {
            return this.executeDecisionInternal(identity, instanceId, request);
        }

        return executeTaskDecisionBoundary({
            appContext: executionContext.appContext,
            sapContext: executionContext.sapContext,
            decision: inferDecisionKind(request.decisionKey, request.type),
            taskIdentifiers: {
                instanceId,
                sapOrigin: request._context?.sapOrigin,
                documentId: request._context?.documentId,
            },
            execute: () => this.executeDecisionInternal(identity, instanceId, request),
        });
    }

    private async executeDecisionInternal(
        identity: InboxIdentity,
        instanceId: string,
        request: DecisionRequest
    ): Promise<TaskActionResponse> {
        try {
            const clientCtx = request._context;
            const adapterCtx = toAdapterContext(identity);

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
                    // No client context — fallback: fetch task bundle to check if PR
                    try {
                        const bundle = await this.detailAdapter.fetchTaskDetailBundle(
                            adapterCtx, instanceId
                        );
                        const resolvedContext = resolveBusinessContext(
                            bundle.task,
                            bundle.customAttributes,
                            bundle.taskObjects
                        );
                        if (resolvedContext.documentId) {
                            await this.prApprovalTreeClient.addPrComment(
                                resolvedContext.documentId,
                                request.comment,
                                { origin: bundle.sapIdentifiers.sapOrigin, userJwt: identity.userJwt, type: 'APPR' }
                            );
                            console.log(`[InboxService] Pushed approval comment via bundle fallback for ${resolvedContext.documentId}`);
                        }
                    } catch (err) {
                        console.warn(`[InboxService] Non-fatal: Could not push PR comment bundle fallback: ${err instanceof Error ? err.message : String(err)}`);
                    }
                }
            }

            // Execute decision via adapter
            const result = await this.decisionAdapter.executeDecision(adapterCtx, {
                instanceId,
                decisionKey: request.decisionKey,
                comment: request.comment,
            });

            return assembleActionResponse(result.success, result.message);
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
     * Forward a task to another user.
     */
    async forwardTask(
        identity: InboxIdentity,
        instanceId: string,
        forwardTo: string
    ): Promise<TaskActionResponse> {
        const adapterCtx = toAdapterContext(identity);
        const result = await this.decisionAdapter.forwardTask(adapterCtx, {
            instanceId,
            forwardTo,
        });
        return assembleActionResponse(result.success, result.message);
    }

    /**
     * Add a comment to a task.
     * Validates text, resolves origin, and delegates to SAP via the decision adapter.
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

        const adapterCtx = toAdapterContext(identity);

        const addSapTaskCommentPromise = this.decisionAdapter.addComment(
            adapterCtx,
            instanceId,
            text.trim()
        ).then(result => {
            console.log(`[InboxService] Comment added to task ${instanceId}: ${result.commentId}`);
            return result;
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

        return assembleActionResponse(true, 'Comment added successfully.');
    }

    /**
     * Stream attachment binary content through the BFF.
     * Delegates SAP interaction to detail adapter; applies business rules locally.
     */
    async streamAttachmentContent(
        identity: InboxIdentity,
        instanceId: string,
        attachmentId: string
    ): Promise<{ data: Buffer; contentType: string; fileName?: string }> {
        const adapterCtx = toAdapterContext(identity);

        const { data, contentType: rawContentType, fileName } =
            await this.detailAdapter.streamAttachmentContent(adapterCtx, instanceId, attachmentId);

        // File size guard: 5MB default
        const maxSize = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '5', 10) * 1024 * 1024;
        if (data.byteLength > maxSize) {
            throw Object.assign(
                new Error(`Attachment exceeds maximum size of ${process.env.MAX_ATTACHMENT_SIZE_MB || '5'}MB.`),
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
     * Validates file size and type, then delegates to the decision adapter.
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

        const adapterCtx = toAdapterContext(identity);

        await this.decisionAdapter.addAttachment(adapterCtx, {
            instanceId,
            fileName,
            mimeType,
            buffer,
            sapOrigin,
        });

        console.log(`[InboxService] Attachment uploaded to task ${instanceId}: (${fileName})`);

        return assembleActionResponse(true, `Attachment "${fileName}" uploaded successfully.`);
    }

    // ─── PR Attachment Operations (Standalone API) ────────────

    /**
     * Get PR attachment metadata list via the standalone ZI_PR_ATTACH_TAB API.
     * Returns metadata only (no file content) for fast loading.
     */
    async getPrAttachments(
        identity: InboxIdentity,
        documentNumber: string,
        sapOrigin?: string
    ): Promise<TaskAttachment[]> {
        if (this.isMockMode()) {
            return [];
        }

        const rawAttachments = await this.prApprovalTreeClient.fetchPrAttachments(
            documentNumber,
            { origin: sapOrigin, userJwt: identity.userJwt }
        );

        // Map raw SAP shape → internal TaskAttachment model
        return rawAttachments.map((raw, index) => ({
            id: raw.attach_id || `pr-att-${index}-${raw.file_name || 'unknown'}`,
            fileName: raw.file_name,
            fileDisplayName: raw.file_name,
            mimeType: normalizeMimeType(raw.mime_type, raw.file_name),
            fileSize: raw.file_size,
            createdAt: raw.created_on
                ? (raw.created_time ? `${raw.created_on}T${raw.created_time}` : raw.created_on)
                : undefined,
            createdBy: raw.created_by,
        }));
    }

    /**
     * Stream PR attachment binary content via the standalone ZI_PR_ATTACHMENTS API.
     * Uses attach_id to target a single file, avoiding fetching all attachments.
     */
    async streamPrAttachmentContent(
        identity: InboxIdentity,
        documentNumber: string,
        attachId: string,
        sapOrigin?: string
    ): Promise<{ data: Buffer; contentType: string; fileName: string }> {
        const result = await this.prApprovalTreeClient.fetchPrAttachmentContent(
            documentNumber,
            attachId,
            { origin: sapOrigin, userJwt: identity.userJwt }
        );

        if (!result) {
            throw Object.assign(
                new Error(`Attachment "${attachId}" not found for PR ${documentNumber}.`),
                { httpStatus: 404 }
            );
        }

        // File size guard
        const maxSize = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '5', 10) * 1024 * 1024;
        if (result.data.byteLength > maxSize) {
            throw Object.assign(
                new Error(`Attachment exceeds maximum size of ${process.env.MAX_ATTACHMENT_SIZE_MB || '5'}MB.`),
                { httpStatus: 413 }
            );
        }

        // Normalize MIME type (SAP may return abbreviated types like "PDF")
        const contentType = normalizeMimeType(result.contentType, result.fileName)
            || inferMimeFromExtension(result.fileName)
            || result.contentType;

        const cleanedFileName = cleanDuplicateExtension(result.fileName);

        return { data: result.data, contentType, fileName: cleanedFileName || attachId };
    }

    /**
     * Upload an attachment to a PR document via the standalone ZI_PR_ATTACH_TAB API.
     * Performs Buffer-to-Base64 conversion for the SAP OData V4 action.
     */
    async uploadPrAttachment(
        identity: InboxIdentity,
        documentNumber: string,
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

        await this.prApprovalTreeClient.uploadPrAttachment(
            documentNumber,
            fileName,
            mimeType,
            buffer,
            { origin: sapOrigin, userJwt: identity.userJwt }
        );

        console.log(`[InboxService] PR Attachment uploaded to ${documentNumber}: (${fileName})`);

        return assembleActionResponse(true, `Attachment "${fileName}" uploaded successfully.`);
    }

    // ─── Helpers ──────────────────────────────────────────

    private async withSapReadLogging<T>(
        executionContext: ServiceExecutionContext | undefined,
        sapOperation: string,
        run: () => Promise<T>
    ): Promise<T> {
        if (!executionContext) {
            return run();
        }

        const startedAt = Date.now();
        logSapReadStarted(
            executionContext.appContext,
            executionContext.sapContext,
            sapOperation
        );

        try {
            const data = await run();
            logSapReadFinished({
                appContext: executionContext.appContext,
                sapContext: executionContext.sapContext,
                sapOperation,
                status: 'success',
                latencyMs: Date.now() - startedAt,
            });
            return data;
        } catch (error) {
            logSapReadFinished({
                appContext: executionContext.appContext,
                sapContext: executionContext.sapContext,
                sapOperation,
                status: 'error',
                latencyMs: Date.now() - startedAt,
            });
            throw error;
        }
    }

    private async enrichTaskForList(
        identity: InboxIdentity,
        task: InboxTask
    ): Promise<void> {
        const baseContext = resolveBusinessContext(task, [], []);
        const enrichedContext = await enrichBusinessObjectData(identity, baseContext, {
            sapOrigin: task.sapOrigin,
            includeItemDetails: false,
            includePrInfo: false,
            includeApprovalTree: false,
        });

        task.businessContext = enrichedContext;
        task.requestorName =
            extractRequestorName(enrichedContext) ||
            task.requestorName ||
            task.createdByName;
    }

    private isMockMode(): boolean {
        return shouldUseMock();
    }
}

// ─── Adapter Context Helper ───────────────────────────────

function toAdapterContext(identity: InboxIdentity): AdapterContext {
    return { sapUser: identity.sapUser, userJwt: identity.userJwt };
}

// ─── Factory ──────────────────────────────────────────────

function createSapClient(): ISapTaskClient {
    const runtimeAuth = resolveAuthRuntimeConfig();
    const useMock = runtimeAuth.authMode === 'mock' || shouldUseMock();

    if (useMock) {
        console.log(
            '[SapClient] Using MOCK SAP client (set SAP_TASK_DESTINATION or SAP_TASK_BASE_URL for real SAP)'
        );
        return new MockSapTaskClient();
    }

    const destinationName = runtimeAuth.destinationName;
    if (runtimeAuth.useDestination) {
        console.log(`[SapClient] Using REAL SAP client via destination → ${destinationName}`);
    } else {
        console.log(`[SapClient] Using REAL SAP client via base URL → ${process.env.SAP_TASK_BASE_URL}`);
    }
    return new SapTaskClient();
}

function shouldUseMock(): boolean {
    const runtimeAuth = resolveAuthRuntimeConfig();
    if (runtimeAuth.authMode === 'mock') return true;
    if (process.env.USE_MOCK_SAP === 'false') return false;

    const hasDestination = !!runtimeAuth.destinationName;
    const hasBaseUrl = !!process.env.SAP_TASK_BASE_URL;

    return !((runtimeAuth.useDestination && hasDestination) || hasBaseUrl);
}

function extractRequestorName(
    context: InboxTask['businessContext']
): string | undefined {
    if (!context) return undefined;

    if (context.type === 'PR') {
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

    if (context.type === 'PO') {
        const po = context.po as
            | {
                header?: {
                    userFullName?: string;
                    createdByUser?: string;
                };
            }
            | undefined;
        const header = po?.header;
        return (
            header?.userFullName ||
            header?.createdByUser ||
            undefined
        );
    }

    return undefined;
}

/** Infer MIME type from file extension when SAP returns application/octet-stream */
function inferMimeFromExtension(fileName: string): string | undefined {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return undefined;
    return EXTENSION_MIME_MAP[ext];
}

/**
 * Normalize mime_type values from SAP.
 * The ZI_PR_ATTACHMENTS API returns abbreviated types like "PDF", "XLSX"
 * instead of proper MIME types like "application/pdf".
 */
function normalizeMimeType(rawMimeType?: string, fileName?: string): string | undefined {
    if (!rawMimeType) {
        // No mime_type from SAP — try to infer from file extension
        return fileName ? inferMimeFromExtension(fileName) : undefined;
    }

    // If it already looks like a proper MIME type (contains '/'), return as-is
    if (rawMimeType.includes('/')) return rawMimeType;

    // SAP returns short labels like "PDF", "XLSX" — treat as extension
    const fromShortLabel = EXTENSION_MIME_MAP[rawMimeType.toLowerCase()];
    if (fromShortLabel) return fromShortLabel;

    // Fallback: try file extension
    return fileName ? (inferMimeFromExtension(fileName) || rawMimeType) : rawMimeType;
}

const EXTENSION_MIME_MAP: Record<string, string> = {
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
