/**
 * WorkflowApprovalPanel — displays the PR approval tree with expandable steps.
 */
import { useState } from 'react';
import { CheckCircle2, Circle, Clock3, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { WorkflowApprovalTreeResponse } from '@/services/inbox/inbox.types';
import { safe } from '@/pages/Inbox/utils/formatters';
import {
    normalizeApprovalStatus,
    isPendingApprovalStatus,
    formatApprovalStatus,
} from '@/pages/Inbox/utils/predicates';
import { cn } from '@/lib/utils';

export function WorkflowApprovalPanel({
    data,
    isLoading,
    error,
}: {
    data?: WorkflowApprovalTreeResponse;
    isLoading: boolean;
    error?: string;
}) {
    const [expandedStepLevels, setExpandedStepLevels] = useState<number[]>([]);

    const toggleExpand = (level: number) => {
        setExpandedStepLevels(prev =>
            prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
        );
    };

    const steps = [...(data?.steps || [])].sort((a, b) => a.level - b.level);
    const currentIndex = steps.findIndex((step) => isPendingApprovalStatus(step.status));
    const nextIndex = currentIndex >= 0 && currentIndex < steps.length - 1 ? currentIndex + 1 : -1;

    return (
        <Card className="gap-0 bg-card border-border/70 shadow-sm">
            <CardHeader>
                <CardTitle className="text-base">Workflow Approval Tree</CardTitle>
                <CardDescription>
                    {data?.prNumber ? `PR ${data.prNumber}` : 'Approval sequence from SAP'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {isLoading && (
                    <div className="rounded-lg border border-border/70 px-4 py-5 text-sm text-muted-foreground">
                        Loading workflow approval steps...
                    </div>
                )}

                {!isLoading && error && (
                    <div className="rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                        {error}
                    </div>
                )}

                {!isLoading && !error && steps.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                        No workflow approval steps found for this task.
                    </div>
                )}

                {!isLoading && !error && steps.length > 0 && (
                    <div className="relative pl-1">
                        <div className="absolute left-[15px] top-1 bottom-1 w-px bg-border/80" />
                        <div className="space-y-2.5">
                            {steps.map((step, index) => {
                                const isCurrent = index === currentIndex;
                                const isNext = index === nextIndex;
                                const isCompleted = currentIndex >= 0 ? index < currentIndex : normalizeApprovalStatus(step.status) === 'APPROVED';
                                const status = normalizeApprovalStatus(step.status);
                                const isExpanded = expandedStepLevels.includes(step.level);
                                const formattedDate = step.postedOn ? `${step.postedOn}${step.postedTime ? ` ${step.postedTime.split('.')[0]}` : ''}` : 'No date provided';
                                const noteData = step.noteText;

                                return (
                                    <motion.div
                                        key={`${step.prNumber}-${step.level}-${index}`}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2, delay: index * 0.04 }}
                                        className="relative pl-10"
                                    >
                                        <div className="absolute left-0 top-1">
                                            {isCompleted ? (
                                                <CheckCircle2 className="size-6 rounded-full bg-emerald-50 p-1 text-emerald-600" />
                                            ) : (
                                                <Circle
                                                    className={cn(
                                                        'size-6 rounded-full p-1',
                                                        isCurrent && 'bg-amber-50 text-amber-600',
                                                        isNext && 'bg-blue-50 text-blue-600',
                                                        !isCurrent && !isNext && 'bg-slate-100 text-slate-500'
                                                    )}
                                                />
                                            )}
                                        </div>
                                        <div
                                            className={cn(
                                                "rounded-lg border border-border/70 bg-background/95 px-3 py-2.5 transition-colors",
                                                isCompleted ? "cursor-pointer hover:bg-slate-50" : ""
                                            )}
                                            onClick={() => isCompleted && toggleExpand(step.level)}
                                        >
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <span className="font-semibold text-foreground/80">Level {step.level}</span>
                                                <span>•</span>
                                                <span>Code {safe(step.releaseCode)}</span>
                                                {isCurrent && <Badge variant="warning">Current</Badge>}
                                                {isNext && <Badge variant="info">Next</Badge>}
                                            </div>
                                            <div className="mt-1 text-sm font-semibold">
                                                {safe(step.approver || step.approverUserId)}
                                            </div>
                                            {step.approverUserId && (
                                                <div className="mt-0.5 text-xs text-muted-foreground">
                                                    User ID: {step.approverUserId}
                                                </div>
                                            )}
                                            <div className="mt-0.5 flex justify-between items-center text-sm text-muted-foreground">
                                                <span>Status: {formatApprovalStatus(status)}</span>
                                                {isCompleted && (
                                                    <span className="text-xs text-muted-foreground/70">
                                                        {isExpanded ? "Hide details" : "Show details"}
                                                    </span>
                                                )}
                                            </div>

                                            <AnimatePresence>
                                                {isExpanded && isCompleted && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                        animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                                                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="pt-3 border-t border-border/60">
                                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                                                                <Clock3 className="size-3" />
                                                                <span>{formattedDate}</span>
                                                            </div>
                                                            {noteData ? (
                                                                <div className="rounded bg-slate-50 p-2.5 text-sm text-slate-700 border border-slate-100">
                                                                    <div className="flex items-start gap-2">
                                                                        <MessageSquare className="size-3.5 mt-0.5 text-slate-400 shrink-0" />
                                                                        <span>{noteData}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-slate-400 italic">No notes provided for approval.</div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
