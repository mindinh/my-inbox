/**
 * Task Response Assembler — Phase 2 Workstream I
 *
 * Dedicated response assembly that converts internal domain models
 * into the existing frontend API response shapes.
 *
 * Purpose:
 *   - Isolate frontend contract from internal model evolution
 *   - Make response shaping explicit rather than inline in service methods
 *   - Preserve the existing API contract exactly
 *
 * Rules:
 *   - Only uses internal models as input
 *   - Output matches the existing API response types exactly
 *   - No SAP raw types, no transport logic, no business logic
 */

import type {
    InboxIdentity,
    InboxTask,
    TaskListResponse,
    TaskDetailResponse,
    TaskActionResponse,
    TaskDetail,
} from '../../types';
import type {
    TaskDetailBundle,
    TaskInformationBundle,
    TaskOverviewBundle,
} from '../../domain/inbox/inbox-task.models';

/**
 * Assemble a task list API response from internal query results.
 */
export function assembleTaskListResponse(
    identity: InboxIdentity,
    items: InboxTask[],
    total: number
): TaskListResponse {
    return {
        identity,
        items,
        total,
    };
}

/**
 * Assemble a full task detail API response from a detail bundle.
 * Includes all tab data (comments, attachments, logs).
 */
export function assembleFullDetailResponse(
    identity: InboxIdentity,
    bundle: TaskDetailBundle,
    businessContext: InboxTask['businessContext']
): TaskDetailResponse {
    const detail: TaskDetail = {
        task: bundle.task,
        description: bundle.description,
        decisions: bundle.decisions,
        customAttributes: bundle.customAttributes,
        taskObjects: bundle.taskObjects,
        comments: bundle.comments,
        processingLogs: bundle.processingLogs,
        workflowLogs: bundle.workflowLogs,
        attachments: bundle.attachments,
        businessContext,
    };

    return { identity, detail };
}

/**
 * Assemble a lightweight task information API response from an information bundle.
 * Heavy tab data (comments, attachments, logs) are returned as empty arrays.
 */
export function assembleInformationResponse(
    identity: InboxIdentity,
    bundle: TaskInformationBundle,
    businessContext: InboxTask['businessContext']
): TaskDetailResponse {
    const detail: TaskDetail = {
        task: bundle.task,
        description: bundle.description,
        decisions: bundle.decisions,
        customAttributes: bundle.customAttributes,
        taskObjects: bundle.taskObjects,
        comments: [],
        processingLogs: [],
        workflowLogs: [],
        attachments: [],
        businessContext,
    };

    return { identity, detail };
}

/**
 * Assemble a task action API response (decision, forward, comment, attachment).
 */
export function assembleActionResponse(
    success: boolean,
    message: string
): TaskActionResponse {
    return { success, message };
}

/**
 * Assemble the fastest-possible overview response from an overview bundle.
 * TaskObjects, comments, attachments, and logs are empty — loaded in background.
 */
export function assembleOverviewResponse(
    identity: InboxIdentity,
    bundle: TaskOverviewBundle,
    businessContext: InboxTask['businessContext']
): TaskDetailResponse {
    const detail: TaskDetail = {
        task: bundle.task,
        description: bundle.description,
        decisions: bundle.decisions,
        customAttributes: bundle.customAttributes,
        taskObjects: [],
        comments: [],
        processingLogs: [],
        workflowLogs: [],
        attachments: [],
        businessContext,
    };

    return { identity, detail };
}
