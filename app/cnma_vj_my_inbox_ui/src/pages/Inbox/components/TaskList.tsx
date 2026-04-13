/**
 * TaskList — container component for the inbox task list.
 *
 * Phase 3 decomposition: this file now delegates to:
 *   - useTaskSelection (selection state)
 *   - useTaskFilters   (filter state + client-side filtering)
 *   - MassActionBar    (bulk action UI)
 *   - TaskPagination   (prev/next pagination)
 *   - TaskCard         (individual task rendering)
 */
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskCard } from './TaskCard';
import { MassActionBar } from './MassActionBar';
import { TaskPagination } from './TaskPagination';
import type { InboxTask } from '@/services/inbox/inbox.types';
import {
    Inbox,
    RefreshCw,
    ListChecks,
    X,
    PanelLeftClose,
    Filter,
    Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Drawer,
    DrawerContent,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { FilterBar } from '@/components/filterbar';
import { useTaskSelection } from '@/pages/Inbox/hooks/useTaskSelection';
import { useTaskFilters } from '@/pages/Inbox/hooks/useTaskFilters';


interface TaskListProps {
    tasks: InboxTask[];
    selectedTaskId: string | null;
    onSelectTask: (task: InboxTask) => void;
    isLoading: boolean;
    onRefresh: () => void;
    isRefreshing: boolean;
    currentPage?: number;
    pageSize?: number;
    totalItems?: number;
    onPageChange?: (page: number) => void;
    isPageLoading?: boolean;
    showScopeTabs?: boolean;
    myTasksCount?: number;
    approvedTasksCount?: number;
    scope?: 'my' | 'approved';
    onScopeChange?: (scope: 'my' | 'approved') => void;
    onToggleCollapse?: () => void;
    isMobile?: boolean;
    selectionMode?: boolean;
    selectedIds?: Set<string>;
    onSelectionModeChange?: (mode: boolean) => void;
    onSelectedIdsChange?: (ids: Set<string>) => void;
    onMassDecision?: (decisionKey: string, comment: string, taskIds: string[]) => void;
    isExecutingMass?: boolean;
    showTaskActions?: boolean;
    hasMobileScopeBar?: boolean;
}

export function TaskList({
    tasks,
    selectedTaskId,
    onSelectTask,
    isLoading,
    onRefresh,
    isRefreshing,
    currentPage = 0,
    pageSize = 20,
    totalItems = tasks.length,
    onPageChange,
    isPageLoading = false,
    showScopeTabs = false,
    myTasksCount,
    approvedTasksCount,
    scope = 'my',
    onScopeChange,
    onToggleCollapse,
    isMobile = false,
    selectionMode: externalSelectionMode,
    selectedIds: externalSelectedIds,
    onSelectionModeChange,
    onSelectedIdsChange,
    onMassDecision,
    isExecutingMass = false,
    showTaskActions = true,
    hasMobileScopeBar = false,
}: TaskListProps) {
    // ─── Hooks ─────────────────────────────────────────────
    const selection = useTaskSelection({
        selectionMode: externalSelectionMode,
        selectedIds: externalSelectedIds,
        onSelectionModeChange,
        onSelectedIdsChange,
    });

    const filters = useTaskFilters(tasks);

    // ─── Derived state ─────────────────────────────────────
    const pageStart = totalItems === 0 ? 0 : currentPage * pageSize + 1;
    const pageEnd = totalItems === 0 ? 0 : Math.min(currentPage * pageSize + tasks.length, totalItems);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const selectionSummary = showTaskActions && selection.selectionMode
        ? `${selection.selectedIds.size} selected`
        : filters.hasLocalFilter
            ? `Showing ${filters.filteredTasks.length} of ${tasks.length} on this page`
            : `Showing ${pageStart}-${pageEnd} of ${totalItems}`;

    // ─── Loading skeleton ──────────────────────────────────
    if (isLoading) {
        return <TaskListSkeleton />;
    }

    return (
        <div
            className={cn(
                'flex h-full flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#f4f7fb_100%)]',
                isMobile && 'bg-slate-50'
            )}
        >
            {/* ── Desktop Header ── */}
            {!isMobile && (
                <div className="border-b border-border/60">
                    <DesktopHeader
                        totalItems={totalItems}
                        selectionMode={selection.selectionMode}
                        exitSelectionMode={selection.exitSelectionMode}
                        enterSelectionMode={() => selection.setSelectionMode(true)}
                        showTaskActions={showTaskActions}
                        onRefresh={onRefresh}
                        isRefreshing={isRefreshing}
                        onToggleCollapse={onToggleCollapse}
                    />

                    {showScopeTabs && (
                        <ScopeTabs
                            scope={scope}
                            onScopeChange={onScopeChange}
                            myTasksCount={myTasksCount ?? (scope === 'my' ? totalItems : 0)}
                            approvedTasksCount={approvedTasksCount ?? (scope === 'approved' ? totalItems : 0)}
                        />
                    )}

                    <div className="px-3 pb-3">
                        <FilterBar
                            config={filters.filterConfig}
                            allFilterConfig={filters.allFilterConfig}
                            values={filters.filterValues}
                            onChange={filters.setFilterValues}
                            onApply={filters.handleFilterApply}
                            onClear={filters.handleFilterClear}
                            onAdaptFilter={filters.handleAdaptFilter}
                            isLoading={isRefreshing}
                            defaultExpanded={false}
                        />
                    </div>

                    <div className="px-4 pb-2 text-xs font-medium text-slate-500">
                        {selectionSummary}
                    </div>
                </div>
            )}

            {/* ── Mobile Header ── */}
            {isMobile && (
                <MobileHeader
                    totalItems={totalItems}
                    showScopeTabs={showScopeTabs}
                    scope={scope}
                    onScopeChange={onScopeChange}
                    myTasksCount={myTasksCount ?? (scope === 'my' ? totalItems : 0)}
                    approvedTasksCount={approvedTasksCount ?? (scope === 'approved' ? totalItems : 0)}
                    filterValues={filters.filterValues}
                    setFilterValues={filters.setFilterValues}
                    handleFilterApply={filters.handleFilterApply}
                    selectionSummary={selectionSummary}
                    onRefresh={onRefresh}
                    isRefreshing={isRefreshing}
                    mobileActiveFilterCount={filters.mobileActiveFilterCount}
                    onOpenFilters={() => filters.setMobileFiltersOpen(true)}
                    selectionMode={selection.selectionMode}
                    exitSelectionMode={selection.exitSelectionMode}
                    enterSelectionMode={() => selection.setSelectionMode(true)}
                    showTaskActions={showTaskActions}
                />
            )}

            {/* ── Desktop Select All ── */}
            {showTaskActions && selection.selectionMode && filters.filteredTasks.length > 0 && !isMobile && (
                <MassActionBar
                    selectedCount={selection.selectedIds.size}
                    totalCount={filters.filteredTasks.length}
                    onToggleSelectAll={() => selection.toggleSelectAll(filters.filteredTasks)}
                    onMassDecision={onMassDecision}
                    selectedIds={selection.selectedIds}
                    isExecuting={isExecutingMass}
                    isMobile={false}
                />
            )}

            {/* ── Task Results ── */}
            <ScrollArea className="flex-1">
                {filters.filteredTasks.length === 0 ? (
                    <EmptyState hasSearch={!!filters.appliedValues.search?.trim()} hasFilters={true} />
                ) : (
                    <div
                        className={cn(
                            'space-y-2 p-2.5',
                            isMobile && 'space-y-3 px-4 pb-24 pt-1'
                        )}
                    >
                        {filters.filteredTasks.map((task) => (
                            <div key={task.instanceId} className="flex items-start gap-2">
                                {showTaskActions && selection.selectionMode && (
                                    <div className={cn('shrink-0 pl-1', isMobile ? 'pt-4' : 'pt-3')}>
                                        <Checkbox
                                            checked={selection.selectedIds.has(task.instanceId)}
                                            onCheckedChange={() => selection.toggleSelection(task.instanceId)}
                                        />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <TaskCard
                                        task={task}
                                        isSelected={task.instanceId === selectedTaskId}
                                        onClick={() =>
                                            showTaskActions && selection.selectionMode
                                                ? selection.toggleSelection(task.instanceId)
                                                : onSelectTask(task)
                                        }
                                        variant={isMobile ? 'mobile' : 'desktop'}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* ── Pagination ── */}
            {onPageChange && (
                <div className={cn(isMobile && hasMobileScopeBar && 'pb-16')}>
                    <TaskPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        isLoading={isPageLoading}
                        onPageChange={onPageChange}
                    />
                </div>
            )}

            {/* ── Mobile Mass Action Bar ── */}
            {showTaskActions && selection.selectionMode && isMobile && filters.filteredTasks.length > 0 && (
                <MassActionBar
                    selectedCount={selection.selectedIds.size}
                    totalCount={filters.filteredTasks.length}
                    onToggleSelectAll={() => selection.toggleSelectAll(filters.filteredTasks)}
                    onMassDecision={onMassDecision}
                    selectedIds={selection.selectedIds}
                    isExecuting={isExecutingMass}
                    isMobile={true}
                />
            )}

            {/* ── Mobile Filter Drawer ── */}
            <Drawer
                open={filters.mobileFiltersOpen}
                onOpenChange={filters.setMobileFiltersOpen}
                direction="bottom"
            >
                <DrawerContent className="h-[100dvh] rounded-none border-none p-0">
                    <FilterBar
                        isMobile={true}
                        config={filters.filterConfig}
                        allFilterConfig={filters.allFilterConfig}
                        values={filters.filterValues}
                        onChange={filters.setFilterValues}
                        onApply={(v) => {
                            filters.handleFilterApply(v);
                            filters.setMobileFiltersOpen(false);
                        }}
                        onClear={filters.handleFilterClear}
                        onAdaptFilter={filters.handleAdaptFilter}
                        isLoading={isRefreshing}
                    />
                </DrawerContent>
            </Drawer>
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────

function DesktopHeader({
    totalItems,
    selectionMode,
    exitSelectionMode,
    enterSelectionMode,
    showTaskActions,
    onRefresh,
    isRefreshing,
    onToggleCollapse,
}: {
    totalItems: number;
    selectionMode: boolean;
    exitSelectionMode: () => void;
    enterSelectionMode: () => void;
    showTaskActions: boolean;
    onRefresh: () => void;
    isRefreshing: boolean;
    onToggleCollapse?: () => void;
}) {
    return (
        <div className="flex items-center justify-between px-3 py-3">
            <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-slate-800">All Tasks</h2>
                <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {totalItems}
                </span>
            </div>
            <div className="flex items-center gap-0.5">
                {showTaskActions && (
                    <Button
                        variant={selectionMode ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={() => (selectionMode ? exitSelectionMode() : enterSelectionMode())}
                        className="h-8 w-8 rounded-lg hover:bg-slate-100"
                        title={selectionMode ? 'Exit selection' : 'Select tasks'}
                    >
                        {selectionMode ? <X className="size-4" /> : <ListChecks className="size-4" />}
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRefresh?.()}
                    disabled={isRefreshing}
                    className="h-8 w-8 rounded-lg hover:bg-slate-100"
                    title="Refresh"
                >
                    <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
                {onToggleCollapse && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleCollapse}
                        className="h-8 w-8 rounded-lg hover:bg-slate-100"
                        title="Collapse sidebar"
                    >
                        <PanelLeftClose className="size-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function ScopeTabs({
    scope,
    onScopeChange,
    myTasksCount,
    approvedTasksCount,
}: {
    scope: 'my' | 'approved';
    onScopeChange?: (scope: 'my' | 'approved') => void;
    myTasksCount: number;
    approvedTasksCount: number;
}) {
    return (
        <div className="px-0 pb-3">
            <Tabs
                value={scope}
                onValueChange={(next) => onScopeChange?.(next as 'my' | 'approved')}
                className="gap-0"
            >
                <TabsList className="h-auto w-full justify-start border-b border-border/60 bg-transparent px-3 py-0 gap-1 rounded-none shadow-none">
                    <TabsTrigger
                        value="my"
                        className={cn(
                            'h-10 min-w-[100px] rounded-none border-b-2 border-transparent px-3 text-sm text-muted-foreground',
                            'hover:bg-slate-50 hover:text-foreground',
                            'data-[state=active]:border-b-primary data-[state=active]:text-primary data-[state=active]:font-medium',
                            'data-[state=active]:bg-transparent data-[state=active]:shadow-none'
                        )}
                    >
                        My Tasks
                        <span className="ml-1.5 flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold bg-slate-100 text-slate-600 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                            {myTasksCount}
                        </span>
                    </TabsTrigger>
                    <TabsTrigger
                        value="approved"
                        className={cn(
                            'h-10 min-w-[100px] rounded-none border-b-2 border-transparent px-3 text-sm text-muted-foreground',
                            'hover:bg-slate-50 hover:text-foreground',
                            'data-[state=active]:border-b-primary data-[state=active]:text-primary data-[state=active]:font-medium',
                            'data-[state=active]:bg-transparent data-[state=active]:shadow-none'
                        )}
                    >
                        Approved Tasks
                        <span className="ml-1.5 flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold bg-slate-100 text-slate-600 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                            {approvedTasksCount}
                        </span>
                    </TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
    );
}

function MobileHeader({
    totalItems,
    showScopeTabs,
    scope,
    onScopeChange,
    myTasksCount,
    approvedTasksCount,
    filterValues,
    setFilterValues,
    handleFilterApply,
    selectionSummary,
    onRefresh,
    isRefreshing,
    mobileActiveFilterCount,
    onOpenFilters,
    selectionMode,
    exitSelectionMode,
    enterSelectionMode,
    showTaskActions,
}: {
    totalItems: number;
    showScopeTabs: boolean;
    scope: 'my' | 'approved';
    onScopeChange?: (scope: 'my' | 'approved') => void;
    myTasksCount: number;
    approvedTasksCount: number;
    filterValues: any;
    setFilterValues: (fn: any) => void;
    handleFilterApply: (v: any) => void;
    selectionSummary: string;
    onRefresh: () => void;
    isRefreshing: boolean;
    mobileActiveFilterCount: number;
    onOpenFilters: () => void;
    selectionMode: boolean;
    exitSelectionMode: () => void;
    enterSelectionMode: () => void;
    showTaskActions: boolean;
}) {
    return (
        <div className="border-b-0 bg-transparent backdrop-blur-none">
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-[17px] font-bold text-slate-800">All Tasks</h2>
                    <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {totalItems}
                    </span>
                </div>
            </div>

            <div className="space-y-3 px-4 pb-4">
                {showScopeTabs && (
                    <Tabs
                        value={scope}
                        onValueChange={(next) => onScopeChange?.(next as 'my' | 'approved')}
                        className="gap-0 -mx-4 px-4 overflow-x-auto no-scrollbar border-b border-border/60"
                    >
                        <TabsList className="h-auto w-max justify-start bg-transparent p-0 gap-1 rounded-none shadow-none">
                            <TabsTrigger
                                value="my"
                                className={cn(
                                    'h-10 min-w-[100px] rounded-none border-b-2 border-transparent px-3 text-sm text-muted-foreground',
                                    'data-[state=active]:border-b-primary data-[state=active]:text-primary data-[state=active]:font-medium',
                                    'data-[state=active]:bg-transparent data-[state=active]:shadow-none'
                                )}
                            >
                                My Tasks
                                <span className="ml-1.5 flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold bg-slate-100 text-slate-600 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                                    {myTasksCount}
                                </span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="approved"
                                className={cn(
                                    'h-10 min-w-[100px] rounded-none border-b-2 border-transparent px-3 text-sm text-muted-foreground',
                                    'data-[state=active]:border-b-primary data-[state=active]:text-primary data-[state=active]:font-medium',
                                    'data-[state=active]:bg-transparent data-[state=active]:shadow-none'
                                )}
                            >
                                Approved Tasks
                                <span className="ml-1.5 flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold bg-slate-100 text-slate-600 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                                    {approvedTasksCount}
                                </span>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                )}

                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        id="inbox-search"
                        placeholder="Search tasks..."
                        value={filterValues.search || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            setFilterValues((prev: any) => ({ ...prev, search: val }));
                            handleFilterApply({ ...filterValues, search: val });
                        }}
                        className="rounded-xl border-slate-200/90 bg-white pl-8 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] h-11"
                    />
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-medium text-slate-500">
                            {selectionSummary}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRefresh?.()}
                            disabled={isRefreshing}
                            className="h-9 w-9 rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                        >
                            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={onOpenFilters}
                            disabled={showTaskActions && selectionMode}
                            className="h-10 rounded-xl border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm"
                        >
                            <Filter className="mr-2 size-4" />
                            Filter
                            {mobileActiveFilterCount > 0 && (
                                <span className="ml-2 rounded-full bg-primary px-1.5 py-0 text-[10px] font-semibold text-white">
                                    {mobileActiveFilterCount}
                                </span>
                            )}
                        </Button>
                        {showTaskActions && (
                            <Button
                                variant="outline"
                                onClick={() => (selectionMode ? exitSelectionMode() : enterSelectionMode())}
                                className={cn(
                                    'h-10 rounded-xl border bg-white px-3 text-sm font-medium shadow-sm',
                                    selectionMode
                                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                )}
                            >
                                {selectionMode ? (
                                    <>
                                        <X className="mr-2 size-4" />
                                        Cancel
                                    </>
                                ) : (
                                    <>
                                        <ListChecks className="mr-2 size-4" />
                                        Select
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Shared presentational helpers ─────────────────────────

function EmptyState({
    hasSearch,
    hasFilters,
}: {
    hasSearch: boolean;
    hasFilters: boolean;
}) {
    const message = hasSearch || hasFilters ? 'No matching tasks' : 'Inbox is empty';
    const sub = hasSearch || hasFilters
        ? 'Try adjusting your search or filter criteria.'
        : 'No pending tasks assigned to you.';

    return (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
                <Inbox className="size-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-sm font-medium text-foreground">{message}</h3>
            <p className="max-w-[220px] text-xs text-muted-foreground">{sub}</p>
        </div>
    );
}

function TaskListSkeleton() {
    return (
        <div className="flex h-full flex-col">
            <div className="space-y-3 border-b border-border/50 p-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
            <div className="flex-1 p-0">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="mx-3 my-2 space-y-2 rounded-xl border border-border/50 bg-card/95 p-4"
                    >
                        <Skeleton className="h-4 w-3/4" />
                        <div className="flex gap-1.5">
                            <Skeleton className="h-4 w-14 rounded-md" />
                            <Skeleton className="h-4 w-12 rounded-md" />
                        </div>
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                ))}
            </div>
        </div>
    );
}
