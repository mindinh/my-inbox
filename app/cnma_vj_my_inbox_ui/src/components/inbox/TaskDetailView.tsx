import { useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { DecisionPanel } from './DecisionPanel';
import type { TaskDetail as TaskDetailType } from '@/services/inbox/inbox.types';
import { ArrowLeft, FileText, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ActivityPanel,
    AttachmentsPanel,
    BusinessPanel,
    CommentsPanel,
    StatusHeaderBadges,
    WorkflowApprovalPanel,
    makeTabDefinitions,
} from './TaskDetailPanels';
import { resolveBusinessSectionModel } from './TaskDetailSections.registry';

interface TaskDetailViewProps {
    detail: TaskDetailType | undefined;
    isLoading: boolean;
    onBack: () => void;
    onDecision: (decisionKey: string, comment: string) => void;
    isExecuting: boolean;
    onClaim?: () => void;
    onRelease?: () => void;
    isMobile?: boolean;
    isApprovedScope?: boolean;
}

export function TaskDetailView({
    detail,
    isLoading,
    onBack,
    onDecision,
    isExecuting,
    onClaim,
    onRelease,
    isMobile = false,
    isApprovedScope = false,
}: TaskDetailViewProps) {
    const businessModel = useMemo(
        () => (detail ? resolveBusinessSectionModel(detail) : null),
        [detail]
    );
    const [tabState, setTabState] = useState<{ taskId: string; tab: string }>({
        taskId: '',
        tab: 'business',
    });
    // Track direction for mobile tab animation
    const prevTabIndexRef = useRef(0);

    const queryClient = useQueryClient();
    const handleCommentAdded = useCallback(() => {
        if (!detail) return;
        queryClient.invalidateQueries({ queryKey: ['inbox', 'task', detail.task.instanceId] });
    }, [detail, queryClient]);

    const activeTab =
        detail && tabState.taskId === detail.task.instanceId ? tabState.tab : 'business';

    const isPRTask = detail?.task.businessContext?.type === 'PR';
    const approvalTree = isPRTask ? (detail?.businessContext?.pr as any)?.approvalTree : undefined;

    const tabs = useMemo(
        () => (detail ? makeTabDefinitions(detail, approvalTree?.steps?.length || 0, approvalTree?.comments) : []),
        [detail, approvalTree?.steps?.length, approvalTree?.comments]
    );

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

    // Render tab content (shared between mobile & desktop)
    const renderTabContent = (tabValue: string, mobile: boolean) => {
        switch (tabValue) {
            case 'business':
                return businessModel ? (
                    <BusinessPanel model={businessModel} detail={detail} isMobile={mobile} />
                ) : null;
            case 'workflow':
                return (
                    <WorkflowApprovalPanel
                        data={approvalTree}
                        isLoading={false}
                        error={undefined}
                    />
                );
            case 'attachments':
                return <AttachmentsPanel detail={detail} isMobile={mobile} />;
            case 'comments':
                return (
                    <CommentsPanel
                        detail={detail}
                        instanceId={detail.task.instanceId}
                        onCommentAdded={handleCommentAdded}
                        context={{
                            sapOrigin: detail.task.sapOrigin,
                            documentId: detail.task.businessContext?.documentId,
                            businessObjectType: detail.task.businessContext?.type,
                        }}
                        workflowComments={approvalTree?.comments}
                        isLoadingWorkflowComments={false}
                    />
                );
            case 'activity':
                return <ActivityPanel detail={detail} />;
            default:
                return null;
        }
    };

    // Compute mobile animation direction
    const currentTabIndex = tabs.findIndex((t) => t.value === activeTab);
    const animationDirection = currentTabIndex >= prevTabIndexRef.current ? 1 : -1;

    const handleMobileTabChange = (nextTab: string) => {
        prevTabIndexRef.current = tabs.findIndex((t) => t.value === activeTab);
        setTabState({ taskId: detail.task.instanceId, tab: nextTab });
    };

    return (
        <div className="flex h-full min-w-0 flex-col bg-slate-50/70">
            {/* ── Header ── */}
            <div className={cn(
                'border-b border-border/60 bg-background',
                isMobile ? 'px-4 py-3' : 'px-5 py-4'
            )}>
                <div className="flex items-start gap-3">
                    {isMobile && (
                        <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5 shrink-0">
                            <ArrowLeft className="size-4" />
                        </Button>
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                        <h2 className={cn(
                            'font-semibold text-foreground',
                            isMobile ? 'text-base leading-snug line-clamp-2' : 'text-xl truncate'
                        )}>
                            {detail.task.title}
                        </h2>
                        <StatusHeaderBadges detail={detail} />
                    </div>
                </div>
            </div>

            {/* ── Desktop Tabs (unchanged) ── */}
            {!isMobile && (
                <Tabs
                    value={activeTab}
                    onValueChange={(nextTab) =>
                        setTabState({
                            taskId: detail.task.instanceId,
                            tab: nextTab,
                        })
                    }
                    className="flex-1 min-h-0 w-full flex flex-col gap-0 border-t border-border/60"
                >
                    <TabsList className="h-auto w-full justify-start border-b border-border/60 bg-white px-3 py-0 gap-1">
                        {tabs.map((tab) => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className={cn(
                                    'h-10 min-w-[100px] rounded-none border-b-2 border-transparent px-3 text-sm text-muted-foreground',
                                    'hover:bg-slate-50 hover:text-foreground',
                                    'data-[state=active]:border-b-primary data-[state=active]:text-primary data-[state=active]:font-medium',
                                    'data-[state=active]:bg-transparent data-[state=active]:shadow-none [&>svg]:data-[state=active]:text-primary'
                                )}
                            >
                                <tab.icon className="size-4" />
                                <span>{tab.label}</span>
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                        {tab.count}
                                    </span>
                                )}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <ScrollArea className="flex-1 min-h-0">
                        <div className="w-full px-5 py-4 space-y-4 pb-6">
                            <TabsContent value="business" className="mt-0 w-full">
                                {businessModel && (
                                    <BusinessPanel model={businessModel} detail={detail} isMobile={false} />
                                )}
                            </TabsContent>
                            <TabsContent value="workflow" className="mt-0 w-full">
                                <WorkflowApprovalPanel
                                    data={approvalTree}
                                    isLoading={false}
                                    error={undefined}
                                />
                            </TabsContent>
                            <TabsContent value="attachments" className="mt-0 w-full">
                                <AttachmentsPanel detail={detail} />
                            </TabsContent>
                            <TabsContent value="comments" className="mt-0 w-full">
                                <CommentsPanel
                                    detail={detail}
                                    instanceId={detail.task.instanceId}
                                    onCommentAdded={handleCommentAdded}
                                    context={{
                                        sapOrigin: detail.task.sapOrigin,
                                        documentId: detail.task.businessContext?.documentId,
                                        businessObjectType: detail.task.businessContext?.type,
                                    }}
                                    workflowComments={approvalTree?.comments}
                                    isLoadingWorkflowComments={false}
                                />
                            </TabsContent>
                            <TabsContent value="activity" className="mt-0 w-full">
                                <ActivityPanel detail={detail} />
                            </TabsContent>
                        </div>
                    </ScrollArea>
                </Tabs>
            )}

            {/* ── Mobile Tabs ── */}
            {isMobile && (
                <>
                    {/* Scrollable tab bar */}
                    <div className="shrink-0 border-b border-border/60 bg-white">
                        <div className="flex overflow-x-auto no-scrollbar">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.value;
                                return (
                                    <button
                                        key={tab.value}
                                        onClick={() => handleMobileTabChange(tab.value)}
                                        className={cn(
                                            'relative shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors',
                                            'focus-visible:outline-none',
                                            isActive
                                                ? 'text-primary'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <tab.icon className="size-3.5" />
                                        <span>{tab.label}</span>
                                        {tab.count !== undefined && tab.count > 0 && (
                                            <span className={cn(
                                                'ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold',
                                                isActive
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'bg-muted text-muted-foreground'
                                            )}>
                                                {tab.count}
                                            </span>
                                        )}
                                        {/* Active indicator line */}
                                        {isActive && (
                                            <motion.div
                                                layoutId={`mobile-tab-indicator-${detail.task.instanceId}`}
                                                className="absolute inset-x-0 bottom-0 h-[2px] bg-primary rounded-full"
                                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Animated tab content */}
                    <div className="flex-1 min-h-0 overflow-hidden relative">
                        <AnimatePresence initial={false} mode="popLayout" custom={animationDirection}>
                            <motion.div
                                key={activeTab}
                                custom={animationDirection}
                                initial={{ x: `${animationDirection * 30}%`, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: `${-animationDirection * 30}%`, opacity: 0 }}
                                transition={{ type: 'tween', duration: 0.2, ease: 'easeInOut' }}
                                className="absolute inset-0"
                            >
                                <ScrollArea className="h-full">
                                    <div className="px-4 py-4 pb-24 space-y-4">
                                        {renderTabContent(activeTab, true)}
                                    </div>
                                </ScrollArea>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </>
            )}

            {/* ── Desktop: docked action footer ── */}
            {!isMobile && (
                <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm px-5 py-3 empty:hidden">
                    <TaskActionPanel
                        detail={detail}
                        onDecision={onDecision}
                        isExecuting={isExecuting}
                        onClaim={onClaim}
                        onRelease={onRelease}
                        isApprovedScope={isApprovedScope}
                    />
                </div>
            )}

            {/* ── Mobile: floating action bar ── */}
            {isMobile && (
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
                    <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/98 p-3 shadow-[0_12px_28px_rgba(15,23,42,0.14)] empty:hidden">
                        <TaskActionPanel
                            detail={detail}
                            onDecision={onDecision}
                            isExecuting={isExecuting}
                            onClaim={onClaim}
                            onRelease={onRelease}
                            isApprovedScope={isApprovedScope}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function TaskActionPanel({
    detail,
    onDecision,
    isExecuting,
    onClaim,
    onRelease,
    isApprovedScope,
}: {
    detail: TaskDetailType;
    onDecision: (decisionKey: string, comment: string) => void;
    isExecuting: boolean;
    onClaim?: () => void;
    onRelease?: () => void;
    isApprovedScope?: boolean;
}) {
    if (isApprovedScope) {
        return (
            <div className="flex w-full items-center justify-end">
                <Button variant="outline" className="font-semibold text-slate-700" size="sm" onClick={() => { }} disabled={isExecuting}>
                    <Undo2 className="size-4 mr-1.5" />
                    Undo
                </Button>
            </div>
        );
    }

    const hasAction = detail.decisions.length > 0;
    if (!hasAction) return null;

    return (
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {detail.decisions.length > 0 && (
                <DecisionPanel
                    decisions={detail.decisions}
                    onExecute={onDecision}
                    isExecuting={isExecuting}
                />
            )}
        </div>
    );
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
                    <Skeleton className="h-6 w-2/3" />
                    <div className="flex gap-2">
                        <Skeleton className="h-5 w-20 rounded-md" />
                        <Skeleton className="h-5 w-20 rounded-md" />
                        <Skeleton className="h-5 w-20 rounded-md" />
                    </div>
                </div>
            </div>
            {isMobile ? (
                <>
                    <div className="flex gap-1 px-4 py-2 border-b border-border/50">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-9 w-20 rounded-lg" />
                        ))}
                    </div>
                    <div className="p-4 space-y-4">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-[160px] w-full" />
                    </div>
                </>
            ) : (
                <div className="p-4 space-y-4">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-[160px] w-full" />
                    <Skeleton className="h-[220px] w-full" />
                </div>
            )}
        </div>
    );
}
