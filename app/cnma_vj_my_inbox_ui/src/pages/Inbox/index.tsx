import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { TaskList } from '@/pages/Inbox/components/TaskList';
import { TaskDetailView } from '@/pages/Inbox/components/TaskDetailView';
import { MassSelectionView } from '@/pages/Inbox/components/MassSelectionView';
import { TaskScopeSidebar, MobileSidebarSheet } from '@/pages/Inbox/components/TaskScopeSidebar';
import {
    useTasks,
    useApprovedTasks,
    useTaskInformation,
    useTaskDetail,
    useDecision,
} from '@/pages/Inbox/hooks/useInbox';
import type { InboxTask } from '@/services/inbox/inbox.types';
import { useIsMobile } from '@/components/ui/use-mobile';

type TaskScope = 'my' | 'approved';

export default function InboxPage() {
    const { t } = useTranslation();
    const PAGE_SIZE = 5;
    const DETAIL_PREFETCH_DELAY_MS = 200;
    const { taskId } = useParams<{ taskId?: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const selectedTaskId = taskId ? decodeURIComponent(taskId) : null;
    const [scope, setScope] = useState<TaskScope>(
        (location.state as any)?.scope || 'my'
    );
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(0);
    const [detailPrefetchTaskId, setDetailPrefetchTaskId] = useState<string | null>(null);
    const isMobile = useIsMobile();

    const skip = currentPage * PAGE_SIZE;
    const isMyScope = scope === 'my';
    const showTaskActions = true;

    const myTasksQuery = useTasks({
        top: PAGE_SIZE,
        skip,
        enabled: isMyScope,
    });
    const approvedTasksQuery = useApprovedTasks({
        top: PAGE_SIZE,
        skip,
        enabled: !isMyScope,
    });
    const activeTasksQuery = isMyScope ? myTasksQuery : approvedTasksQuery;
    const tasksResponse = activeTasksQuery.data;

    // Derive performance hints from the task list item so the backend can
    // skip redundant SAP lookups and enrich in parallel.
    const tasks = tasksResponse?.items ?? [];
    const selectedTask = selectedTaskId
        ? tasks.find((t) => t.instanceId === selectedTaskId)
        : undefined;
    const informationHints = selectedTask
        ? {
              sapOrigin: selectedTask.sapOrigin,
              documentId: selectedTask.businessContext?.documentId,
              businessObjectType: selectedTask.businessContext?.type,
          }
        : undefined;

    const {
        data: informationResponse,
        isLoading: isLoadingInformation,
    } = useTaskInformation(selectedTaskId, { hints: informationHints });

    useEffect(() => {
        setDetailPrefetchTaskId(null);
    }, [selectedTaskId]);

    useEffect(() => {
        if (!selectedTaskId) return;
        const infoTaskId = informationResponse?.detail?.task.instanceId;
        if (infoTaskId !== selectedTaskId) return;

        const timer = window.setTimeout(() => {
            setDetailPrefetchTaskId((current) =>
                current === selectedTaskId ? current : selectedTaskId
            );
        }, DETAIL_PREFETCH_DELAY_MS);

        return () => {
            window.clearTimeout(timer);
        };
    }, [selectedTaskId, informationResponse?.detail?.task.instanceId, DETAIL_PREFETCH_DELAY_MS]);

    const shouldLoadFullDetail = !!selectedTaskId && detailPrefetchTaskId === selectedTaskId;

    const { data: detailResponse } = useTaskDetail(selectedTaskId, {
        enabled: shouldLoadFullDetail,
    });

    const decisionMutation = useDecision();
    const totalTasks = tasksResponse?.total ?? 0;
    const isLoadingList = activeTasksQuery.isLoading;
    const isRefetchingList = activeTasksQuery.isRefetching;
    const isPageLoading = activeTasksQuery.isFetching && !activeTasksQuery.isLoading;
    const activeDetail = detailResponse?.detail ?? informationResponse?.detail;
    const isLoadingDetail = !!selectedTaskId && isLoadingInformation && !informationResponse?.detail;
    const isSecondaryLoading = !!selectedTaskId && shouldLoadFullDetail && !detailResponse?.detail;

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(totalTasks / PAGE_SIZE));
        if (currentPage > totalPages - 1) {
            setCurrentPage(totalPages - 1);
        }
    }, [currentPage, totalTasks, PAGE_SIZE]);

    // Auto-select first task on desktop when list loads and no task is selected
    const hasAutoSelected = useRef(false);
    useEffect(() => {
        if (hasAutoSelected.current) return;
        if (isMobile) return;
        if (selectedTaskId) return;
        if (isLoadingList) return;
        if (tasks.length === 0) return;

        hasAutoSelected.current = true;
        navigate(`/tasks/${encodeURIComponent(tasks[0].instanceId)}`, { replace: true });
    }, [isMobile, selectedTaskId, isLoadingList, tasks, navigate]);

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
            const task = activeDetail?.task;
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
        [selectedTaskId, activeDetail, decisionMutation, navigate]
    );

    const handleScopeChange = useCallback((nextScope: TaskScope) => {
        if (nextScope === scope) return;
        setScope(nextScope);
        setCurrentPage(0);
        setSelectionMode(false);
        setSelectedIds(new Set());
        hasAutoSelected.current = false;
        navigate('/');
    }, [scope, navigate]);

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

    const handleToggleSidebar = useCallback(() => {
        setSidebarCollapsed((current) => !current);
    }, []);

    const handleRefreshTasks = useCallback(() => {
        void activeTasksQuery.refetch();
    }, [activeTasksQuery]);

    const showMassSelection = showTaskActions && isMyScope && selectionMode && selectedIds.size > 0;

    if (isMobile) {
        return (
            <div className="relative h-screen flex flex-col overflow-hidden bg-background">
                {/* Mobile App Header — gradient background */}
                {!selectedTaskId && !selectionMode && (
                    <div
                        className="px-4 py-3 flex items-center shadow-sm relative z-20 shrink-0"
                        style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' }}
                    >
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/10 active:bg-white/20 absolute left-4"
                            aria-label="Open navigation menu"
                        >
                            <Menu size={22} className="text-white" />
                        </button>
                        <h1 className="text-lg font-bold text-white tracking-wide w-full text-center">
                            {scope === 'approved' ? t('nav.approvedTasks', 'Approved Tasks') : t('nav.myTasks', 'My Tasks')}
                        </h1>
                    </div>
                )}
                <div className="relative flex-1 min-h-0">
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
                                detail={activeDetail}
                                isLoading={isLoadingDetail}
                                isSecondaryLoading={isSecondaryLoading}
                                onBack={handleBack}
                                onDecision={handleDecision}
                                isExecuting={decisionMutation.isPending}
                                isMobile
                                isApprovedScope={!isMyScope}
                                showActionPanel={showTaskActions && isMyScope}
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
                                onRefresh={handleRefreshTasks}
                                isRefreshing={isRefetchingList}
                                currentPage={currentPage}
                                pageSize={PAGE_SIZE}
                                totalItems={totalTasks}
                                onPageChange={setCurrentPage}
                                isPageLoading={isPageLoading}
                                isMobile
                                selectionMode={selectionMode}
                                selectedIds={selectedIds}
                                onSelectionModeChange={setSelectionMode}
                                onSelectedIdsChange={setSelectedIds}
                                onMassDecision={showTaskActions && isMyScope ? handleMassDecision : undefined}
                                isExecutingMass={showTaskActions && isMyScope && decisionMutation.isPending}
                                showTaskActions={showTaskActions && isMyScope}
                                hasMobileScopeBar={false}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
                </div>
                <MobileSidebarSheet
                    isOpen={mobileMenuOpen}
                    onClose={() => setMobileMenuOpen(false)}
                    scope={scope}
                    onScopeChange={handleScopeChange}
                    username={tasksResponse?.identity?.btpUser}
                />
            </div>
        );
    }

    return (
        <div className="h-screen bg-slate-100/80">
            <div className="flex h-full">
                <TaskScopeSidebar
                    scope={scope}
                    onScopeChange={handleScopeChange}
                    isCollapsed={sidebarCollapsed}
                    onToggleCollapse={handleToggleSidebar}
                />
                <aside className="relative w-[320px] shrink-0 overflow-hidden border-r border-border/60 bg-background">
                    <TaskList
                        tasks={tasks}
                        selectedTaskId={selectedTaskId}
                        onSelectTask={handleSelectTask}
                        isLoading={isLoadingList}
                        onRefresh={handleRefreshTasks}
                        isRefreshing={isRefetchingList}
                        currentPage={currentPage}
                        pageSize={PAGE_SIZE}
                        totalItems={totalTasks}
                        onPageChange={setCurrentPage}
                        isPageLoading={isPageLoading}
                        selectionMode={selectionMode}
                        selectedIds={selectedIds}
                        onSelectionModeChange={setSelectionMode}
                        onSelectedIdsChange={setSelectedIds}
                        showTaskActions={showTaskActions && isMyScope}
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
                            detail={activeDetail}
                            isLoading={isLoadingDetail && !!selectedTaskId}
                            isSecondaryLoading={isSecondaryLoading}
                            onBack={handleBack}
                            onDecision={handleDecision}
                            isExecuting={decisionMutation.isPending}
                            isApprovedScope={!isMyScope}
                            showActionPanel={showTaskActions && isMyScope}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}
