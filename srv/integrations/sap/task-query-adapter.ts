/**
 * Task Query Adapter — Phase 2
 *
 * Capability-focused adapter for SAP task list retrieval.
 * Owns: fetchTasks, fetchApprovedTasks
 *
 * Responsibilities:
 *   - Delegates transport to ISapTaskClient
 *   - Maps raw SAP responses to internal domain models via task-mapper
 *   - Normalizes errors via task-error-mapper
 *   - Emits module-aware diagnostic logs (Workstream K)
 *
 * Rules:
 *   - No business logic (no context enrichment, no factsheet data)
 *   - No router/controller dependencies
 *   - Does not own the SAP HTTP transport layer
 */

import { ISapTaskClient } from '../../inbox/clients/sap-task-client';
import { normalizeTasks } from './task-mapper';
import { classifyAndWrapError } from './task-error-mapper';
import type { AdapterContext } from './task-transport-utils';
import { withAdapterLogging } from './task-transport-utils';
import type { TaskQueryResult } from '../../domain/inbox/inbox-task.models';

const MODULE = 'query';

export class TaskQueryAdapter {
    constructor(private readonly sapClient: ISapTaskClient) {}

    /**
     * Fetch pending tasks for the given user context.
     * Returns normalized task list and total count for pagination.
     */
    async fetchTasks(
        context: AdapterContext,
        pagination?: { top?: number; skip?: number }
    ): Promise<TaskQueryResult> {
        return withAdapterLogging(MODULE, 'fetchTasks', async () => {
            try {
                const { results, totalCount } = await this.sapClient.fetchTasks(
                    context.sapUser,
                    context.userJwt,
                    pagination
                );
                const items = normalizeTasks(results);
                return { items, total: totalCount };
            } catch (error) {
                throw classifyAndWrapError(error, 'task.query.fetchTasks');
            }
        });
    }

    /**
     * Fetch approved/completed tasks for the given user context.
     * Returns normalized task list and total count for pagination.
     */
    async fetchApprovedTasks(
        context: AdapterContext,
        pagination?: { top?: number; skip?: number }
    ): Promise<TaskQueryResult> {
        return withAdapterLogging(MODULE, 'fetchApprovedTasks', async () => {
            try {
                const { results, totalCount } = await this.sapClient.fetchApprovedTasks(
                    context.sapUser,
                    context.userJwt,
                    pagination
                );
                const items = normalizeTasks(results);
                return { items, total: totalCount };
            } catch (error) {
                throw classifyAndWrapError(error, 'task.query.fetchApprovedTasks');
            }
        });
    }
}
