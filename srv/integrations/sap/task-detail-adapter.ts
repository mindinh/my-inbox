/**
 * Task Detail Adapter — Phase 2
 *
 * Capability-focused adapter for SAP task detail retrieval.
 * Owns: fetchTaskDetailBundle, fetchTaskInformation, streamAttachmentContent
 *
 * Responsibilities:
 *   - Orchestrates multi-step SAP detail fetching (expand fallbacks, parallel queries)
 *   - Maps raw SAP responses to internal domain models via task-mapper
 *   - Resolves custom attribute definitions (from expand or fallback)
 *   - Normalizes errors via task-error-mapper
 *   - Emits module-aware diagnostic logs (Workstream K)
 *
 * Rules:
 *   - No business logic (no context resolution, no enrichment)
 *   - No router/controller dependencies
 *   - Does not own the SAP HTTP transport layer
 */

import { ISapTaskClient } from '../../inbox/clients/sap-task-client';
import type { SapCustomAttributeDefinitionRaw } from '../../types';
import {
    normalizeTask,
    normalizeDecisions,
    normalizeDescription,
    normalizeCustomAttributes,
    normalizeTaskObjects,
} from './task-mapper';
import { classifyAndWrapError } from './task-error-mapper';
import type { AdapterContext } from './task-transport-utils';
import { decodeURIComponentSafeDeep, withAdapterLogging } from './task-transport-utils';
import type {
    TaskDetailBundle,
    TaskInformationBundle,
    TaskOverviewBundle,
    AttachmentStreamResult,
} from '../../domain/inbox/inbox-task.models';

const MODULE = 'detail';

// ─── CustomAttributeDefinition In-Memory Cache ────────────
// TaskDefinition metadata (labels, types, rank) is essentially static.
// Cache by TaskDefinitionID to avoid a redundant SAP round-trip on every
// detail load (~500ms saved per request after first hit).

const ATTR_DEF_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

interface AttrDefCacheEntry {
    data: SapCustomAttributeDefinitionRaw[];

    expiresAt: number;
}

const attrDefCache = new Map<string, AttrDefCacheEntry>();

function getCachedAttrDefs(taskDefinitionId: string): SapCustomAttributeDefinitionRaw[] | undefined {
    const entry = attrDefCache.get(taskDefinitionId);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        attrDefCache.delete(taskDefinitionId);
        return undefined;
    }
    return entry.data;
}

function setCachedAttrDefs(taskDefinitionId: string, data: SapCustomAttributeDefinitionRaw[]): void {
    // Evict if cache is too large (unlikely, but guards memory)
    if (attrDefCache.size >= 100) {
        const firstKey = attrDefCache.keys().next().value;
        if (firstKey) attrDefCache.delete(firstKey);
    }
    attrDefCache.set(taskDefinitionId, { data, expiresAt: Date.now() + ATTR_DEF_CACHE_TTL_MS });
}

/** Optional hints the caller can provide to skip redundant SAP lookups. */
export interface TaskDetailClientHints {
    /** If known from the task list, skip the initial origin-lookup fetch. */
    sapOrigin?: string;
    /** If known from the task list, enables parallel PR/PO enrichment. */
    documentId?: string;
    /** e.g. 'PR' | 'PO' — enables parallel enrichment at the service layer. */
    businessObjectType?: string;
}

export class TaskDetailAdapter {
    constructor(private readonly sapClient: ISapTaskClient) { }

