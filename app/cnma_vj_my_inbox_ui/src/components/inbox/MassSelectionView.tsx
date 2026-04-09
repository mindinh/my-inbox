import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { InboxTask } from '@/services/inbox/inbox.types';
import { CheckCircle, XCircle, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MassSelectionViewProps {
    tasks: InboxTask[];
    selectedIds: Set<string>;
    onToggleSelection: (taskId: string) => void;
    onMassDecision: (decisionKey: string, comment: string, taskIds: string[]) => void;
    isExecuting: boolean;
}

export function MassSelectionView({
    tasks,
    selectedIds,
    onToggleSelection,
    onMassDecision,
    isExecuting,
}: MassSelectionViewProps) {


    const selectedTasks = useMemo(
        () => tasks.filter((t) => selectedIds.has(t.instanceId)),
        [tasks, selectedIds]
    );

    // Collect common decisions across all selected tasks
    // For mass action, we provide generic Approve/Reject buttons
    const hasSelectedTasks = selectedTasks.length > 0;

    if (!hasSelectedTasks) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <ListChecks className="size-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-sm font-medium text-muted-foreground">
                    Select tasks to view summary
                </h3>
                <p className="text-xs text-muted-foreground/70 mt-1">
                    Use the checkboxes in the task list to select multiple tasks
                </p>
            </div>
        );
    }

    return (
        <div className="flex h-full min-w-0 flex-col bg-slate-50/70">
            {/* Header */}
            <div className="border-b border-border/60 px-5 py-4 bg-background">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold text-foreground">
                            Task Summary
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected for mass action
                        </p>
                    </div>
                    <Badge variant="secondary" className="h-7 px-3 text-sm font-medium">
                        {selectedTasks.length} selected
                    </Badge>
                </div>
            </div>

            {/* Summary Table */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="px-5 py-4">
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/80">
                                    <th className="px-3 py-2.5 text-left w-10">
                                        <Checkbox
                                            checked={selectedTasks.length === tasks.length}
                                            onCheckedChange={() => {
                                                // handled by parent
                                            }}
                                            disabled
                                        />
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Task Title
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Requestor
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Document
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Priority
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Created On
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedTasks.map((task, idx) => (
                                    <tr
                                        key={task.instanceId}
                                        className={cn(
                                            'border-b border-slate-100 hover:bg-slate-50/60 transition-colors',
                                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                                        )}
                                    >
                                        <td className="px-3 py-2.5">
                                            <Checkbox
                                                checked={selectedIds.has(task.instanceId)}
                                                onCheckedChange={() => onToggleSelection(task.instanceId)}
                                            />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <div className="font-medium text-foreground truncate max-w-[250px]">
                                                {task.title}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-muted-foreground">
                                            {task.requestorName || task.createdByName || '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">
                                            {task.businessContext?.documentId || '-'}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] px-1.5 py-0"
                                            >
                                                {task.businessContext?.type || '-'}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <PriorityBadge priority={task.priority} />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <StatusBadge status={task.status} />
                                        </td>
                                        <td className="px-3 py-2.5 text-muted-foreground text-xs">
                                            {formatDate(task.createdOn)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </ScrollArea>

            {/* Mass Action Footer */}
            <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm px-5 py-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onMassDecision('0002', '', [...selectedIds])}
                            disabled={isExecuting || selectedTasks.length === 0}
                        >
                            <XCircle className="size-3.5 mr-1.5" />
                            Reject ({selectedTasks.length})
                        </Button>
                        <Button
                            variant="success"
                            size="sm"
                            onClick={() => onMassDecision('0001', '', [...selectedIds])}
                            disabled={isExecuting || selectedTasks.length === 0}
                            className="text-white"
                        >
                            <CheckCircle className="size-3.5 mr-1.5" />
                            Approve ({selectedTasks.length})
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Helper Components ────────────────────────────────────

function PriorityBadge({ priority }: { priority?: string }) {
    if (!priority) return <span className="text-muted-foreground">-</span>;

    const config: Record<string, { className: string; label: string }> = {
        VERY_HIGH: { className: 'bg-red-100 text-red-800 border-red-200', label: 'Very High' },
        HIGH: { className: 'bg-orange-100 text-orange-800 border-orange-200', label: 'High' },
        MEDIUM: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Medium' },
        LOW: { className: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Low' },
    };
    const c = config[priority] || { className: 'bg-slate-100 text-slate-600', label: priority };

    return (
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 font-medium', c.className)}>
            {c.label}
        </Badge>
    );
}

function StatusBadge({ status }: { status?: string }) {
    if (!status) return <span className="text-muted-foreground">-</span>;

    const config: Record<string, { className: string; label: string }> = {
        READY: { className: 'bg-green-100 text-green-800 border-green-200', label: 'Ready' },
        RESERVED: { className: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Reserved' },
        IN_PROGRESS: { className: 'bg-amber-100 text-amber-800 border-amber-200', label: 'In Progress' },
        COMPLETED: { className: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Completed' },
    };
    const c = config[status] || { className: 'bg-slate-100 text-slate-600', label: status };

    return (
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 font-medium', c.className)}>
            {c.label}
        </Badge>
    );
}

function formatDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}
