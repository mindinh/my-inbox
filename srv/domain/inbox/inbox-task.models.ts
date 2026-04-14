/**
 * Inbox Task Internal Domain Models — Phase 2
 *
 * Stable internal representations independent of raw SAP payload shapes.
 * Business services use these models; adapters produce them.
 *
 * Convention:
 *   - InboxTaskSummary = list-level task representation
 *   - TaskDetailBundle = full detail data from a single task
 *   - TaskInformationBundle = lightweight detail (no heavy tabs)
 *   - SAPTaskIdentifiers = SAP-side IDs needed for downstream operations
 */

import type {
    InboxTask,
    Decision,
    TaskDescription,
    CustomAttribute,
    TaskObject,
    TaskComment,
    ProcessingLog,
    WorkflowLog,
    TaskAttachment,
} from '../../types';

/** Alias for clarity: an InboxTask used in list context */
export type InboxTaskSummary = InboxTask;

/**
 * SAP-side identifiers required by adapters to locate a task.
 * Passed downstream for business context resolution and enrichment.
 */
export interface SAPTaskIdentifiers {
    instanceId: string;
    sapOrigin?: string;
    taskDefinitionId?: string;
}

/** Result of a task decision (approve/reject/forward). */
export interface TaskDecisionResult {
    success: boolean;
    message: string;
}

/** Result of a task list query. */
export interface TaskQueryResult {
    items: InboxTask[];
    total: number;
}

/**
 * Full detail bundle produced by the detail adapter.
 * Contains all normalized navigation property data for a single task.
 */
export interface TaskDetailBundle {
    task: InboxTask;
    decisions: Decision[];
    description?: TaskDescription;
    customAttributes: CustomAttribute[];
    taskObjects: TaskObject[];
    comments: TaskComment[];
    processingLogs: ProcessingLog[];
    workflowLogs: WorkflowLog[];
    attachments: TaskAttachment[];
    /** SAP identifiers needed for downstream business context resolution */
    sapIdentifiers: SAPTaskIdentifiers;
}

/**
 * Lightweight task information bundle (excludes heavy tab payloads).
 * Used for fast first-render of the detail pane.
 */
export interface TaskInformationBundle {
    task: InboxTask;
    decisions: Decision[];
    description?: TaskDescription;
    customAttributes: CustomAttribute[];
    taskObjects: TaskObject[];
    /** SAP identifiers needed for downstream business context resolution */
    sapIdentifiers: SAPTaskIdentifiers;
}

/**
 * Ultra-lightweight overview bundle for fastest first render.
 * Excludes taskObjects entirely — they are fetched in the background.
 */
export interface TaskOverviewBundle {
    task: InboxTask;
    decisions: Decision[];
    description?: TaskDescription;
    customAttributes: CustomAttribute[];
    /** SAP identifiers needed for downstream business context resolution */
    sapIdentifiers: SAPTaskIdentifiers;
}

/** Raw attachment streaming result from detail adapter. */
export interface AttachmentStreamResult {
    data: Buffer;
    contentType: string;
    fileName?: string;
}

/** Result of adding a comment via SAP. */
export interface CommentResult {
    commentId: string;
}
