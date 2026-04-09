import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '@/services/inbox/inbox.api';
import type { DecisionRequest, ForwardRequest, DecisionRequestContext } from '@/services/inbox/inbox.types';
import { toast } from 'sonner';

// ─── Shared staleTime constants ────────────────────────────
const STALE = {
    LIST: 30_000,       // task lists change frequently
    DETAIL: 15_000,     // detail changes after actions
    WORKFLOW: 60_000,   // approval tree is relatively stable
};

// ─── Query Keys ────────────────────────────────────────────
export const inboxKeys = {
    all: ['inbox'] as const,
    tasksPrefix: () => [...inboxKeys.all, 'tasks'] as const,
    tasks: (pagination?: { top?: number; skip?: number }) =>
        [...inboxKeys.all, 'tasks', pagination ?? {}] as const,
    approvedTasksPrefix: () => [...inboxKeys.all, 'approvedTasks'] as const,
    approvedTasks: (pagination?: { top?: number; skip?: number }) =>
        [...inboxKeys.all, 'approvedTasks', pagination ?? {}] as const,
    taskDetail: (id: string) => [...inboxKeys.all, 'task', id] as const,
};

// ─── Helpers ───────────────────────────────────────────────
function isSapUserMappingMissing(error: any): boolean {
    return error?.response?.data?.code === 'SAP_USER_MAPPING_MISSING';
}

function extractErrorMessage(error: any, fallback: string): string {
    return error?.response?.data?.error || error?.message || fallback;
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
        refetchInterval: (q) => {
            const error = q.state.error as any;
            return isSapUserMappingMissing(error) ? false : 60_000;
        },
        retry: (failureCount, error: any) => {
            if (isSapUserMappingMissing(error)) return false;
            return failureCount < 1;
        },
    });

    const lastErrorRef = useRef<string | null>(null);
    useEffect(() => {
        if (!query.error) return;
        const message = extractErrorMessage(query.error, 'Failed to load tasks');
        if (lastErrorRef.current === message) return;
        lastErrorRef.current = message;
        toast.error(message);
    }, [query.error]);

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
        refetchInterval: (q) => {
            const error = q.state.error as any;
            return isSapUserMappingMissing(error) ? false : 60_000;
        },
        retry: (failureCount, error: any) => {
            if (isSapUserMappingMissing(error)) return false;
            return failureCount < 1;
        },
    });

    const lastErrorRef = useRef<string | null>(null);
    useEffect(() => {
        if (!query.error) return;
        const message = extractErrorMessage(query.error, 'Failed to load approved tasks');
        if (lastErrorRef.current === message) return;
        lastErrorRef.current = message;
        toast.error(message);
    }, [query.error]);

    return query;
}

// ─── useTaskDetail ─────────────────────────────────────────
export function useTaskDetail(instanceId: string | null) {
    const query = useQuery({
        queryKey: inboxKeys.taskDetail(instanceId || ''),
        queryFn: () => inboxApi.getTaskDetail(instanceId!),
        enabled: !!instanceId,
        staleTime: STALE.DETAIL,
    });

    const lastErrorRef = useRef<string | null>(null);
    useEffect(() => {
        if (!query.error) return;
        const message = extractErrorMessage(query.error, 'Failed to load task detail');
        if (lastErrorRef.current === message) return;
        lastErrorRef.current = message;
        toast.error(message);
    }, [query.error]);

    return query;
}

// ─── useDecision ───────────────────────────────────────────
export function useDecision() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            instanceId,
            request,
        }: {
            instanceId: string;
            request: DecisionRequest;
        }) => inboxApi.executeDecision(instanceId, request),

        onSuccess: (data) => {
            toast.success(data.message);
            // Invalidate both lists so counts stay accurate after approve/reject
            queryClient.invalidateQueries({ queryKey: inboxKeys.tasksPrefix() });
            queryClient.invalidateQueries({ queryKey: inboxKeys.approvedTasksPrefix() });
        },
        onError: (error: any) => {
            const message = error?.response?.data?.error || error.message || 'Decision failed';
            toast.error(message);
        },
    });
}

// ─── useClaim ──────────────────────────────────────────────
export function useClaim() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (instanceId: string) => inboxApi.claimTask(instanceId),
        onSuccess: (data, instanceId) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: inboxKeys.tasksPrefix() });
            queryClient.invalidateQueries({ queryKey: inboxKeys.taskDetail(instanceId) });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Claim failed');
        },
    });
}

// ─── useRelease ────────────────────────────────────────────
export function useRelease() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (instanceId: string) => inboxApi.releaseTask(instanceId),
        onSuccess: (data, instanceId) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: inboxKeys.tasksPrefix() });
            queryClient.invalidateQueries({ queryKey: inboxKeys.taskDetail(instanceId) });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Release failed');
        },
    });
}

// ─── useForward ────────────────────────────────────────────
export function useForward() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            instanceId,
            request,
        }: {
            instanceId: string;
            request: ForwardRequest;
        }) => inboxApi.forwardTask(instanceId, request),
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: inboxKeys.tasksPrefix() });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Forward failed');
        },
    });
}

// ─── useAddComment ─────────────────────────────────────────
export function useAddComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            instanceId,
            text,
            context,
        }: {
            instanceId: string;
            text: string;
            context?: DecisionRequestContext;
        }) => inboxApi.addComment(instanceId, text, context),
        onSuccess: (data, variables) => {
            toast.success(data.message || 'Comment added.');
            queryClient.invalidateQueries({ queryKey: inboxKeys.taskDetail(variables.instanceId) });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to add comment');
        },
    });
}

// ─── useAddAttachment ──────────────────────────────────────
export function useAddAttachment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            instanceId,
            file,
            sapOrigin,
        }: {
            instanceId: string;
            file: File;
            sapOrigin?: string;
        }) => inboxApi.addAttachment(instanceId, file, sapOrigin),
        onSuccess: (data, variables) => {
            toast.success(data.message || 'Attachment uploaded.');
            queryClient.invalidateQueries({ queryKey: inboxKeys.taskDetail(variables.instanceId) });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to upload attachment');
        },
    });
}
