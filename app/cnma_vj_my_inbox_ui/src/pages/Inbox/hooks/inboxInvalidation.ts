/**
 * Centralized query invalidation policies for the Inbox feature.
 *
 * Each mutation in useInbox.ts should call the appropriate policy function
 * instead of manually listing queryClient.invalidateQueries() calls.
 * This ensures consistency and makes it trivial to adjust invalidation
 * scope when the data model changes.
 */
import type { QueryClient } from '@tanstack/react-query';
import { inboxKeys } from './inboxKeys';

// ─── Policy: After a decision (approve / reject) ──────────
// Broadest scope — both task lists shift, detail & workflow are stale.
export function invalidateAfterDecision(
    queryClient: QueryClient,
    instanceId: string,
) {
    queryClient.invalidateQueries({ queryKey: inboxKeys.tasksPrefix() });
    queryClient.invalidateQueries({ queryKey: inboxKeys.approvedTasksPrefix() });
    queryClient.invalidateQueries({ queryKey: inboxKeys.taskInformation(instanceId) });
    queryClient.invalidateQueries({ queryKey: inboxKeys.taskDetail(instanceId) });
    queryClient.invalidateQueries({ queryKey: inboxKeys.taskWorkflowPrefix(instanceId) });
}

// ─── Policy: After forwarding a task ───────────────────────
// Pending list changes; approved list is not affected.
export function invalidateAfterForward(
    queryClient: QueryClient,
    instanceId: string,
) {
    queryClient.invalidateQueries({ queryKey: inboxKeys.tasksPrefix() });
    queryClient.invalidateQueries({ queryKey: inboxKeys.taskInformation(instanceId) });
    queryClient.invalidateQueries({ queryKey: inboxKeys.taskDetail(instanceId) });
    queryClient.invalidateQueries({ queryKey: inboxKeys.taskWorkflowPrefix(instanceId) });
}

// ─── Policy: After adding a comment ───────────────────────
// Only the detail/information views are affected, lists don't change.
export function invalidateAfterComment(
    queryClient: QueryClient,
    instanceId: string,
) {
    queryClient.invalidateQueries({ queryKey: inboxKeys.taskInformation(instanceId) });
    queryClient.invalidateQueries({ queryKey: inboxKeys.taskDetail(instanceId) });
    queryClient.invalidateQueries({ queryKey: inboxKeys.taskWorkflowPrefix(instanceId) });
}

// ─── Policy: After uploading an attachment ─────────────────
// Only detail/information views need to refresh to show the new file.
export function invalidateAfterAttachment(
    queryClient: QueryClient,
    instanceId: string,
) {
    queryClient.invalidateQueries({ queryKey: inboxKeys.taskInformation(instanceId) });
    queryClient.invalidateQueries({ queryKey: inboxKeys.taskDetail(instanceId) });
}

// ─── Policy: After uploading a PR attachment ─────────────────
export function invalidatePrAttachments(
    queryClient: QueryClient,
    documentNumber: string,
) {
    queryClient.invalidateQueries({ queryKey: inboxKeys.prAttachments(documentNumber) });
}
