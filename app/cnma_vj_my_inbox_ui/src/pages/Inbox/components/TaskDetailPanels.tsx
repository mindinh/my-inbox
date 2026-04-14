/**
 * TaskDetailPanels — barrel file for all detail panel components.
 *
 * Phase 4 split the 3 largest panels into dedicated files under panels/:
 *   - AttachmentsPanel   (upload, download, preview)
 *   - CommentsPanel      (merged comments + add-comment form)
 *   - WorkflowApprovalPanel (PR approval tree with expandable steps)
 *
 * OverviewPanel, DetailsPanel, ActivityPanel, and utility functions
 * remain here as they are tightly coupled to the tab definitions.
 */
import { useState } from 'react';
import {
    Calendar,
    Clock3,
    GitBranch,
    LayoutDashboard,
    List,
    MessageSquare,
    Paperclip,
    Tag,
    User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    type TaskDetail,
    type PurchaseOrderFactsheetData,
    type WorkflowApprovalComment,
} from '@/services/inbox/inbox.types';
import type { BusinessSectionModel } from './TaskDetailSections.types';
import { cn } from '@/lib/utils';
import {
    formatDate,
    safe,
    prettifyFieldLabel,
} from '@/pages/Inbox/utils/formatters';
import { mergeAndDeduplicateComments } from '@/pages/Inbox/mappers/comments.mapper';
import { InfoItem, ActivityTimeline } from './panels/shared';

// ─── Re-exports from panels/ ──────────────────────────────
export { AttachmentsPanel } from './panels/AttachmentsPanel';
export { CommentsPanel } from './panels/CommentsPanel';
export { WorkflowApprovalPanel } from './panels/WorkflowApprovalPanel';

import { StatusBadge, PriorityBadge } from './TaskBadges';
import { useTranslation } from 'react-i18next';

// ─── OverviewPanel (header fields only) ────────────────────

