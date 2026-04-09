import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { DecisionPanel } from './DecisionPanel';
import type {
    TaskDetail as TaskDetailType,
    CustomAttribute,
    ProcessingLog,
    WorkflowLog,
} from '@/services/inbox/inbox.types';
import {
    ArrowLeft,
    Calendar,
    User,
    FileText,
    Tag,
    Paperclip,
    Hand,
    Undo2,
    MessageSquare,
    History,
    Clock3,
    AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface TaskDetailProps {
    detail: TaskDetailType | undefined;
    isLoading: boolean;
    onBack: () => void;
    onDecision: (decisionKey: string, comment: string) => void;
    isExecuting: boolean;
    onClaim?: () => void;
    onRelease?: () => void;
    isMobile?: boolean;
}

export function TaskDetail({
    detail,
    isLoading,
    onBack,
    onDecision,
    isExecuting,
    onClaim,
    onRelease,
    isMobile = false,
}: TaskDetailProps) {
    if (isLoading) {
        return <TaskDetailSkeleton onBack={onBack} isMobile={isMobile} />;
    }

    if (!detail) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <FileText className="size-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-sm font-medium text-muted-foreground">
                    Select a task to view details
                </h3>
            </div>
        );
    }

    const {
        task,
        description,
        decisions,
        customAttributes,
        taskObjects,
        businessContext,
    } = detail;
    const comments = detail.comments || [];
    const processingLogs = detail.processingLogs || [];
    const workflowLogs = detail.workflowLogs || [];
    const attachments = detail.attachments || [];

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-start gap-3 p-4 border-b border-border/50">
                {isMobile && (
                    <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5 shrink-0">
                        <ArrowLeft className="size-4" />
                    </Button>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                    <h2 className="text-base font-semibold text-foreground leading-snug">
                        {task.title}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                        {businessContext?.type && businessContext.type !== 'UNKNOWN' && (
                            <Badge variant="info" className="text-xs">
                                {businessContext.type}
                                {businessContext.documentId && ` ${businessContext.documentId}`}
                            </Badge>
                        )}
                        <Badge
                            variant={task.status === 'READY' ? 'success' : 'secondary'}
                            className="text-xs"
                        >
                            {task.status}
                        </Badge>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {task.createdByName && (
                            <MetaItem icon={User} label="Created by" value={task.createdByName} />
                        )}
                        {task.createdOn && (
                            <MetaItem
                                icon={Calendar}
                                label="Created"
                                value={formatDate(task.createdOn)}
                                subText={formatRelative(task.createdOn)}
                            />
                        )}
                        {task.processorName && (
                            <MetaItem icon={User} label="Processor" value={task.processorName} />
                        )}
                        {task.scenarioId && (
                            <MetaItem icon={Tag} label="Scenario" value={task.scenarioId} />
                        )}
                        {task.taskDefinitionName && (
                            <MetaItem icon={Tag} label="Task definition" value={task.taskDefinitionName} />
                        )}
                        {task.completionDeadline && (
                            <MetaItem
                                icon={Clock3}
                                label="Completion deadline"
                                value={formatDate(task.completionDeadline)}
                                subText={formatRelative(task.completionDeadline)}
                            />
                        )}
                        {task.expiryDate && (
                            <MetaItem
                                icon={Clock3}
                                label="Expiry"
                                value={formatDate(task.expiryDate)}
                                subText={formatRelative(task.expiryDate)}
                            />
                        )}
                    </div>

                    {(task.taskDefinitionId || task.instanceId || task.isEscalated) && (
                        <>
                            <Separator />
                            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
                                {task.instanceId && <span>Instance ID: {task.instanceId}</span>}
                                {task.taskDefinitionId && <span>Definition ID: {task.taskDefinitionId}</span>}
                                {task.isEscalated && (
                                    <span className="inline-flex items-center gap-1 text-amber-600">
                                        <AlertTriangle className="size-3.5" />
                                        Escalated task
                                    </span>
                                )}
                            </div>
                        </>
                    )}

                    {/* Description */}
                    {description && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                    <FileText className="size-3.5" />
                                    Description
                                </h3>
                                {description.type === 'html' ? (
                                    <div
                                        className="text-sm text-muted-foreground prose prose-sm max-w-none
                                            [&_table]:border [&_table]:border-border [&_td]:p-2 [&_td]:border
                                            [&_ul]:list-disc [&_ul]:pl-4 [&_strong]:text-foreground"
                                        dangerouslySetInnerHTML={{ __html: description.value }}
                                    />
                                ) : (
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {description.value}
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {/* Custom Attributes */}
                    {customAttributes.length > 0 && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-foreground">
                                    Details
                                </h3>
                                <div className="rounded-lg border border-border/50 divide-y divide-border/50">
                                    {customAttributes.map((attr) => (
                                        <AttributeRow key={attr.name} attribute={attr} />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Attachments */}
                    {attachments.length > 0 && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                    <Paperclip className="size-3.5" />
                                    Attachments
                                </h3>
                                <div className="space-y-1">
                                    {attachments.map((att) => (
                                        <div
                                            key={att.id}
                                            className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
                                        >
                                            <FileText className="size-3.5 text-muted-foreground shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate">
                                                    {att.fileDisplayName || att.fileName || att.id}
                                                </div>
                                                {att.createdAt && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {formatDate(att.createdAt)}
                                                    </div>
                                                )}
                                            </div>
                                            {att.mimeType && (
                                                <Badge variant="outline" className="text-[10px] shrink-0">
                                                    {att.mimeType}
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Related Objects */}
                    {taskObjects.length > 0 && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                    <Tag className="size-3.5" />
                                    Related Objects
                                </h3>
                                <div className="space-y-1">
                                    {taskObjects.map((obj) => (
                                        <div
                                            key={obj.objectId}
                                            className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
                                        >
                                            <FileText className="size-3.5 text-muted-foreground shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate">{obj.name || obj.objectId}</div>
                                                {obj.url && (
                                                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                                        <MessageSquare className="size-3" />
                                                        {obj.url}
                                                    </div>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                                                {obj.type}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Comments */}
                    {comments.length > 0 && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                    <MessageSquare className="size-3.5" />
                                    Comments
                                </h3>
                                <div className="space-y-2">
                                    {comments.map((comment) => (
                                        <div key={comment.id} className="rounded-md border border-border/50 p-2">
                                            <div className="text-xs text-muted-foreground mb-1">
                                                {(comment.createdByName || comment.createdBy || 'Unknown user')}
                                                {comment.createdAt && ` - ${formatDate(comment.createdAt)}`}
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Activity Log */}
                    {(processingLogs.length > 0 || workflowLogs.length > 0) && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                    <History className="size-3.5" />
                                    Activity
                                </h3>
                                <div className="space-y-1">
                                    {processingLogs.map((log, idx) => (
                                        <ActivityRow
                                            key={`pl-${log.orderId ?? idx}`}
                                            source="Processing"
                                            log={log}
                                        />
                                    ))}
                                    {workflowLogs.map((log) => (
                                        <WorkflowActivityRow key={`wl-${log.id}`} log={log} />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Task Actions (claim/release) */}
                    {(task.supports.claim || task.supports.release) && (
                        <>
                            <Separator />
                            <div className="flex gap-2">
                                {task.supports.claim && onClaim && (
                                    <Button variant="outline" size="sm" onClick={onClaim}>
                                        <Hand className="size-3.5" />
                                        Claim
                                    </Button>
                                )}
                                {task.supports.release && onRelease && (
                                    <Button variant="outline" size="sm" onClick={onRelease}>
                                        <Undo2 className="size-3.5" />
                                        Release
                                    </Button>
                                )}
                            </div>
                        </>
                    )}

                    {/* Decision Panel */}
                    {decisions.length > 0 && (
                        <>
                            <Separator />
                            <DecisionPanel
                                decisions={decisions}
                                onExecute={onDecision}
                                isExecuting={isExecuting}
                            />
                        </>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

// ─── Meta Item ────────────────────────────────────────────

function MetaItem({
    icon: Icon,
    label,
    value,
    subText,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    subText?: string;
}) {
    return (
        <div className="flex items-start gap-2">
            <Icon className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium text-foreground">{value}</p>
                {subText && <p className="text-xs text-muted-foreground">{subText}</p>}
            </div>
        </div>
    );
}

// ─── Attribute Row ────────────────────────────────────────

function AttributeRow({ attribute }: { attribute: CustomAttribute }) {
    return (
        <div className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-muted-foreground">{attribute.label}</span>
            <span className="font-medium text-foreground text-right">{attribute.value}</span>
        </div>
    );
}

// ─── Loading Skeleton ─────────────────────────────────────

function ActivityRow({
    source,
    log,
}: {
    source: string;
    log: ProcessingLog;
}) {
    return (
        <div className="rounded-md border border-border/50 p-2">
            <div className="text-xs text-muted-foreground mb-1">
                {source}
                {log.timestamp && ` - ${formatDate(log.timestamp)}`}
                {log.performedByName && ` - ${log.performedByName}`}
            </div>
            <div className="text-sm font-medium">{log.actionName || log.taskStatus || 'Activity'}</div>
            {log.comments && <div className="text-sm text-muted-foreground">{log.comments}</div>}
        </div>
    );
}

function WorkflowActivityRow({ log }: { log: WorkflowLog }) {
    return (
        <div className="rounded-md border border-border/50 p-2">
            <div className="text-xs text-muted-foreground mb-1">
                Workflow
                {log.timestamp && ` - ${formatDate(log.timestamp)}`}
                {(log.userName || log.user) && ` - ${log.userName || log.user}`}
            </div>
            <div className="text-sm font-medium">{log.action || 'Workflow event'}</div>
            {log.details && <div className="text-sm text-muted-foreground">{log.details}</div>}
        </div>
    );
}

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return format(date, 'dd MMM yyyy, HH:mm');
}

function formatRelative(value: string): string | undefined {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return formatDistanceToNow(date, { addSuffix: true });
}

function TaskDetailSkeleton({ onBack, isMobile }: { onBack: () => void; isMobile: boolean }) {
    return (
        <div className="flex flex-col h-full">
            <div className="flex items-start gap-3 p-4 border-b border-border/50">
                {isMobile && (
                    <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5">
                        <ArrowLeft className="size-4" />
                    </Button>
                )}
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <div className="flex gap-2">
                        <Skeleton className="h-5 w-16 rounded-md" />
                        <Skeleton className="h-5 w-14 rounded-md" />
                    </div>
                </div>
            </div>
            <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-px w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-px w-full" />
                <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
                <Skeleton className="h-px w-full" />
                <Skeleton className="h-20 w-full" />
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>
        </div>
    );
}