    /**
     * Fetch full task detail with all navigation properties resolved.
     * Handles custom attribute definition resolution (expand → fallback).
     *
     * Returns a TaskDetailBundle that the business service can enrich
     * with business context without knowing SAP payload shapes.
     */
    async fetchTaskDetailBundle(
        context: AdapterContext,
        instanceId: string
    ): Promise<TaskDetailBundle> {
        return withAdapterLogging(MODULE, 'fetchTaskDetailBundle', async () => {
            try {
                const rawTask = await this.sapClient.fetchTaskDetailBundle(
                    context.sapUser,
                    instanceId,
                    context.userJwt
                );

                // Resolve custom attribute definitions —
                // prefer from inline expand, fallback to separate fetch
                const attrDefinitionsFromExpand =
                    rawTask.TaskDefinitionData?.CustomAttributeDefinitionData?.results || [];
                const attrDefinitions =
                    attrDefinitionsFromExpand.length > 0
                        ? attrDefinitionsFromExpand
                        : rawTask.TaskDefinitionID
                            ? await this.sapClient
                                .fetchCustomAttributeDefinitions(
                                    context.sapUser,
                                    rawTask.TaskDefinitionID,
                                    context.userJwt
                                )
                                .catch(() => [])
                            : [];

                return {
                    task: normalizeTask(rawTask),
                    decisions: normalizeDecisions(rawTask.DecisionOptions?.results || []),
                    description: normalizeDescription(rawTask.Description || null),
                    customAttributes: normalizeCustomAttributes(
                        rawTask.CustomAttributeData?.results || [],
                        attrDefinitions
                    ),
                    taskObjects: normalizeTaskObjects(rawTask.TaskObjects?.results || []),
                    comments: [],
                    processingLogs: [],
                    workflowLogs: [],
                    attachments: [], // Attachments decoupled — fetched via standalone PR API
                    sapIdentifiers: {
                        instanceId,
                        sapOrigin: rawTask.SAP__Origin,
                        taskDefinitionId: rawTask.TaskDefinitionID,
                    },
                };
            } catch (error) {
                throw classifyAndWrapError(error, 'task.detail.fetchTaskDetailBundle');
            }
        });
    }

    /**
     * Fetch lightweight task information for fast first render.
     *
     * Accepts optional `hints` from the frontend (sapOrigin, documentId)
     * to eliminate redundant SAP round-trips:
     *   - hints.sapOrigin  → skip origin-lookup fetch (Chặng 1)
     *   - CustomAttributeDefinition results are cached in-memory (Chặng 3)
     */
    async fetchTaskInformation(
        context: AdapterContext,
        instanceId: string,
        hints?: TaskDetailClientHints
    ): Promise<TaskInformationBundle> {
        return withAdapterLogging(MODULE, 'fetchTaskInformation', async () => {
            try {
                const rawTask = await this.sapClient.fetchTaskDetailBundle(
                    context.sapUser,
                    instanceId,
                    context.userJwt,
                    hints?.sapOrigin ? { sapOrigin: hints.sapOrigin } : undefined
                );

                // Resolve attribute definitions: cache → SAP fetch
                let attrDefinitions: SapCustomAttributeDefinitionRaw[] = [];
                if (rawTask.TaskDefinitionID) {
                    const cached = getCachedAttrDefs(rawTask.TaskDefinitionID);
                    if (cached) {
                        attrDefinitions = cached;
                        console.log(`[TaskDetailAdapter] AttrDef cache hit for ${rawTask.TaskDefinitionID}`);
                    } else {
                        attrDefinitions = await this.sapClient
                            .fetchCustomAttributeDefinitions(
                                context.sapUser,
                                rawTask.TaskDefinitionID,
                                context.userJwt
                            )
                            .catch(() => []);
                        setCachedAttrDefs(rawTask.TaskDefinitionID, attrDefinitions);
                    }
                }

                return {
                    task: normalizeTask(rawTask),
                    decisions: normalizeDecisions(rawTask.DecisionOptions?.results || []),
                    description: normalizeDescription(rawTask.Description || null),
                    customAttributes: normalizeCustomAttributes(
                        rawTask.CustomAttributeData?.results || [],
                        attrDefinitions
                    ),
                    taskObjects: normalizeTaskObjects(rawTask.TaskObjects?.results || []),
                    sapIdentifiers: {
                        instanceId,
                        sapOrigin: rawTask.SAP__Origin,
                        taskDefinitionId: rawTask.TaskDefinitionID,
                    },
                };
            } catch (error) {
                throw classifyAndWrapError(error, 'task.detail.fetchTaskInformation');
            }
        });
    }

