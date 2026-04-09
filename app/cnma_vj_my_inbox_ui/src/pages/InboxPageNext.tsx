import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftOpen } from 'lucide-react';
import { TaskList } from '@/components/inbox/TaskList';
import { TaskDetailView } from '@/components/inbox/TaskDetailView';
import { MassSelectionView } from '@/components/inbox/MassSelectionView';
import { useTasks, useTaskDetail, useDecision, useClaim, useRelease } from '@/hooks/useInbox';
import type { InboxTask } from '@/services/inbox/inbox.types';
import { useIsMobile } from '@/components/ui/use-mobile';
import { Button } from '@/components/ui/button';

export default function InboxPageNext() {
    const { taskId } = useParams<{ taskId?: string }>();
    const navigate = useNavigate();
    
    const selectedTaskId = taskId ? decodeURIComponent(taskId) : null;
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const isMobile = useIsMobile();

    const {
        data: tasksResponse,
        isLoading: isLoadingTasks,
        refetch: refetchTasks,
        isRefetching: isRefetchingTasks,
    } = useTasks();

    const {
        data: detailResponse,
        isLoading: isLoadingDetail,
    } = useTaskDetail(selectedTaskId);

    const decisionMutation = useDecision();
    const claimMutation = useClaim();
    const releaseMutation = useRelease();

    const tasks = tasksResponse?.items ?? [];
    const isLoadingList = isLoadingTasks;
    const isRefetchingList = isRefetchingTasks;

    // Auto-select first task on desktop after initial load
    const autoSelectedRef = useRef(false);
    useEffect(() => {
        if (isMobile || autoSelectedRef.current || isLoadingTasks) return;
        if (tasks.length > 0 && !selectedTaskId) {
            autoSelectedRef.current = true;
            navigate(`/tasks/${encodeURIComponent(tasks[0].instanceId)}`, { replace: true });
        }
    }, [isMobile, isLoadingTasks, tasks, selectedTaskId, navigate]);
    const handleSelectTask = useCallback((task: InboxTask) => {
        navigate(`/tasks/${encodeURIComponent(task.instanceId)}`);
    }, [navigate]);

    const handleBack = useCallback(() => {
        navigate('/');
    }, [navigate]);

    const handleDecision = useCallback(
        (decisionKey: string, comment: string) => {
            if (!selectedTaskId) return;
            // Forward task context to BFF to avoid redundant SAP $batch fetch
            const task = detailResponse?.detail?.task;
            decisionMutation.mutate(
                {
                    instanceId: selectedTaskId,
                    request: {
                        decisionKey,
                        comment,
                        type: 'APPR',
                        _context: task ? {
                            sapOrigin: task.sapOrigin,
                            documentId: task.businessContext?.documentId,
                            businessObjectType: task.businessContext?.type,
                        } : undefined,
                    },
                },
                {
                    onSuccess: () => navigate('/'),
                }
            );
        },
        [selectedTaskId, detailResponse, decisionMutation, navigate]
    );

    const handleMassDecision = useCallback(
        (decisionKey: string, comment: string, taskIds: string[]) => {
            const executeNext = (index: number) => {
                if (index >= taskIds.length) {
                    setSelectionMode(false);
                    setSelectedIds(new Set());
                    return;
                }
                decisionMutation.mutate(
                    { instanceId: taskIds[index], request: { decisionKey, comment, type: 'APPR' } },
                    {
                        onSuccess: () => executeNext(index + 1),
                        onError: () => executeNext(index + 1),
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

    const handleToggleSidebar = useCallback(() => {
        setSidebarCollapsed((current) => !current);
    }, []);


    const showMassSelection = selectionMode && selectedIds.size > 0;

    if (isMobile) {
        return (
            <div className="relative h-screen overflow-hidden bg-background">
                <AnimatePresence mode="wait">
                    {selectedTaskId ? (
                        <motion.div
                            key="detail"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
                            className="absolute inset-0 z-10 bg-background"
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
                                isLoading={isLoadingList}
                                onRefresh={refetchTasks}
                                isRefreshing={isRefetchingList}
                                isMobile
                                selectionMode={selectionMode}
                                selectedIds={selectedIds}
                                onSelectionModeChange={setSelectionMode}
                                onSelectedIdsChange={setSelectedIds}
                                onMassDecision={handleMassDecision}
                                isExecutingMass={decisionMutation.isPending}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    if (sidebarCollapsed) {
        return (
            <div className="h-screen bg-slate-100/80">
                <div className="flex h-full">
                    <aside className="w-14 shrink-0 border-r border-border/60 bg-background/95">
                        <div className="flex h-full items-start justify-center pt-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleToggleSidebar}
                                title="Expand sidebar"
                                className="h-8 w-8"
                            >
                                <PanelLeftOpen className="size-4" />
                            </Button>
                        </div>
                    </aside>
                    <main className="min-w-0 flex-1 bg-slate-50/70">
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
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-slate-100/80">
            <div className="flex h-full">
                <aside className="relative w-[320px] shrink-0 overflow-hidden border-r border-border/60 bg-background">
                    <TaskList
                        tasks={tasks}
                        selectedTaskId={selectedTaskId}
                        onSelectTask={handleSelectTask}
                        isLoading={isLoadingList}
                        onRefresh={refetchTasks}
                        isRefreshing={isRefetchingList}
                        onToggleCollapse={handleToggleSidebar}
                        selectionMode={selectionMode}
                        selectedIds={selectedIds}
                        onSelectionModeChange={setSelectionMode}
                        onSelectedIdsChange={setSelectedIds}
                    />
                </aside>
                <main className="relative min-w-0 flex-1 overflow-hidden bg-slate-50/70">
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
                            isApprovedScope={false}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}
