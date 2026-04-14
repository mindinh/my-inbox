/**
 * WorkflowApprovalPanel — displays the PR approval tree with expandable steps.
 */
import { useState } from 'react';
import { CheckCircle2, Circle, Check, User, Clock3, MessageSquare, Loader2 } from 'lucide-react';
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
    taskDetail,
}: {
    data?: WorkflowApprovalTreeResponse;
    isLoading: boolean;
    error?: string;
    taskDetail?: { createdByName?: string };
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
        <div className="bg-white px-5 py-6 rounded-none sm:rounded-xl shadow-none sm:shadow-sm">
            <h3 className="text-[13px] font-bold uppercase tracking-widest text-foreground mb-6">Workflow Progress</h3>

            {isLoading && (
                <div className="py-5 text-sm text-muted-foreground">
                    Loading workflow approval steps...
                </div>
            )}

            {!isLoading && error && (
                <div className="rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                    {error}
                </div>
            )}

            {!isLoading && !error && steps.length === 0 && (
                <div className="py-5 text-sm text-muted-foreground italic">
                    No workflow approval steps found for this task.
                </div>
            )}

            {!isLoading && !error && steps.length > 0 && (
                <div className="space-y-0">
                    {steps.map((step, index) => {
                        const isCurrent = index === currentIndex;
                        const isNext = index === nextIndex;
                        const isCompleted = currentIndex >= 0 ? index < currentIndex : normalizeApprovalStatus(step.status) === 'APPROVED';
                        const isPending = !isCompleted && !isCurrent;
                        const statusRaw = normalizeApprovalStatus(step.status);
                        const isExpanded = expandedStepLevels.includes(step.level);
                        
                        const title = step.approver || `Level ${step.level}`;
                        const initial = typeof title === 'string' && title.length > 0 ? title.charAt(0).toUpperCase() : 'C';

                        // Line color determination
                        let lineClasses = "hidden";
                        if (isCompleted) {
                            lineClasses = "bg-emerald-500 w-[2px]";
                        } else if (isCurrent) {
                            lineClasses = "border-l-[2px] border-dotted border-blue-400 w-[2px]";
                        } else {
                            lineClasses = "border-l-[2px] border-dotted border-slate-200 w-[2px]";
                        }

                        return (
                            <motion.div
                                key={`${step.prNumber}-${step.level}-${index}`}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className="flex relative items-stretch"
                            >
                                {/* Left icon & vertical line */}
                                <div className="flex flex-col items-center mr-4 w-7 shrink-0 relative">
                                    <div className="z-10 bg-white py-1">
                                        {isCompleted ? (
                                            <div className="flex items-center justify-center size-[26px] rounded-full bg-emerald-500 text-white shadow-sm ring-4 ring-white">
                                                <CheckCircle2 className="size-[15px]" />
                                            </div>
                                        ) : isCurrent ? (
                                            <div className="flex items-center justify-center size-[26px] rounded-full bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.25)] ring-4 ring-white font-medium text-xs">
                                                <Loader2 className="size-[14px] animate-spin" />
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center size-[26px] rounded-full border-2 border-slate-200 bg-white ring-4 ring-white">
                                                <div className="size-2 rounded-full border border-slate-200" />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* The connecting line */}
                                    <div className={cn("absolute top-[34px] bottom-[-4px] left-1/2 -translate-x-1/2", lineClasses)} />
                                </div>

                                {/* Content block */}
                                <div className="flex-1 pb-8 min-w-0">
                                    <div className="flex items-start justify-between">
                                        <h4 className={cn(
                                            "text-base flex items-center gap-2 font-semibold truncate mb-1.5 mt-1",
                                            isCurrent ? "text-foreground" : "text-slate-700",
                                            isPending && "text-slate-500"
                                        )}>
                                            <span>{title}</span>
                                            {isCurrent && <Badge variant="warning" className="h-5 px-1.5 text-[10px]">Current</Badge>}
                                            {isNext && <Badge variant="info" className="h-5 px-1.5 text-[10px]">Next</Badge>}
                                        </h4>
                                        {step.noteText && (
                                            <button 
                                                onClick={() => toggleExpand(step.level)}
                                                className="text-[12px] text-muted-foreground hover:text-foreground font-medium shrink-0 mt-1.5 transition-colors"
                                            >
                                                {isExpanded ? "Hide comment" : "Show comment"}
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-1.5 text-[13px]">
                                        <div className="flex items-start gap-1.5 truncate">
                                            <span className="text-muted-foreground w-16 shrink-0">Status:</span>
                                            <span className={cn(
                                                "font-medium",
                                                isCompleted ? "text-emerald-600" : (isCurrent ? "text-blue-600" : "text-slate-500")
                                            )}>
                                                {formatApprovalStatus(statusRaw)}
                                            </span>
                                        </div>
                                        
                                        {step.approverUserId && (
                                            <div className="flex items-start gap-1.5 truncate">
                                                <span className="text-muted-foreground w-16 shrink-0">Approver:</span>
                                                <span className={cn("inline-flex items-center gap-1", isPending ? "text-slate-500" : "text-slate-700")}>
                                                    <User className="size-3 text-slate-400" />
                                                    {step.approverUserId}
                                                </span>
                                            </div>
                                        )}

                                        {step.postedOn && (
                                            <div className="flex items-start gap-1.5 truncate">
                                                <span className="text-muted-foreground w-16 shrink-0">Date:</span>
                                                <span className={isPending ? "text-slate-500" : "text-slate-700"}>
                                                    {step.postedOn} {step.postedTime?.split('.')[0] || ''}
                                                </span>
                                            </div>
                                        )}
                                        
                                        {step.noteText && (
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                        animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                                                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="bg-slate-50 rounded-lg p-3 text-slate-700 border border-slate-100 flex gap-2 w-full">
                                                            <MessageSquare className="size-3.5 mt-0.5 text-slate-400 shrink-0" />
                                                            <span className="whitespace-pre-wrap">{step.noteText}</span>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
