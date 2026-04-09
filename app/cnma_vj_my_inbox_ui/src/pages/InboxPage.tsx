import { useState, useCallback } from 'react';
import { TaskList } from '@/components/inbox/TaskList';
import { TaskDetailView } from '@/components/inbox/TaskDetailView';
import { MassSelectionView } from '@/components/inbox/MassSelectionView';
import { useTasks, useTaskDetail, useDecision, useClaim, useRelease } from '@/hooks/useInbox';
import type { InboxTask } from '@/services/inbox/inbox.types';
import { useIsMobile } from '@/components/ui/use-mobile';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * InboxPage — Master-detail layout for task processing.
 *
 * Desktop: [ Task List (380px) | Task Detail (flex-1) ]
 * Mobile:  List → click → full screen detail (animated slide)
 *
 * When selection mode is active with multiple tasks, the right panel
 * shows a MassSelectionView with a summary table and mass Approve/Reject.
 */
export default function InboxPage() {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const isMobile = useIsMobile();

    // ─── Data ─────────────────────────────────────────────
    const {
        data: tasksResponse,
        isLoading: isLoadingTasks,
        refetch: refetchTasks,
        isRefetching,
    } = useTasks();

    const {
        data: detailResponse,
        isLoading: isLoadingDetail,
    } = useTaskDetail(selectedTaskId);

    const decisionMutation = useDecision();
    const claimMutation = useClaim();
    const releaseMutation = useRelease();

    // ─── Handlers ─────────────────────────────────────────
    const handleSelectTask = useCallback((task: InboxTask) => {
        setSelectedTaskId(task.instanceId);
    }, []);

    const handleBack = useCallback(() => {
        setSelectedTaskId(null);
    }, []);

    const handleDecision = useCallback(
        (decisionKey: string, comment: string) => {
            if (!selectedTaskId) return;
            decisionMutation.mutate(
                { instanceId: selectedTaskId, request: { decisionKey, comment, type: 'APPR' } },
                {
                    onSuccess: () => {
                        // After decision, deselect and refresh list
                        setSelectedTaskId(null);
                    },
                }
            );
        },
        [selectedTaskId, decisionMutation]
    );

    const handleMassDecision = useCallback(
        (decisionKey: string, comment: string, taskIds: string[]) => {
            // Execute decisions sequentially for each selected task
            const executeNext = (index: number) => {
                if (index >= taskIds.length) {
                    // All done — clear selection
                    setSelectionMode(false);
                    setSelectedIds(new Set());
                    return;
                }
                decisionMutation.mutate(
                    { instanceId: taskIds[index], request: { decisionKey, comment, type: 'APPR' } },
                    {
                        onSuccess: () => executeNext(index + 1),
                        onError: () => executeNext(index + 1), // Skip failed, continue
                    }
                );
            };
            executeNext(0);
        },
        [decisionMutation]
    );

    const handleToggleSelection = useCallback((taskId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    }, []);

    const handleClaim = useCallback(() => {
        if (selectedTaskId) claimMutation.mutate(selectedTaskId);
    }, [selectedTaskId, claimMutation]);

    const handleRelease = useCallback(() => {
        if (selectedTaskId) releaseMutation.mutate(selectedTaskId);
    }, [selectedTaskId, releaseMutation]);

    const tasks = tasksResponse?.items ?? [];

    // Determine whether to show mass selection view
    const showMassSelection = selectionMode && selectedIds.size > 0;

    // ─── Mobile Layout ────────────────────────────────────
    if (isMobile) {
        return (
            <div className="h-screen bg-background relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {selectedTaskId ? (
                        <motion.div
                            key="detail"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
                            className="absolute inset-0 bg-background z-10"
                        >
                            <TaskDetailView
                                detail={detailResponse?.detail}
                                isLoading={isLoadingDetail}
                                onBack={handleBack}
                                onDecision={handleDecision}
                                isExecuting={decisionMutation.isPending}
                                onClaim={handleClaim}
                                onRelease={handleRelease}
                                isMobile
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0.8 }}
                            animate={{ opacity: 1 }}
                            className="h-full"
                        >
                            <TaskList
                                tasks={tasks}
                                selectedTaskId={selectedTaskId}
                                onSelectTask={handleSelectTask}
                                isLoading={isLoadingTasks}
                                onRefresh={() => refetchTasks()}
                                isRefreshing={isRefetching}
                                showScopeTabs={false}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // ─── Desktop Layout ───────────────────────────────────
    return (
        <div className="h-screen bg-slate-100/80 flex">
            {/* Task List — fixed width sidebar */}
            <div
                className={cn(
                    'w-[380px] min-w-[320px] border-r border-border/60 bg-background',
                    'flex flex-col shrink-0'
                )}
            >
                <TaskList
                    tasks={tasks}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={handleSelectTask}
                    isLoading={isLoadingTasks}
                    onRefresh={() => refetchTasks()}
                    isRefreshing={isRefetching}
                    showScopeTabs
                    selectionMode={selectionMode}
                    selectedIds={selectedIds}
                    onSelectionModeChange={setSelectionMode}
                    onSelectedIdsChange={setSelectedIds}
                />
            </div>

            {/* Detail Panel — fills remaining space */}
            <div className="flex-1 min-w-0 bg-slate-50/70">
                {showMassSelection ? (
                    <MassSelectionView
                        tasks={tasks}
                        selectedIds={selectedIds}
                        onToggleSelection={handleToggleSelection}
                        onMassDecision={handleMassDecision}
                        isExecuting={decisionMutation.isPending}
                    />
                ) : (
                    <TaskDetailView
                        detail={detailResponse?.detail}
                        isLoading={isLoadingDetail && !!selectedTaskId}
                        onBack={handleBack}
                        onDecision={handleDecision}
                        isExecuting={decisionMutation.isPending}
                        onClaim={handleClaim}
                        onRelease={handleRelease}
                    />
                )}
            </div>
        </div>
    );
}
