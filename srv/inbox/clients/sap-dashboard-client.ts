import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { DashboardTask } from '../../types';

/**
 * SAP Dashboard Client — ZI_PR_DASH_BOARD
 *
 * Fetches task dashboard data from the custom SAP OData V4 service.
 * Returns all tasks assigned to the current user with:
 *   - TaskId, DocumentNumber, TaskType, DocumentType, DocumentTypeDesc, Status, Currency
 *
 * API path: /sap/opu/odata/sap/zsb_pr_dashboard/srvd_a2x/sap/zsd_pr_dashboard/0001/ZI_PR_DASH_BOARD
 *
 * Response format (OData V4):
 *   {
 *     "@odata.context": "$metadata#ZI_PR_DASH_BOARD",
 *     "value": [ { TaskId, DocumentNumber, ... } ]
 *   }
 */

// ─── SAP Raw Entity (matches OData response field casing) ──

interface SapDashboardTaskRaw {
    TaskId: string;
    DocumentNumber: string;
    TaskType: string;
    DocumentType: string;
    DocumentTypeDesc: string;
    Status: string;
    Currency: string;
    TotalNetAmount?: number;
    DisplayCurrency?: string;
}

interface ODataV4CollectionResponse<T> {
    '@odata.context'?: string;
    '@odata.metadataEtag'?: string;
    value: T[];
}

// ─── Client ────────────────────────────────────────────────

export class SapDashboardClient {
    private readonly destinationName: string;
    private readonly sapClient: string;
    private readonly servicePath: string;
    private readonly entitySet: string;

    constructor() {
        this.destinationName =
            process.env.SAP_DASHBOARD_DESTINATION ||
            process.env.SAP_TASK_DESTINATION ||
            'S4H_ODATA';
        this.sapClient = process.env.SAP_TASK_CLIENT || '400';
        this.servicePath =
            process.env.SAP_DASHBOARD_ODATA_PATH ||
            '/sap/opu/odata4/sap/zsb_pr_dashboard/srvd_a2x/sap/zsd_pr_dashboard/0001';
        this.entitySet = process.env.SAP_DASHBOARD_ENTITY_SET || 'ZI_PR_DASH_BOARD';
    }

    /**
     * Fetch all dashboard tasks for the authenticated user.
     */
    async fetchDashboard(options?: {
        userJwt?: string;
    }): Promise<{ items: DashboardTask[]; total: number }> {
        const url = this.buildUrl(`/${this.entitySet}`, {
            'sap-client': this.sapClient,
        });

        const destination =
            options?.userJwt && options.userJwt.trim()
                ? { destinationName: this.destinationName, jwt: options.userJwt }
                : { destinationName: this.destinationName };

        const response = await executeHttpRequest(destination, {
            method: 'GET',
            url,
            headers: {
                Accept: 'application/json',
            },
        });

        const body = response.data as ODataV4CollectionResponse<SapDashboardTaskRaw>;
        const rawItems = body.value || [];

        const items = rawItems.map(mapRawToDashboardTask);

        return { items, total: items.length };
    }

    // ─── Utilities ────────────────────────────────────────

    private buildUrl(path: string, params: Record<string, string>): string {
        const base = path.startsWith('/')
            ? `${this.servicePath}${path}`
            : `${this.servicePath}/${path}`;
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            search.append(key, value);
        }
        return `${base}?${search.toString()}`;
    }
}

// ─── Mapper ───────────────────────────────────────────────

function mapRawToDashboardTask(raw: SapDashboardTaskRaw): DashboardTask {
    return {
        taskId: raw.TaskId,
        documentNumber: raw.DocumentNumber,
        taskType: raw.TaskType,
        documentType: raw.DocumentType,
        documentTypeDesc: raw.DocumentTypeDesc,
        status: normalizeStatus(raw.Status),
        currency: raw.Currency,
        totalNetAmount: raw.TotalNetAmount ?? null,
        displayCurrency: raw.DisplayCurrency ?? raw.Currency ?? '',
    };
}

/**
 * Normalize SAP status values to a consistent set.
 * SAP may return: STARTED, COMPLETED, READY, IN_PROGRESS, etc.
 */
function normalizeStatus(raw: string): string {
    if (!raw) return 'UNKNOWN';
    const upper = raw.toUpperCase().trim();

    // Map common SAP TASKPROCESSING statuses to dashboard-friendly labels
    switch (upper) {
        case 'READY':
            return 'Ready';
        case 'RESERVED':
        case 'IN_PROGRESS':
        case 'STARTED':
            return 'In Process';
        case 'COMPLETED':
        case 'APPROVED':
            return 'Approved';
        default:
            return raw;
    }
}
