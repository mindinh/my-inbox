import axiosInstance from '../core/axiosInstance';
import type {
    TaskListResponse,
    TaskDetailResponse,
    TaskActionResponse,
    DecisionRequest,
    ForwardRequest,
    WorkflowApprovalTreeResponse,
} from './inbox.types';

// Keep API paths relative so Work Zone managed approuter can resolve app-local routes.
const BASE_URL = 'api/inbox';

/**
 * Inbox API — All backend calls for the inbox feature.
 * Uses the existing axiosInstance which handles CSRF tokens, auth, and error retries.
 */
export const inboxApi = {
    /**
     * Get tasks for the current user (with optional pagination).
     */
    getTasks: async (params?: { top?: number; skip?: number }): Promise<TaskListResponse> => {
        const query = new URLSearchParams();
        if (params?.top != null) query.set('top', String(params.top));
        if (params?.skip != null) query.set('skip', String(params.skip));
        const qs = query.toString();
        const { data } = await axiosInstance.get<TaskListResponse>(
            `${BASE_URL}/tasks${qs ? `?${qs}` : ''}`
        );
        return data;
    },

    /**
     * Get approved tasks for the current user (with optional pagination).
     */
    getApprovedTasks: async (params?: { top?: number; skip?: number }): Promise<TaskListResponse> => {
        const query = new URLSearchParams();
        if (params?.top != null) query.set('top', String(params.top));
        if (params?.skip != null) query.set('skip', String(params.skip));
        const qs = query.toString();
        const { data } = await axiosInstance.get<TaskListResponse>(
            `${BASE_URL}/tasks/approved${qs ? `?${qs}` : ''}`
        );
        return data;
    },

    /**
     * Get full detail for a single task.
     */
    getTaskDetail: async (instanceId: string): Promise<TaskDetailResponse> => {
        const { data } = await axiosInstance.get<TaskDetailResponse>(
            `${BASE_URL}/tasks/${encodeURIComponent(instanceId)}`
        );
        return data;
    },

    /**
     * Get approval workflow tree for PR tasks.
     */
    getWorkflowApprovalTree: async (
        instanceId: string, 
        documentId?: string, 
        sapOrigin?: string
    ): Promise<WorkflowApprovalTreeResponse> => {
        let url = `${BASE_URL}/tasks/${encodeURIComponent(instanceId)}/workflow-approval-tree`;
        const params = new URLSearchParams();
        if (documentId) params.append('documentId', documentId);
        if (sapOrigin) params.append('sapOrigin', sapOrigin);
        const query = params.toString();
        if (query) url += `?${query}`;

        const { data } = await axiosInstance.get<WorkflowApprovalTreeResponse>(url);
        return data;
    },

    /**
     * Execute a decision on a task (approve, reject, etc.)
     */
    executeDecision: async (
        instanceId: string,
        request: DecisionRequest
    ): Promise<TaskActionResponse> => {
        const { data } = await axiosInstance.post<TaskActionResponse>(
            `${BASE_URL}/tasks/${encodeURIComponent(instanceId)}/decision`,
            request
        );
        return data;
    },

    /**
     * Claim a task for the current user.
     */
    claimTask: async (instanceId: string): Promise<TaskActionResponse> => {
        const { data } = await axiosInstance.post<TaskActionResponse>(
            `${BASE_URL}/tasks/${encodeURIComponent(instanceId)}/claim`
        );
        return data;
    },

    /**
     * Release a claimed task.
     */
    releaseTask: async (instanceId: string): Promise<TaskActionResponse> => {
        const { data } = await axiosInstance.post<TaskActionResponse>(
            `${BASE_URL}/tasks/${encodeURIComponent(instanceId)}/release`
        );
        return data;
    },

    /**
     * Forward a task to another user.
     */
    forwardTask: async (
        instanceId: string,
        request: ForwardRequest
    ): Promise<TaskActionResponse> => {
        const { data } = await axiosInstance.post<TaskActionResponse>(
            `${BASE_URL}/tasks/${encodeURIComponent(instanceId)}/forward`,
            request
        );
        return data;
    },

    /**
     * Add a comment to a task.
     */
    addComment: async (
        instanceId: string,
        text: string,
        context?: { sapOrigin?: string; documentId?: string; businessObjectType?: string }
    ): Promise<TaskActionResponse> => {
        const { data } = await axiosInstance.post<TaskActionResponse>(
            `${BASE_URL}/tasks/${encodeURIComponent(instanceId)}/comments`,
            { text, _context: context }
        );
        return data;
    },

    /**
     * Upload an attachment to a task.
     * Sends the raw file binary with the filename in the Slug header.
     */
    addAttachment: async (
        instanceId: string,
        file: File,
        sapOrigin?: string
    ): Promise<TaskActionResponse> => {
        const buffer = await file.arrayBuffer();
        const headers: Record<string, string> = {
            'Content-Type': file.type || 'application/octet-stream',
            Slug: encodeURIComponent(file.name),
        };
        if (sapOrigin) {
            headers['x-sap-origin'] = sapOrigin;
        }

        const { data } = await axiosInstance.post<TaskActionResponse>(
            `${BASE_URL}/tasks/${encodeURIComponent(instanceId)}/attachments`,
            buffer,
            { headers }
        );
        return data;
    },

    /**
     * Get the URL for streaming attachment binary content.
     * Use disposition='attachment' for download, 'inline' (default) for preview.
     */
    getAttachmentContentUrl: (
        instanceId: string,
        attachmentId: string,
        disposition: 'inline' | 'attachment' = 'inline'
    ): string => {
        return `${BASE_URL}/tasks/${encodeURIComponent(instanceId)}/attachments/${encodeURIComponent(attachmentId)}/content?disposition=${disposition}`;
    },
};