    /**
     * Fetch ultra-lightweight task overview for the fastest possible first render.
     *
     * Uses the overview-only SAP $batch (3 segments instead of 5) which excludes
     * the heavy TaskObjects and Attachments queries. Those segments are loaded
     * in the background by the frontend after the overview renders.
     */
    async fetchTaskOverview(
        context: AdapterContext,
        instanceId: string,
        hints?: TaskDetailClientHints
    ): Promise<TaskOverviewBundle> {
        return withAdapterLogging(MODULE, 'fetchTaskOverview', async () => {
            try {
                const rawTask = await this.sapClient.fetchTaskOverviewBundle(
                    context.sapUser,
                    instanceId,
                    context.userJwt,
                    hints?.sapOrigin ? { sapOrigin: hints.sapOrigin } : undefined
                );

                // Resolve attribute definitions: cache → SAP fetch
                let attrDefinitions: SapCustomAttributeDefinitionRaw[] = [];
                if (rawTask.TaskDefinitionID) {
                    const cached = getCachedAttrDefs(rawTask.TaskDefinitionID);
                    if (cached) {
                        attrDefinitions = cached;
                        console.log(`[TaskDetailAdapter] AttrDef cache hit for ${rawTask.TaskDefinitionID}`);
                    } else {
                        attrDefinitions = await this.sapClient
                            .fetchCustomAttributeDefinitions(
                                context.sapUser,
                                rawTask.TaskDefinitionID,
                                context.userJwt
                            )
                            .catch(() => []);
                        setCachedAttrDefs(rawTask.TaskDefinitionID, attrDefinitions);
                    }
                }

                return {
                    task: normalizeTask(rawTask),
                    decisions: normalizeDecisions(rawTask.DecisionOptions?.results || []),
                    description: normalizeDescription(rawTask.Description || null),
                    customAttributes: normalizeCustomAttributes(
                        rawTask.CustomAttributeData?.results || [],
                        attrDefinitions
                    ),
                    sapIdentifiers: {
                        instanceId,
                        sapOrigin: rawTask.SAP__Origin,
                        taskDefinitionId: rawTask.TaskDefinitionID,
                    },
                };
            } catch (error) {
                throw classifyAndWrapError(error, 'task.detail.fetchTaskOverview');
            }
        });
    }

    /**
     * Fetch raw attachment binary content.
     * Resolves attachment metadata from the task bundle, matches by ID,
     * then fetches the binary stream.
     *
     * Note: Business logic (size guard, MIME inference, extension cleanup)
     * remains in the service layer.
     */
    async streamAttachmentContent(
        context: AdapterContext,
        instanceId: string,
        attachmentId: string
    ): Promise<AttachmentStreamResult> {
        return withAdapterLogging(MODULE, 'streamAttachmentContent', async () => {
            try {
                const normalizedAttachmentId = decodeURIComponentSafeDeep(attachmentId);

                // Fetch attachment metadata to resolve SAP__Origin and file info
                const rawTask = await this.sapClient.fetchTaskDetailBundle(
                    context.sapUser,
                    instanceId,
                    context.userJwt
                );
                const origin = rawTask.SAP__Origin || process.env.SAP_TASK_ORIGIN || 'LOCAL';
                const attachments = rawTask.Attachments?.results || [];

                const matchingAtt = attachments.find((a) => {
                    if (a.ID === normalizedAttachmentId || a.ID === attachmentId) return true;
                    return decodeURIComponentSafeDeep(a.ID) === normalizedAttachmentId;
                });
                const fileName = matchingAtt?.FileName || matchingAtt?.FileDisplayName;
                const attachmentMetadataUri = matchingAtt?.__metadata?.uri;

                const { data, contentType } = await this.sapClient.fetchAttachmentContent(
                    context.sapUser,
                    instanceId,
                    normalizedAttachmentId,
                    origin,
                    attachmentMetadataUri,
                    context.userJwt
                );

                return { data, contentType, fileName };
            } catch (error) {
                throw classifyAndWrapError(error, 'task.detail.streamAttachmentContent');
            }
        });
    }
}
