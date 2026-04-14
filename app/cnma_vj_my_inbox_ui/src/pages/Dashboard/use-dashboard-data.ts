import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inboxApi } from '@/services/inbox/inbox.api';
import { inboxKeys } from '@/pages/Inbox/hooks/inboxKeys';
import type { DashboardTask } from '@/services/inbox/inbox.types';

// ─── Status Constants ─────────────────────────────────────
// The backend normalizes status to these display labels.

export const STATUS_LABELS = ['In Approving', 'Approved', 'Rejected'] as const;

export const STATUS_COLORS: Record<string, string> = {
    'In Approving': '#f27200',  // SAP Warning Orange
    'Approved': '#30914c',      // SAP Success Green
    'Rejected': '#bb0000',      // SAP Error Red
};

/**
 * Client-side normalization: maps any backend status value to our 3 canonical labels.
 * Handles both old labels (Ready, In Process) and SAP codes (READY, STARTED, etc.)
 */
export function normalizeDashboardStatus(raw: string): string {
    const upper = (raw || '').toUpperCase().trim().replace(/\s+/g, '_');
    switch (upper) {
        case 'NEW':
        case 'READY':
        case 'RESERVED':
        case 'IN_PROGRESS':
        case 'IN_PROCESS':
        case 'STARTED':
            return 'In Approving';
        case 'APPROVED':
        case 'COMPLETED':
        case 'COMPLETE':
            return 'Approved';
        case 'REJECTED':
            return 'Rejected';
        default:
            return 'In Approving'; // Default unknown statuses to In Approving
    }
}

// ─── Donut Segment ────────────────────────────────────────
export interface DonutSegment {
    label: string;
    value: number;
    color: string;
}

// ─── Bar Data ─────────────────────────────────────────────
export interface BarDataItem {
    label: string;
    total: number;
    statusCounts: Record<string, number>;
}

// ─── Table Row ────────────────────────────────────────────
export interface TableRow {
    taskType: string;
    documentTypeDesc: string;
    docNumber: string;
    currency: string;
    status: string;
    totalNetAmount: number | null;
    displayCurrency: string;
}

// ─── API Query Hook ───────────────────────────────────────

export function useDashboardQuery() {
    return useQuery({
        queryKey: inboxKeys.dashboard(),
        queryFn: () => inboxApi.getDashboard(),
        staleTime: 5 * 60 * 1000,  // 5 min
        refetchOnWindowFocus: true,
    });
}

// ─── Data Derivation Hook ─────────────────────────────────

/**
 * Core hook: derives all chart datasets from the flat task array.
 * Cross-filtering is entirely client-side (zero additional API calls).
 */
export function useDashboardData(
    tasks: DashboardTask[],
    selectedStatus: string | null,
    selectedType: string | null,
) {
    // ── Normalize statuses up front ──────────────────────
    // Maps any backend status (Ready, In Process, STARTED, etc.) to our 3 canonical labels.
    const normalizedTasks = useMemo(() =>
        tasks.map((t) => ({ ...t, status: normalizeDashboardStatus(t.status) })),
        [tasks]
    );

    // ── Chart 1: Donut by Status ─────────────────────────
    const donutSegments: DonutSegment[] = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const t of normalizedTasks) {
            counts[t.status] = (counts[t.status] || 0) + 1;
        }
        return STATUS_LABELS.map((s) => ({
            label: s,
            value: counts[s] || 0,
            color: STATUS_COLORS[s],
        }));
    }, [normalizedTasks]);

    // ── Chart 2: Bar chart — ALWAYS uses all tasks (not filtered by status) ─
    // Status selection only controls visual highlighting, not data filtering.
    const barData: BarDataItem[] = useMemo(() => {
        const groups = new Map<string, { total: number; statusCounts: Record<string, number> }>();
        for (const t of normalizedTasks) {
            const key = t.documentTypeDesc || t.taskType;
            let g = groups.get(key);
            if (!g) {
                g = { total: 0, statusCounts: {} };
                groups.set(key, g);
            }
            g.total++;
            g.statusCounts[t.status] = (g.statusCounts[t.status] || 0) + 1;
        }
        return Array.from(groups.entries())
            .map(([label, data]) => ({ label, ...data }))
            .sort((a, b) => b.total - a.total);
    }, [normalizedTasks]);

    // ── Filtered tasks for table (by both status and type) ─
    const statusFiltered = useMemo(() => {
        if (!selectedStatus) return normalizedTasks;
        return normalizedTasks.filter((t) => t.status === selectedStatus);
    }, [normalizedTasks, selectedStatus]);

    const typeFiltered = useMemo(() => {
        if (!selectedType) return statusFiltered;
        return statusFiltered.filter(
            (t) => (t.documentTypeDesc || t.taskType) === selectedType
        );
    }, [statusFiltered, selectedType]);

    // ── Chart 3: Table rows ──────────────────────────────
    const tableRows: TableRow[] = useMemo(() => {
        return typeFiltered.map((t) => ({
            taskType: t.taskType,
            documentTypeDesc: t.documentTypeDesc || t.taskType,
            docNumber: t.documentNumber,
            currency: t.currency,
            status: t.status,
            totalNetAmount: t.totalNetAmount,
            displayCurrency: t.displayCurrency || t.currency,
        }));
    }, [typeFiltered]);

    // ── Summary counts for stat cards ────────────────────
    const totalTasks = tasks.length;
    const totalTypes = useMemo(
        () => new Set(normalizedTasks.map((t) => t.documentTypeDesc || t.taskType)).size,
        [normalizedTasks]
    );

    return {
        donutSegments,
        barData,
        tableRows,
        totalTasks,
        totalTypes,
        statusFiltered,
        typeFiltered,
    };
}
