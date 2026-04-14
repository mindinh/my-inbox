import axiosInstance from '../core/axiosInstance';
import type {
    TaskListResponse,
    TaskDetailResponse,
    TaskActionResponse,
    TaskAttachment,
    DecisionRequest,
    ForwardRequest,
    WorkflowApprovalTreeResponse,
    DashboardResponse,
} from './inbox.types';

// Keep API paths relative so Work Zone managed approuter can resolve app-local routes.
const BASE_URL = 'api/inbox';

/** Shape returned by GET /api/inbox/me */
export interface UserInfo {
    id: string;
    sapUser?: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    email?: string;
}

/**
 * Inbox API — All backend calls for the inbox feature.
 * Uses the existing axiosInstance which handles CSRF tokens, auth, and error retries.
 */
export const inboxApi = {
    /**
     * Get current user display info (name, email) from JWT claims.
     */
    getCurrentUser: async (): Promise<UserInfo> => {
        const { data } = await axiosInstance.get<UserInfo>(`${BASE_URL}/me`);
        return data;
    },

    /**
     * Get dashboard data for the current user.
     * Returns all task records from the ZI_PR_DASH_BOARD entity.
     */
    getDashboard: async (): Promise<DashboardResponse> => {
        const { data } = await axiosInstance.get<DashboardResponse>(
            `${BASE_URL}/dashboard`
        );
        return data;
    },

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
     * Get ultra-lightweight task overview for fastest initial detail render.
     * Uses a 3-segment SAP $batch (excludes heavy TaskObjects and Attachments).
     * Accepts optional hints from the task list item to help the backend
     * skip redundant SAP round-trips and run enrichment in parallel.
     */
    getTaskOverview: async (
        instanceId: string,
        hints?: { sapOrigin?: string; documentId?: string; businessObjectType?: string }
    ): Promise<TaskDetailResponse> => {
        const query = new URLSearchParams();
        if (hints?.sapOrigin) query.set('sapOrigin', hints.sapOrigin);
        if (hints?.documentId) query.set('documentId', hints.documentId);
        if (hints?.businessObjectType) query.set('businessObjectType', hints.businessObjectType);
        const qs = query.toString();
        const { data } = await axiosInstance.get<TaskDetailResponse>(
            `${BASE_URL}/tasks/${encodeURIComponent(instanceId)}/overview${qs ? `?${qs}` : ''}`
        );
        return data;
    },

    /**
     * Get information-first task detail for fast initial detail render.
     * Accepts optional hints from the task list item to help the backend
     * skip redundant SAP round-trips and run enrichment in parallel.
     */
    getTaskInformation: async (
        instanceId: string,
        hints?: { sapOrigin?: string; documentId?: string; businessObjectType?: string }
    ): Promise<TaskDetailResponse> => {
        const query = new URLSearchParams();
        if (hints?.sapOrigin) query.set('sapOrigin', hints.sapOrigin);
        if (hints?.documentId) query.set('documentId', hints.documentId);
        if (hints?.businessObjectType) query.set('businessObjectType', hints.businessObjectType);
        const qs = query.toString();
        const { data } = await axiosInstance.get<TaskDetailResponse>(
            `${BASE_URL}/tasks/${encodeURIComponent(instanceId)}/information${qs ? `?${qs}` : ''}`
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

    // ─── PR Attachment API (Standalone) ─────────────────────

    /**
     * Get PR attachment metadata list from the standalone ZI_PR_ATTACH_TAB API.
     */
    getPrAttachments: async (
        documentNumber: string,
        sapOrigin?: string
    ): Promise<{ attachments: TaskAttachment[]; count: number }> => {
        const query = new URLSearchParams();
        if (sapOrigin) query.set('sapOrigin', sapOrigin);
        const qs = query.toString();
        const { data } = await axiosInstance.get<{ attachments: TaskAttachment[]; count: number }>(
            `${BASE_URL}/pr/${encodeURIComponent(documentNumber)}/attachments${qs ? `?${qs}` : ''}`
        );
        return data;
    },

    /**
     * Get the URL for downloading a PR attachment's binary content.
     * Uses attach_id to identify a specific file.
     */
    getPrAttachmentContentUrl: (
        documentNumber: string,
        attachId: string,
        sapOrigin?: string,
        disposition: 'inline' | 'attachment' = 'attachment'
    ): string => {
        const query = new URLSearchParams();
        query.set('disposition', disposition);
        if (sapOrigin) query.set('sapOrigin', sapOrigin);
        return `${BASE_URL}/pr/${encodeURIComponent(documentNumber)}/attachments/${encodeURIComponent(attachId)}/content?${query.toString()}`;
    },

    /**
     * Upload an attachment to a PR document via the standalone API.
     */
    uploadPrAttachment: async (
        documentNumber: string,
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
            `${BASE_URL}/pr/${encodeURIComponent(documentNumber)}/attachments`,
            buffer,
            { headers }
        );
        return data;
    },
};
