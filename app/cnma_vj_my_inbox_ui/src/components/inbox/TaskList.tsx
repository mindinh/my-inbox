import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskCard } from './TaskCard';
import type { InboxTask } from '@/services/inbox/inbox.types';
import {
    Inbox,
    RefreshCw,
    ListChecks,
    X,
    PanelLeftClose,
    CheckCircle,
    XCircle,
    Filter,
    Search,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FilterBar, initializeFilterValues } from '@/components/filterbar';
import type { FilterFieldConfig, FilterValues, FilterSettingItem } from '@/components/filterbar/types';
import { INBOX_FILTER_CONFIG } from './inboxFilterConfig';


interface TaskListProps {
    tasks: InboxTask[];
    selectedTaskId: string | null;
    onSelectTask: (task: InboxTask) => void;
    isLoading: boolean;
    onRefresh: () => void;
    isRefreshing: boolean;
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
}

export function TaskList({
    tasks,
    selectedTaskId,
    onSelectTask,
    isLoading,
    onRefresh,
    isRefreshing,
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
}: TaskListProps) {
    const PAGE_SIZE = 5;
    const [_internalSelectionMode, _setInternalSelectionMode] = useState(false);
    const [_internalSelectedIds, _setInternalSelectedIds] = useState<Set<string>>(new Set());

    // ─── FilterBar state (desktop) ────────────────────────
    const [filterConfig, setFilterConfig] = useState<FilterFieldConfig[]>(
        () => INBOX_FILTER_CONFIG.filter(f => f.visible !== false)
    );
    const [allFilterConfig] = useState<FilterFieldConfig[]>(() => [...INBOX_FILTER_CONFIG]);
    const [filterValues, setFilterValues] = useState<FilterValues>(
        () => initializeFilterValues(INBOX_FILTER_CONFIG)
    );
    const [appliedValues, setAppliedValues] = useState<FilterValues>(
        () => initializeFilterValues(INBOX_FILTER_CONFIG)
    );

    // ─── Mobile filter state ──────────────────────────────
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

    // Use external state when provided
    const selectionMode = externalSelectionMode !== undefined ? externalSelectionMode : _internalSelectionMode;
    const selectedIds = externalSelectedIds !== undefined ? externalSelectedIds : _internalSelectedIds;

    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;

    const setSelectionMode = useCallback((mode: boolean) => {
        _setInternalSelectionMode(mode);
        onSelectionModeChange?.(mode);
    }, [onSelectionModeChange]);

    const updateSelectedIds = useCallback((newIds: Set<string>) => {
        _setInternalSelectedIds(newIds);
        onSelectedIdsChange?.(newIds);
    }, [onSelectedIdsChange]);

    // ─── FilterBar handlers (desktop) ─────────────────────
    const handleFilterApply = useCallback((values: FilterValues) => {
        setAppliedValues({ ...values });
    }, []);

    const handleFilterClear = useCallback(() => {
        const cleared = initializeFilterValues(INBOX_FILTER_CONFIG);
        setFilterValues(cleared);
        setAppliedValues(cleared);
    }, []);

    const handleAdaptFilter = useCallback((filters: FilterSettingItem[]) => {
        const visibleKeys = new Set(filters.filter(f => f.visible).map(f => f.name));
        const orderedKeys = filters.map(f => f.name);

        // Rebuild visible config in the user's chosen order
        const newConfig: FilterFieldConfig[] = [];
        for (const key of orderedKeys) {
            if (visibleKeys.has(key)) {
                const found = allFilterConfig.find(f => f.key === key);
                if (found) {
                    newConfig.push({ ...found, visible: true });
                }
            }
        }
        setFilterConfig(newConfig);
    }, [allFilterConfig]);

    // ─── Filtering logic ──────────────────────────────────
    const filteredTasks = useMemo(() => {
        let result = tasks;
        const v = appliedValues;

        // Text search on title
        if (v.search?.trim()) {
            const q = v.search.toLowerCase();
            result = result.filter((task) =>
                task.title.toLowerCase().includes(q) ||
                task.requestorName?.toLowerCase().includes(q) ||
                task.createdByName?.toLowerCase().includes(q) ||
                task.businessContext?.documentId?.toLowerCase().includes(q)
            );
        }

        // Status multiselect
        if (Array.isArray(v.status) && v.status.length > 0) {
            const statusSet = new Set(v.status as string[]);
            result = result.filter((task) => statusSet.has(task.status));
        }

        // Priority multiselect
        if (Array.isArray(v.priority) && v.priority.length > 0) {
            const prioritySet = new Set(v.priority as string[]);
            result = result.filter((task) => !!task.priority && prioritySet.has(task.priority));
        }

        // Document type select
        if (v.documentType) {
            result = result.filter(
                (task) => task.businessContext?.type === v.documentType
            );
        }

        // Requestor text
        if (v.createdBy?.trim()) {
            const q = v.createdBy.toLowerCase();
            result = result.filter(
                (task) =>
                    task.requestorName?.toLowerCase().includes(q) ||
                    task.createdByName?.toLowerCase().includes(q)
            );
        }

        // Document ID text
        if (v.documentId?.trim()) {
            const q = v.documentId.toLowerCase();
            result = result.filter(
                (task) => task.businessContext?.documentId?.toLowerCase().includes(q)
            );
        }

        // Created date range
        if (v.createdDate?.from || v.createdDate?.to) {
            const from = v.createdDate.from ? new Date(v.createdDate.from).getTime() : 0;
            const to = v.createdDate.to
                ? new Date(v.createdDate.to).setHours(23, 59, 59, 999)
                : Infinity;
            result = result.filter((task) => {
                if (!task.createdOn) return false;
                const t = new Date(task.createdOn).getTime();
                return t >= from && t <= to;
            });
        }

        return result;
    }, [tasks, appliedValues]);

    const toggleSelection = useCallback((taskId: string) => {
        const prev = selectedIdsRef.current;
        const next = new Set(prev);
        if (next.has(taskId)) {
            next.delete(taskId);
        } else {
            next.add(taskId);
        }
        updateSelectedIds(next);
    }, [updateSelectedIds]);

    const toggleSelectAll = useCallback(() => {
        const prev = selectedIdsRef.current;
        if (prev.size === filteredTasks.length) {
            updateSelectedIds(new Set<string>());
        } else {
            updateSelectedIds(new Set(filteredTasks.map((task) => task.instanceId)));
        }
    }, [filteredTasks, updateSelectedIds]);

    const exitSelectionMode = useCallback(() => {
        setSelectionMode(false);
        updateSelectedIds(new Set<string>());
    }, [setSelectionMode, updateSelectedIds]);

    // ─── Internal pagination on filtered results ──────────
    const [currentPage, setCurrentPage] = useState(0);

    // Reset to page 0 whenever filteredTasks changes (filter change or data change)
    const prevFilteredLenRef = useRef(filteredTasks.length);
    useEffect(() => {
        if (prevFilteredLenRef.current !== filteredTasks.length) {
            prevFilteredLenRef.current = filteredTasks.length;
            setCurrentPage(0);
        }
    }, [filteredTasks.length]);

    const totalPages = Math.ceil(filteredTasks.length / PAGE_SIZE);
    const paginatedTasks = useMemo(() => {
        const start = currentPage * PAGE_SIZE;
        return filteredTasks.slice(start, start + PAGE_SIZE);
    }, [filteredTasks, currentPage, PAGE_SIZE]);

    const selectionSummary = selectionMode
        ? `${selectedIds.size} selected`
        : `Showing ${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filteredTasks.length)} of ${filteredTasks.length}`;

    const mobileActiveFilterCount = Object.entries(appliedValues).filter(([k, v]) => {
        if (k === 'search') return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === 'object' && v !== null) return (v as any).from || (v as any).to;
        return !!v;
    }).length;

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
            {/* ── Desktop: SAP-style FilterBar ── */}
            {!isMobile && (
                <div className="border-b border-border/60">
                    {/* Header row */}
                    <div className="flex items-center justify-between px-3 py-3">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] font-semibold text-slate-800">All Tasks</h2>
                            <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {tasks.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <Button
                                variant={selectionMode ? 'secondary' : 'ghost'}
                                size="icon"
                                onClick={() =>
                                    selectionMode ? exitSelectionMode() : setSelectionMode(true)
                                }
                                className="h-8 w-8 rounded-lg hover:bg-slate-100"
                                title={selectionMode ? 'Exit selection' : 'Select tasks'}
                            >
                                {selectionMode ? (
                                    <X className="size-4" />
                                ) : (
                                    <ListChecks className="size-4" />
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onRefresh?.()}
                                disabled={isRefreshing}
                                className="h-8 w-8 rounded-lg hover:bg-slate-100"
                                title="Refresh"
                            >
                                <RefreshCw
                                    className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
                                />
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

                    {showScopeTabs && (
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
                                        <span
                                            className="ml-1.5 flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold bg-slate-100 text-slate-600 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                                        >
                                            {myTasksCount ?? tasks.length}
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
                                        <span
                                            className="ml-1.5 flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold bg-slate-100 text-slate-600 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                                        >
                                            {approvedTasksCount ?? (scope === 'approved' ? tasks.length : 0)}
                                        </span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    )}

                    {/* SAP-style FilterBar */}
                    <div className="px-3 pb-3">
                        <FilterBar
                            config={filterConfig}
                            allFilterConfig={allFilterConfig}
                            values={filterValues}
                            onChange={setFilterValues}
                            onApply={handleFilterApply}
                            onClear={handleFilterClear}
                            onAdaptFilter={handleAdaptFilter}
                            isLoading={isRefreshing}
                            defaultExpanded={false}
                        />
                    </div>

                    {/* Showing x / y */}
                    <div className="px-4 pb-2 text-xs font-medium text-slate-500">
                        {selectionSummary}
                    </div>
                </div>
            )}

            {/* ── Mobile header ── */}
            {isMobile && (
                <div className="border-b-0 bg-transparent backdrop-blur-none">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[17px] font-bold text-slate-800">All Tasks</h2>
                            <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                {tasks.length}
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
                                        <span
                                            className="ml-1.5 flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold bg-slate-100 text-slate-600 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                                        >
                                            {myTasksCount ?? (scope === 'my' ? tasks.length : 0)}
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
                                        <span
                                            className="ml-1.5 flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold bg-slate-100 text-slate-600 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                                        >
                                            {approvedTasksCount ?? (scope === 'approved' ? tasks.length : 0)}
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
                                    setFilterValues((prev) => ({ ...prev, search: val }));
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
                                    <RefreshCw
                                        className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
                                    />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setMobileFiltersOpen(true)}
                                    disabled={selectionMode}
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
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        selectionMode
                                            ? exitSelectionMode()
                                            : setSelectionMode(true)
                                    }
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
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectionMode && filteredTasks.length > 0 && !isMobile && (
                <div className="flex items-center gap-2 border-b border-border/60 bg-muted/50 px-3 py-1.5">
                    <Checkbox
                        checked={
                            selectedIds.size === filteredTasks.length && filteredTasks.length > 0
                        }
                        onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-xs text-muted-foreground">
                        {selectedIds.size > 0
                            ? `${selectedIds.size} of ${filteredTasks.length} selected`
                            : 'Select all'}
                    </span>
                </div>
            )}

            <ScrollArea className="flex-1">
                {filteredTasks.length === 0 ? (
                    <EmptyState hasSearch={!!appliedValues.search?.trim()} hasFilters={true} />
                ) : (
                    <div
                        className={cn(
                            'space-y-2 p-2.5',
                            isMobile && 'space-y-3 px-4 pb-24 pt-1'
                        )}
                    >
                        {paginatedTasks.map((task) => (
                            <div key={task.instanceId} className="flex items-start gap-2">
                                {selectionMode && (
                                    <div
                                        className={cn(
                                            'shrink-0 pl-1',
                                            isMobile ? 'pt-4' : 'pt-3'
                                        )}
                                    >
                                        <Checkbox
                                            checked={selectedIds.has(task.instanceId)}
                                            onCheckedChange={() => toggleSelection(task.instanceId)}
                                        />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <TaskCard
                                        task={task}
                                        isSelected={task.instanceId === selectedTaskId}
                                        onClick={() =>
                                            selectionMode
                                                ? toggleSelection(task.instanceId)
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

            {/* Pagination bar */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border/60 bg-background/95 px-3 py-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                        disabled={currentPage <= 0}
                        className="h-7 px-2 text-xs"
                    >
                        <ChevronLeft className="mr-1 size-3.5" />
                        Prev
                    </Button>
                    <span className="text-xs font-medium text-muted-foreground">
                        Page {currentPage + 1} of {totalPages}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1}
                        className="h-7 px-2 text-xs"
                    >
                        Next
                        <ChevronRight className="ml-1 size-3.5" />
                    </Button>
                </div>
            )}

            {selectionMode && isMobile && filteredTasks.length > 0 && (
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/98 p-3 shadow-[0_12px_28px_rgba(15,23,42,0.14)]">
                        <div className="flex items-center gap-2">
                            <div className="mr-auto text-sm font-medium text-slate-600">
                                {selectedIds.size} selected
                            </div>
                            {selectedIds.size > 0 && onMassDecision && (
                                <>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => onMassDecision('0002', '', [...selectedIds])}
                                        disabled={isExecutingMass}
                                        className="rounded-lg"
                                    >
                                        <XCircle className="size-3.5 mr-1" />
                                        Reject ({selectedIds.size})
                                    </Button>
                                    <Button
                                        variant="success"
                                        size="sm"
                                        onClick={() => onMassDecision('0001', '', [...selectedIds])}
                                        disabled={isExecutingMass}
                                        className="rounded-lg text-white"
                                    >
                                        <CheckCircle className="size-3.5 mr-1" />
                                        Approve ({selectedIds.size})
                                    </Button>
                                </>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleSelectAll}
                                className="rounded-lg border-slate-200"
                            >
                                {selectedIds.size === filteredTasks.length ? 'Clear' : 'All'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Drawer
                open={mobileFiltersOpen}
                onOpenChange={setMobileFiltersOpen}
                direction="bottom"
            >
                <DrawerContent className="h-[100dvh] rounded-none border-none p-0">
                    <FilterBar
                        isMobile={true}
                        config={filterConfig}
                        allFilterConfig={allFilterConfig}
                        values={filterValues}
                        onChange={setFilterValues}
                        onApply={(v) => {
                            handleFilterApply(v);
                            setMobileFiltersOpen(false);
                        }}
                        onClear={handleFilterClear}
                        onAdaptFilter={handleAdaptFilter}
                        isLoading={isRefreshing}
                    />
                </DrawerContent>
            </Drawer>
        </div>
    );
}

function formatLabel(value: string): string {
    return value
        .split('_')
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
}

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
