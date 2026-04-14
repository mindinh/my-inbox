import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type {
    InboxTask,
} from '@/services/inbox/inbox.types';
import {
    Clock,
    User,
    AlertTriangle,
    ChevronRight,
    FileText,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { mapBusinessChips, type BusinessChip } from '@/pages/Inbox/mappers/taskCard.mapper';
import { PriorityBadge, StatusBadge } from './TaskBadges';

interface TaskCardProps {
    task: InboxTask;
    isSelected: boolean;
    onClick: () => void;
    variant?: 'desktop' | 'mobile';
}

// BusinessChip type + mapBusinessChips → imported from '@/pages/Inbox/mappers/taskCard.mapper'

/**
 * Hook wrapper around the pure mapBusinessChips function.
 */
function useBusinessChips(task: InboxTask): BusinessChip[] {
    return useMemo(() => mapBusinessChips(task), [task.businessContext]);
}

// formatAmount → imported from '@/pages/Inbox/utils/formatters'

export function TaskCard({
    task,
    isSelected,
    onClick,
    variant = 'desktop',
}: TaskCardProps) {
    const contextType =
        task.businessContext?.type && task.businessContext.type !== 'UNKNOWN'
            ? task.businessContext.type
            : 'Workflow';
    const contextId = task.businessContext?.documentId || task.instanceId;
    const isPrTask = task.businessContext?.type === 'PR';
    const chips = useBusinessChips(task);

    if (variant === 'mobile') {
        return (
            <button
                id={`task-card-${task.instanceId}`}
                onClick={onClick}
                className={cn(
                    'group relative w-full overflow-hidden rounded-[22px] border bg-white px-4 py-4 text-left transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'shadow-[0_1px_2px_rgba(15,23,42,0.06)] hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]',
                    isSelected &&
                    'border-primary/35 bg-[linear-gradient(180deg,rgba(255,247,247,0.98)_0%,rgba(255,255,255,1)_100%)] ring-1 ring-primary/10 shadow-[0_14px_30px_rgba(193,0,0,0.08)]',
                    !isSelected && (task.priority === 'HIGH' || task.priority === 'VERY_HIGH' || isPrTask) &&
                    'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-destructive'
                )}
            >
                <div className="flex items-start gap-3">
                    <div
                        className={cn(
                            'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl',
                            isSelected
                                ? 'bg-[linear-gradient(180deg,rgba(193,0,0,0.12)_0%,rgba(193,0,0,0.04)_100%)] text-primary'
                                : 'bg-slate-100 text-slate-500'
                        )}
                    >
                        <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                                {contextType}
                            </span>
                            <span className="truncate text-[12px] font-semibold text-slate-700">
                                {contextId}
                            </span>
                            {task.priority === 'VERY_HIGH' && (
                                <AlertTriangle className="ml-auto size-4 shrink-0 text-destructive" />
                            )}
                        </div>

                        <h3 className="mt-2.5 line-clamp-2 text-[16px] font-bold leading-tight text-slate-900">
                            {task.title}
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <PriorityBadge priority={task.priority} />
                            <StatusBadge status={task.status} />
                        </div>
                    </div>
                </div>

                {/* Business detail chips */}
                {chips.length > 0 && (
                    <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-slate-600">
                        {chips.map((chip, i) => (
                            <span key={i} className="inline-flex items-center truncate max-w-full">
                                {chip.label && <span className="mr-1.5 font-medium text-slate-500">{chip.label}:</span>}
                                <span className={cn('truncate font-semibold text-slate-800', chip.isPrimary && 'text-[14px] font-bold text-slate-950')}>
                                    {chip.value}
                                </span>
                            </span>
                        ))}
                    </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[13px] font-medium text-slate-500">
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <User className="size-4 shrink-0 text-slate-400" />
                        <span className="truncate">{task.requestorName || task.createdByName || '-'}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                        <Clock className="size-4 text-slate-400" />
                        {task.createdOn
                            ? formatDistanceToNow(new Date(task.createdOn), {
                                addSuffix: true,
                            })
                            : '-'}
                    </span>
                </div>
            </button>
        );
    }

    return (
        <button
            id={`task-card-${task.instanceId}`}
            onClick={onClick}
            className={cn(
                'group relative flex w-full flex-col overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all duration-200',
                'bg-white/96 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.05)]',
                'hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]',
                'before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:rounded-r-full before:bg-transparent before:transition-colors',
                isSelected &&
                'border-primary/35 bg-[linear-gradient(180deg,rgba(193,0,0,0.04)_0%,rgba(255,255,255,0.98)_100%)] ring-1 ring-primary/10 before:bg-primary',
                !isSelected && isPrTask && 'before:bg-destructive'
            )}
        >
            {task.priority === 'VERY_HIGH' && (
                <div className="absolute right-3.5 top-3.5">
                    <AlertTriangle className="size-4 animate-pulse text-destructive" />
                </div>
            )}

            <h3 className="pr-6 text-[14px] font-bold leading-snug text-slate-900 line-clamp-2">
                {task.title}
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
                {task.businessContext?.type && task.businessContext.type !== 'UNKNOWN' && (
                    <Badge variant="info" className="px-1.5 py-0 text-[10px]">
                        {task.businessContext.type}
                        {task.businessContext.documentId && (
                            <span className="ml-0.5 opacity-75">
                                {task.businessContext.documentId}
                            </span>
                        )}
                    </Badge>
                )}
            </div>

            {/* Extra business detail chips */}
            {chips.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-slate-600">
                    {chips.map((chip, i) => (
                        <span key={i} className="inline-flex items-center truncate max-w-[160px]">
                            {chip.label && <span className="mr-1.5 font-medium text-slate-500">{chip.label}:</span>}
                            <span className={cn('truncate font-semibold text-slate-800', chip.isPrimary && 'text-[13px] font-bold text-slate-950')}>
                                {chip.value}
                            </span>
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-auto flex min-h-[18px] items-center gap-3 border-t border-slate-100/90 pt-3 text-[12px] font-medium text-slate-500">
                <span className="flex truncate items-center gap-1.5">
                    <User className="size-4 shrink-0 text-slate-400" />
                    {task.requestorName || task.createdByName || '-'}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                    <Clock className="size-4 text-slate-400" />
                    {task.createdOn
                        ? formatDistanceToNow(new Date(task.createdOn), { addSuffix: true })
                        : '-'}
                </span>
            </div>

            <ChevronRight
                className={cn(
                    'absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100',
                    isSelected && 'text-primary/60 opacity-100'
                )}
            />
        </button>
    );
}


