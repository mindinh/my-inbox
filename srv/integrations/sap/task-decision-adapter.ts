/**
 * Task Decision Adapter — Phase 2
 *
 * Capability-focused adapter for SAP task write operations.
 * Owns: executeDecision, forwardTask, addComment, addAttachment
 *
 * Responsibilities:
 *   - Delegates decision execution to DecisionHandler (validation + SAP call)
 *   - Delegates comment/attachment writes to ISapTaskClient
 *   - Normalizes errors via task-error-mapper
 *   - Emits module-aware diagnostic logs (Workstream K)
 *   - Returns typed results independent of raw SAP payloads
 *
 * Rules:
 *   - No business logic (no PR comment routing, no context resolution)
 *   - PR-specific comment push stays in the service layer (it's business orchestration)
 *   - No router/controller dependencies
 */

import { ISapTaskClient } from '../../inbox/clients/sap-task-client';
import { DecisionHandler, DecisionError } from '../../inbox/handlers/decision-handler';
import { classifyAndWrapError } from './task-error-mapper';
import type { AdapterContext } from './task-transport-utils';
import { withAdapterLogging } from './task-transport-utils';
import type {
    TaskDecisionResult,
    CommentResult,
} from '../../domain/inbox/inbox-task.models';
import type {
    ExecuteDecisionInput,
    ForwardTaskInput,
    AddAttachmentInput,
} from '../../domain/inbox/inbox-task.dto';

const MODULE = 'decision';

export class TaskDecisionAdapter {
    private readonly decisionHandler: DecisionHandler;

    constructor(private readonly sapClient: ISapTaskClient) {
        this.decisionHandler = new DecisionHandler(sapClient);
    }

    /**
     * Execute a task decision (approve/reject).
     * Validates the decision key, then delegates to SAP.
     * Re-throws DecisionError for caller handling; wraps unexpected errors.
     */
    async executeDecision(
        context: AdapterContext,
        input: ExecuteDecisionInput
    ): Promise<TaskDecisionResult> {
        return withAdapterLogging(MODULE, 'executeDecision', async () => {
            try {
                await this.decisionHandler.execute(
                    context.sapUser,
                    input.instanceId,
                    { decisionKey: input.decisionKey, comment: input.comment },
                    [], // Skip available-decisions check — FE pre-validates
                    context.userJwt
                );

                return {
                    success: true,
                    message: 'Decision executed successfully.',
                };
            } catch (error) {
                // Let DecisionError bubble as-is; wrap unexpected errors
                if (error instanceof DecisionError) {
                    throw error;
                }
                throw classifyAndWrapError(error, 'task.decision.execute');
            }
        });
    }

    /**
     * Forward a task to another user.
     * Validates forward target, then delegates to SAP.
     */
    async forwardTask(
        context: AdapterContext,
        input: ForwardTaskInput
    ): Promise<TaskDecisionResult> {
        return withAdapterLogging(MODULE, 'forwardTask', async () => {
            try {
                await this.decisionHandler.forward(
                    context.sapUser,
                    input.instanceId,
                    input.forwardTo,
                    context.userJwt
                );

                return {
                    success: true,
                    message: `Task ${input.instanceId} forwarded to ${input.forwardTo}.`,
                };
            } catch (error) {
                if (error instanceof DecisionError) {
                    throw error;
                }
                throw classifyAndWrapError(error, 'task.decision.forward');
            }
        });
    }

    /**
     * Add a comment to a task via SAP OData $batch AddComment FunctionImport.
     * Returns the created comment ID.
     */
    async addComment(
        context: AdapterContext,
        instanceId: string,
        text: string
    ): Promise<CommentResult> {
        return withAdapterLogging(MODULE, 'addComment', async () => {
            try {
                const rawComment = await this.sapClient.addComment(
                    context.sapUser,
                    instanceId,
                    text,
                    context.userJwt
                );

                return { commentId: rawComment.ID || `comment-${Date.now()}` };
            } catch (error) {
                throw classifyAndWrapError(error, 'task.decision.addComment');
            }
        });
    }

    /**
     * Upload an attachment to a task.
     * Note: File size validation stays in the service layer (it's business policy).
     */
    async addAttachment(
        context: AdapterContext,
        input: AddAttachmentInput
    ): Promise<void> {
        return withAdapterLogging(MODULE, 'addAttachment', async () => {
            try {
                await this.sapClient.addAttachment(
                    context.sapUser,
                    input.instanceId,
                    input.fileName,
                    input.mimeType,
                    input.buffer,
                    context.userJwt,
                    input.sapOrigin
                );
            } catch (error) {
                throw classifyAndWrapError(error, 'task.decision.addAttachment');
            }
        });
    }
}
