/**
 * TanStack Query hooks for reading Inbox server state.
 *
 * Responsibilities:
 * - Bind API calls to query keys
 * - Define staleTime / gcTime / retry / enabled
 * - Show toast on errors (one-shot, deduplicated)
 *
 * Must NOT:
 * - Contain mutation logic
 * - Own page-level UI state
 */
import { useEffect, useRef } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { inboxApi } from '@/services/inbox/inbox.api';
import { toast } from 'sonner';
import { STALE, REFRESH } from '@/pages/Inbox/utils/constants';
import { isSapUserMappingMissing, extractErrorMessage } from '@/pages/Inbox/utils/predicates';
import { inboxKeys } from './inboxKeys';

// ─── Helpers ───────────────────────────────────────────────

function shouldPausePolling(): boolean {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function listRefetchInterval(error: unknown): number | false {
    if (isSapUserMappingMissing(error)) return false;
    if (shouldPausePolling()) return false;
    return REFRESH.LIST_MS;
}

/**
 * Deduplicated error toast — prevents the same message from showing twice.
 */
function useErrorToast(error: unknown, fallback: string) {
    const lastRef = useRef<string | null>(null);
    useEffect(() => {
        if (!error) return;
        const message = extractErrorMessage(error, fallback);
        if (lastRef.current === message) return;
        lastRef.current = message;
        toast.error(message);
    }, [error, fallback]);
}

// ─── useTasks ──────────────────────────────────────────────
export function useTasks(options?: { enabled?: boolean; top?: number; skip?: number }) {
    const pagination = options?.top != null || options?.skip != null
        ? { top: options?.top, skip: options?.skip }
        : undefined;

    const query = useQuery({
        queryKey: inboxKeys.tasks(pagination),
        queryFn: () => inboxApi.getTasks(pagination),
        staleTime: STALE.LIST,
        enabled: options?.enabled !== false,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: true,
        refetchInterval: (q) => listRefetchInterval(q.state.error),
        retry: (failureCount, error: any) => {
            if (isSapUserMappingMissing(error)) return false;
            return failureCount < 1;
        },
    });

    useErrorToast(query.error, 'Failed to load tasks');
    return query;
}

// ─── useApprovedTasks ──────────────────────────────────────
export function useApprovedTasks(options?: { enabled?: boolean; top?: number; skip?: number }) {
    const pagination = options?.top != null || options?.skip != null
        ? { top: options?.top, skip: options?.skip }
        : undefined;

    const query = useQuery({
        queryKey: inboxKeys.approvedTasks(pagination),
        queryFn: () => inboxApi.getApprovedTasks(pagination),
        staleTime: STALE.LIST,
        enabled: options?.enabled !== false,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: true,
        refetchInterval: (q) => listRefetchInterval(q.state.error),
        retry: (failureCount, error: any) => {
            if (isSapUserMappingMissing(error)) return false;
            return failureCount < 1;
        },
    });

    useErrorToast(query.error, 'Failed to load approved tasks');
    return query;
}

// ─── useTaskInformation ────────────────────────────────────
export function useTaskInformation(
    instanceId: string | null,
    options?: {
        enabled?: boolean;
        hints?: { sapOrigin?: string; documentId?: string; businessObjectType?: string };
    }
) {
    const query = useQuery({
        queryKey: inboxKeys.taskInformation(instanceId || ''),
        queryFn: () => inboxApi.getTaskInformation(instanceId!, options?.hints),
        enabled: !!instanceId && options?.enabled !== false,
        staleTime: STALE.INFORMATION,
    });

    useErrorToast(query.error, 'Failed to load task information');
    return query;
}

// ─── useTaskDetail ─────────────────────────────────────────
export function useTaskDetail(instanceId: string | null, options?: { enabled?: boolean }) {
    const query = useQuery({
        queryKey: inboxKeys.taskDetail(instanceId || ''),
        queryFn: () => inboxApi.getTaskDetail(instanceId!),
        enabled: !!instanceId && options?.enabled !== false,
        staleTime: STALE.DETAIL,
    });

    useErrorToast(query.error, 'Failed to load task detail');
    return query;
}

// ─── useWorkflowApprovalTree ───────────────────────────────
export function useWorkflowApprovalTree(
    instanceId: string | null,
    documentId?: string,
    sapOrigin?: string,
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: inboxKeys.taskWorkflow(instanceId || '', { documentId, sapOrigin }),
        queryFn: () => inboxApi.getWorkflowApprovalTree(instanceId!, documentId, sapOrigin),
        enabled: !!instanceId && !!documentId && options?.enabled !== false,
        staleTime: STALE.WORKFLOW,
    });
}
