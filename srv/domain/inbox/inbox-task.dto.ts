/**
 * Inbox Task DTOs — Phase 2 Input Contracts
 *
 * Clean input types for adapter and service method boundaries.
 * Independent of SAP request format and frontend request shape.
 */

/** Input for listing tasks (pending or approved). */
export interface GetTasksInput {
    pagination?: {
        top?: number;
        skip?: number;
    };
}

/** Input for retrieving task detail or information. */
export interface GetTaskDetailInput {
    instanceId: string;
}

/** Input for executing a task decision (approve/reject). */
export interface ExecuteDecisionInput {
    instanceId: string;
    decisionKey: string;
    comment?: string;
}

/** Input for forwarding a task. */
export interface ForwardTaskInput {
    instanceId: string;
    forwardTo: string;
}

/** Input for adding a comment to a task. */
export interface AddCommentInput {
    instanceId: string;
    text: string;
}

/** Input for streaming attachment content. */
export interface StreamAttachmentInput {
    instanceId: string;
    attachmentId: string;
}

/** Input for uploading an attachment. */
export interface AddAttachmentInput {
    instanceId: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
    sapOrigin?: string;
}
