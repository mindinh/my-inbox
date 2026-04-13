/**
 * Centralized TanStack Query key factory for the Inbox feature.
 *
 * Single source of truth for all query keys — used by queries, mutations,
 * and invalidation policies alike. Follows the factory pattern recommended
 * by TanStack Query docs.
 */

export const inboxKeys = {
    all: ['inbox'] as const,

    // ─── Dashboard ─────────────────────────────────────────
    dashboard: () => [...inboxKeys.all, 'dashboard'] as const,

    // ─── Task Lists ────────────────────────────────────────
    tasksPrefix: () => [...inboxKeys.all, 'tasks'] as const,
    tasks: (pagination?: { top?: number; skip?: number }) =>
        [...inboxKeys.all, 'tasks', pagination ?? {}] as const,

    approvedTasksPrefix: () => [...inboxKeys.all, 'approvedTasks'] as const,
    approvedTasks: (pagination?: { top?: number; skip?: number }) =>
        [...inboxKeys.all, 'approvedTasks', pagination ?? {}] as const,

    // ─── Task Detail ───────────────────────────────────────
    taskInformation: (id: string) => [...inboxKeys.all, 'task-information', id] as const,
    taskDetail: (id: string) => [...inboxKeys.all, 'task', id] as const,

    // ─── Workflow ──────────────────────────────────────────
    taskWorkflowPrefix: (id: string) => [...inboxKeys.all, 'workflow', id] as const,
    taskWorkflow: (
        id: string,
        params?: { documentId?: string; sapOrigin?: string }
    ) => [...inboxKeys.all, 'workflow', id, params ?? {}] as const,
};