export function OverviewPanel({
    model,
    detail,
    isMobile = false,
}: {
    model: BusinessSectionModel;
    detail: TaskDetail;
    isMobile?: boolean;
}) {
    const allFields = [
        { key: 'sys_created_on', label: 'Created On', value: formatDate(detail.task.createdOn) },
        ...model.cards.flatMap((card) => card.fields).filter(f => f.label !== 'Created On' && f.label !== 'Creation Date')
    ];

    const regularFields = allFields.filter(f => f.label !== 'Description' && f.label !== 'Header Note');
    const descriptionFields = allFields.filter(f => f.label === 'Description' || f.label === 'Header Note');

    return (
        <div className="space-y-6">
            {isMobile ? (
                <Card className="gap-0 bg-card border-border/70 shadow-sm">
                    <CardHeader className="pb-2 border-b border-border/40">
                        <CardTitle className="text-lg">{model.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="flex flex-col gap-1 px-4 py-3">
                            {regularFields.map((item) => (
                                <div key={item.key} className="flex items-start justify-between gap-3 py-3">
                                    <span className="text-slate-500 text-[12px] uppercase tracking-wider font-medium pt-[1px] w-5/12 shrink-0">{item.label}</span>
                                    <span className="font-medium text-slate-900 text-[14px] text-right break-words">{item.value}</span>
                                </div>
                            ))}
                            {descriptionFields.map((item) => (
                                <div key={item.key} className="flex flex-col gap-1.5 py-3">
                                    <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">{item.label}</span>
                                    <div className="font-medium text-slate-900 border border-slate-200 bg-slate-50 rounded-lg p-3.5 mt-1 text-sm whitespace-pre-wrap leading-relaxed break-words">
                                        {item.value || <span className="text-slate-400 italic">No value</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="gap-0 bg-card border-border/70 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">{model.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                        {regularFields.map((item) => (
                            <div key={item.key} className="flex flex-col gap-1">
                                <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">{item.label}</span>
                                <span className="font-medium text-sm text-slate-900">{item.value}</span>
                            </div>
                        ))}
                        {descriptionFields.map((item) => (
                            <div key={item.key} className="flex flex-col gap-1.5 col-span-full pt-2">
                                <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">{item.label}</span>
                                <div className="font-medium text-slate-900 border border-slate-200 bg-slate-50 rounded-lg p-3.5 mt-1 text-sm whitespace-pre-wrap leading-relaxed">
                                    {item.value || <span className="text-slate-400 italic">No value</span>}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ─── DetailsPanel (tables only) ────────────────────────────

export function DetailsPanel({
    model,
    detail,
    isMobile = false,
}: {
    model: BusinessSectionModel;
    detail: TaskDetail;
    isMobile?: boolean;
}) {
    const [selectedRow, setSelectedRow] = useState<{
        tableTitle: string;
        rowId: string;
        fields: Array<{ label: string; value: string }>;
    } | null>(null);

    const filteredTables = model.tables
        .filter((table) => !['Header Facts', 'Custom Attributes', 'Related Objects'].includes(table.title));

    if (filteredTables.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                No detail items available for this task.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {filteredTables.map((table) => (
                    <Card key={table.id} className="gap-0 bg-card border-border/70 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">{table.title}</CardTitle>
                            {!isMobile && table.rows.length > 0 && (
                                <CardDescription>Click a row to view complete details</CardDescription>
                            )}
                        </CardHeader>
                        <CardContent>
                            {isMobile ? (
                                <div className="divide-y divide-border/60">
                                    {table.rows.length === 0 && (
                                        <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                                            {table.emptyMessage || 'No data'}
                                        </div>
                                    )}
                                    {table.rows.map((row) => (
                                        <div key={row.id} className="py-4 first:pt-3 last:pb-3 space-y-2">
                                            {table.columns.map((column) => (
                                                <div
                                                    key={`${row.id}-${column.key}`}
                                                    className="flex items-start justify-between gap-3"
                                                >
                                                    <span className="text-[13px] font-medium text-slate-500 pt-[1px] w-5/12 shrink-0">
                                                        {column.label}
                                                    </span>
                                                    <span className="text-[15px] font-semibold text-slate-900 text-right break-words">
                                                        {safe(row.values[column.key])}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="max-h-[420px] overflow-auto rounded-xl border border-border/60 bg-white">
                                    <Table>
                                        <TableHeader className="bg-slate-100/90">
                                            <TableRow className="border-border/70 bg-transparent hover:bg-transparent">
                                                {table.columns.map((column) => (
                                                    <TableHead
                                                        key={column.key}
                                                        className={cn(
                                                            'h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500',
                                                            column.align === 'right' && 'text-right'
                                                        )}
                                                    >
                                                        {column.label}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {table.rows.length === 0 && (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={table.columns.length}
                                                        className="px-4 py-8 text-center text-muted-foreground whitespace-normal"
                                                    >
                                                        {table.emptyMessage || 'No data'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {table.rows.map((row) => (
                                                <TableRow
                                                    key={row.id}
                                                    onClick={() => {
                                                        const selectedFields = table.columns.map((column) => ({
                                                            label: column.label,
                                                            value: safe(row.values[column.key]),
                                                        }));
                                                        const knownKeys = new Set(table.columns.map((column) => column.key));
                                                        for (const [key, value] of Object.entries(row.values)) {
                                                            if (knownKeys.has(key)) continue;
                                                            selectedFields.push({
                                                                label: table.detailFieldLabels?.[key] || prettifyFieldLabel(key),
                                                                value: safe(value),
                                                            });
                                                        }
                                                        setSelectedRow({
                                                            tableTitle: table.title,
                                                            rowId: row.id,
                                                            fields: selectedFields,
                                                        });
                                                    }}
                                                    className="border-border/60 cursor-pointer hover:bg-primary/5"
                                                >
                                                    {table.columns.map((column) => (
                                                        <TableCell
                                                            key={`${row.id}-${column.key}`}
                                                            className={cn(
                                                                'px-4 py-3.5 text-sm whitespace-normal',
                                                                column.align === 'right' && 'text-right'
                                                            )}
                                                        >
                                                            {safe(row.values[column.key])}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

            {!isMobile && (
                <Sheet
                    open={!!selectedRow}
                    onOpenChange={(open) => {
                        if (!open) setSelectedRow(null);
                    }}
                >
                    <SheetContent side="right" className="w-[520px] sm:max-w-[520px] p-0">
                        <SheetHeader className="border-b border-border/60 bg-slate-50/90">
                            <SheetTitle>{selectedRow?.tableTitle || 'Details'}</SheetTitle>
                            <SheetDescription>
                                Row ID: {selectedRow?.rowId || '-'}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="p-4 overflow-auto">
                            <div className="overflow-hidden rounded-xl border border-border/60 bg-white">
                                <Table>
                                    <TableBody>
                                        {(selectedRow?.fields || []).map((item) => (
                                            <TableRow key={`${item.label}-${item.value}`}>
                                                <TableCell className="w-[42%] bg-slate-50/70 px-4 py-3 text-muted-foreground whitespace-normal">
                                                    {item.label}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 font-medium break-all whitespace-normal">
                                                    {item.value}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            )}
        </div>
    );
}

// ─── ActivityPanel ─────────────────────────────────────────

export function ActivityPanel({ detail }: { detail: TaskDetail }) {
    const { t } = useTranslation();
    const processingRows = detail.processingLogs.map((log, idx) => ({
        id: `proc-${log.orderId ?? idx}`,
        timestamp: formatDate(log.timestamp),
        actor: safe(log.performedByName || log.performedBy),
        action: safe(log.actionName || log.taskStatus),
        details: safe(log.comments),
    }));

    const workflowRows = detail.workflowLogs.map((log) => ({
        id: `wf-${log.orderId}`,
        timestamp: formatDate(log.timestamp),
        actor: safe(log.performedByName || log.performedBy),
        action: safe(log.description),
        details: safe(log.executionType),
    }));

    return (
        <div className="space-y-6">
            <Card className="gap-0 bg-card border-border/70 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">{t('task.processingLog', 'Processing Log')}</CardTitle>
                    <CardDescription>{t('task.actionsTaken', 'Actions taken on this task')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <ActivityTimeline
                        rows={processingRows}
                        emptyMessage={t('task.noProcessingLog', 'No processing log entries found.')}
                        accent="processing"
                    />
                </CardContent>
            </Card>

            <Card className="gap-0 bg-card border-border/70 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">{t('task.workflowLog', 'Workflow Log')}</CardTitle>
                    <CardDescription>{t('task.workflowExecution', 'Workflow execution history')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <ActivityTimeline
                        rows={workflowRows}
                        emptyMessage={t('task.noWorkflowLog', 'No workflow log entries found.')}
                        accent="workflow"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Tab Definitions ───────────────────────────────────────

export function makeTabDefinitions(detail: TaskDetail, workflowCount = 0, workflowComments?: WorkflowApprovalComment[], t?: any, prAttachmentCount?: number) {
    const poFacts = detail.businessContext?.po as PurchaseOrderFactsheetData | undefined;
    const poFactsCount =
        (poFacts?.items?.length || 0) +
        (poFacts?.accountAssignments?.length || 0) +
        (poFacts?.scheduleLines?.length || 0);

    const mergedCommentsCount = mergeAndDeduplicateComments(detail.comments, workflowComments).length;

    // For PR tasks, use the count from the standalone PR attachment API
    const attachmentCount = prAttachmentCount ?? detail.attachments.length;

    return [
        {
            value: 'overview',
            label: t ? t('task.overview', 'Overview') : 'Overview',
            icon: LayoutDashboard,
            count: undefined,
        },
        {
            value: 'details',
            label: t ? t('task.details', 'Details') : 'Details',
            icon: List,
            count: poFactsCount > 0 ? poFactsCount : undefined,
        },
        {
            value: 'workflow',
            label: t ? t('task.approvalTree', 'Workflow') : 'Workflow',
            icon: GitBranch,
            count: workflowCount,
        },
        { value: 'attachments', label: t ? t('task.attachments', 'Attachments') : 'Attachments', icon: Paperclip, count: attachmentCount },
        { value: 'comments', label: t ? t('task.comments', 'Comments') : 'Comments', icon: MessageSquare, count: mergedCommentsCount },
    ] as const;
}

// ─── Status Header Badges ──────────────────────────────────

export function StatusHeaderBadges({ detail }: { detail: TaskDetail }) {
    const context = detail.businessContext;
    return (
        <div className="flex items-center gap-2 overflow-hidden">
            {context?.type && context.type !== 'UNKNOWN' && (
                <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[12px] font-semibold text-blue-600 tracking-wide shrink-0 truncate max-w-[200px]">
                    {context.type} {context.documentId || ''}
                </span>
            )}
            <StatusBadge status={detail.task.status} />
            <PriorityBadge priority={detail.task.priority} />
        </div>
    );
}
