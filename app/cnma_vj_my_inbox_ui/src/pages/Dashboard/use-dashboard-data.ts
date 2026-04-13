import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inboxApi } from '@/services/inbox/inbox.api';
import { inboxKeys } from '@/pages/Inbox/hooks/inboxKeys';
import type { DashboardTask } from '@/services/inbox/inbox.types';

// ─── Status Constants ─────────────────────────────────────
// The backend already normalizes status to these display labels.

export const STATUS_LABELS = ['Ready', 'In Process', 'Approved'] as const;

export const STATUS_COLORS: Record<string, string> = {
    'Ready': '#0070f2',       // SAP Info Blue
    'In Process': '#e76500',  // SAP Warning Orange
    'Approved': '#30914c',    // SAP Success Green
};

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
    // ── Chart 1: Donut by Status ─────────────────────────
    const donutSegments: DonutSegment[] = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const t of tasks) {
            counts[t.status] = (counts[t.status] || 0) + 1;
        }
        return STATUS_LABELS.map((s) => ({
            label: s,
            value: counts[s] || 0,
            color: STATUS_COLORS[s],
        }));
    }, [tasks]);

    // ── Filtered tasks after donut selection ──────────────
    const statusFiltered = useMemo(() => {
        if (!selectedStatus) return tasks;
        return tasks.filter((t) => t.status === selectedStatus);
    }, [tasks, selectedStatus]);

    // ── Chart 2: Bar chart — tasks by document type desc ─
    const barData: BarDataItem[] = useMemo(() => {
        const groups = new Map<string, { total: number; statusCounts: Record<string, number> }>();
        for (const t of statusFiltered) {
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
    }, [statusFiltered]);

    // ── Further filtered after bar type selection ─────────
    const typeFiltered = useMemo(() => {
        if (!selectedType) return statusFiltered;
        return statusFiltered.filter(
            (t) => (t.documentTypeDesc || t.taskType) === selectedType
        );
    }, [statusFiltered, selectedType]);

    // ── Chart 3: Table rows (all filtered, no TotalValue) ─
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
        () => new Set(tasks.map((t) => t.documentTypeDesc || t.taskType)).size,
        [tasks]
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
