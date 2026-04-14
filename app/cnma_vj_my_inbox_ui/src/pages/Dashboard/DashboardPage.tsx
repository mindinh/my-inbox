import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TaskScopeSidebar, MobileSidebarSheet } from '@/pages/Inbox/components/TaskScopeSidebar';
import { useIsMobile } from '@/components/ui/use-mobile';
import {
    ListFilter,
    X,
    Loader2,
    AlertCircle,
    Menu,
    ChevronRight,
    RefreshCw,
} from 'lucide-react';
import { useDashboardQuery, useDashboardData, STATUS_COLORS, STATUS_LABELS } from './use-dashboard-data';
import type { DonutSegment, BarDataItem } from './use-dashboard-data';
import { StatusBadge } from '@/pages/Inbox/components/TaskBadges';
import { useCurrentUser } from '@/pages/Inbox/hooks/inboxQueries';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════
// Refetch Overlay — shown over each chart card while refreshing
// ═══════════════════════════════════════════════════════════

function RefetchOverlay() {
    return (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[14px] backdrop-blur-[2px] transition-opacity duration-300"
            style={{ backgroundColor: 'rgba(255,255,255,0.55)' }}
        >
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// SVG Donut Chart
// ═══════════════════════════════════════════════════════════

function DonutChart({
    segments,
    size = 180,
    strokeWidth = 22,
    selectedLabel,
    onSegmentClick,
    centerLabel = 'TASKS',
}: {
    segments: DonutSegment[];
    size?: number;
    strokeWidth?: number;
    selectedLabel: string | null;
    onSegmentClick: (label: string) => void;
    centerLabel?: string;
}) {
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const cx = size / 2;
    const cy = size / 2;

    let accumulatedOffset = 0;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Background track */}
            <circle
                cx={cx} cy={cy} r={radius}
                fill="none" stroke="var(--border)" strokeWidth={strokeWidth}
            />
            {/* Segments */}
            {total > 0 && segments.map((seg) => {
                if (seg.value === 0) return null;
                const segmentLength = (seg.value / total) * circumference;
                const offset = accumulatedOffset;
                accumulatedOffset += segmentLength;
                const isActive = selectedLabel === seg.label;
                const isFiltered = selectedLabel != null && !isActive;
                return (
                    <circle
                        key={seg.label}
                        cx={cx} cy={cy} r={radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                        strokeDashoffset={-offset}
                        strokeLinecap="butt"
                        opacity={isFiltered ? 0.25 : 1}
                        style={{
                            transform: 'rotate(-90deg)',
                            transformOrigin: `${cx}px ${cy}px`,
                            transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease, opacity 0.25s ease',
                            cursor: 'pointer',
                        }}
                        onClick={() => onSegmentClick(seg.label)}
                    />
                );
            })}
            {/* Center text */}
            <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central"
                style={{ fill: 'var(--foreground)', fontSize: '32px', fontWeight: 800 }}>
                {total}
            </text>
            <text x={cx} y={cy + 20} textAnchor="middle" dominantBaseline="central"
                style={{ fill: 'var(--muted-foreground)', fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px' }}>
                {centerLabel}
            </text>
        </svg>
    );
}

// ═══════════════════════════════════════════════════════════
// Stacked Horizontal Bar Chart (In Approving / Approved / Rejected)
// Always shows all 3 segments. selectedStatus greys out non-active.
// ═══════════════════════════════════════════════════════════

function StackedBarChart({
    data,
    selectedTypeLabel,
    selectedStatus,
    onBarClick,
    onStatusClick,
    isMobile = false,
}: {
    data: BarDataItem[];
    selectedTypeLabel: string | null;
    selectedStatus: string | null;
    onBarClick: (label: string) => void;
    onStatusClick: (status: string) => void;
    isMobile?: boolean;
}) {
    if (data.length === 0) {
        return (
            <p className="text-sm text-center py-10" style={{ color: 'var(--muted-foreground)' }}>
                No data available
            </p>
        );
    }

    const maxVal = Math.max(...data.map((d) => d.total), 1);
    const axisMax = Math.ceil(maxVal / 5) * 5 || 5;
    const ticks = Array.from({ length: 6 }, (_, i) => Math.round((axisMax / 5) * i));

    // Mobile-friendly dimensions
    const barH = isMobile ? 20 : 16;
    const rowHeight = isMobile ? 80 : 68;
    const labelWidth = isMobile ? 100 : 140;
    const chartLeft = labelWidth + 12;
    const chartRight = 24;
    const svgWidth = isMobile ? 360 : 500;
    const chartWidth = svgWidth - chartLeft - chartRight;
    const totalHeight = data.length * rowHeight + 36;
    const fontSize = isMobile ? '10px' : '11px';
    const subFontSize = isMobile ? '10px' : '11px';

    return (
        <svg
            viewBox={`0 0 ${svgWidth} ${totalHeight}`}
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            style={{ overflow: 'visible', touchAction: 'manipulation' }}
        >
            {/* Grid lines */}
            {ticks.map((tick) => {
                const x = chartLeft + (tick / axisMax) * chartWidth;
                return (
                    <g key={tick}>
                        <line
                            x1={x} y1={0} x2={x} y2={totalHeight - 28}
                            stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3"
                        />
                        <text x={x} y={totalHeight - 10} textAnchor="middle"
                            style={{ fill: 'var(--muted-foreground)', fontSize: '10px', fontWeight: 500 }}>
                            {tick}
                        </text>
                    </g>
                );
            })}

            {/* Baseline */}
            <line
                x1={chartLeft} y1={totalHeight - 28}
                x2={chartLeft + chartWidth} y2={totalHeight - 28}
                stroke="var(--border)" strokeWidth={1}
            />

            {/* Data rows */}
            {data.map((d, i) => {
                const yBase = i * rowHeight + 6;
                const barY = yBase + 10;

                const isBarActive = selectedTypeLabel === d.label;
                const isBarFiltered = selectedTypeLabel != null && !isBarActive;

                // Build stacked segments: start from base if selected
                let xOffset = 0;

                // If a status is selected, put it first in the ordering so it is anchored to the base
                const orderedStatuses = selectedStatus
                    ? [selectedStatus, ...STATUS_LABELS.filter(s => s !== selectedStatus)]
                    : STATUS_LABELS;

                const segments = orderedStatuses.map((status) => {
                    const count = d.statusCounts[status] || 0;
                    const width = Math.max((count / axisMax) * chartWidth, 0);
                    const seg = { status, count, width, x: chartLeft + xOffset };
                    xOffset += width;
                    return seg;
                });

                // Sub-label: show selectedStatus count / total, or just total
                const subLabel = selectedStatus
                    ? `${d.statusCounts[selectedStatus] || 0}/${d.total}`
                    : `${d.total} total`;

                return (
                    <g
                        key={d.label}
                        style={{ opacity: isBarFiltered ? 0.32 : 1, transition: 'opacity 0.2s ease' }}
                    >
                        {/* Hit area for type selection */}
                        <rect x={0} y={yBase - 4} width={labelWidth} height={rowHeight}
                            fill="transparent" style={{ cursor: 'pointer' }}
                            onClick={() => onBarClick(d.label)} />

                        {/* ── Label: type name ── */}
                        <text x={labelWidth - 4} y={barY + barH / 2 - 1} textAnchor="end" dominantBaseline="central"
                            style={{
                                fill: isBarActive ? 'var(--primary)' : 'var(--foreground)',
                                fontSize,
                                fontWeight: isBarActive ? 700 : 600,
                                cursor: 'pointer',
                            }}
                            onClick={() => onBarClick(d.label)}>
                            {d.label.length > (isMobile ? 14 : 22) ? d.label.slice(0, isMobile ? 14 : 22) + '…' : d.label}
                        </text>

                        {/* ── Sub-label: count ── */}
                        <text x={labelWidth - 4} y={barY + barH + 16} textAnchor="end" dominantBaseline="central"
                            style={{
                                fill: selectedStatus ? STATUS_COLORS[selectedStatus] : 'var(--muted-foreground)',
                                fontSize: subFontSize,
                                fontWeight: selectedStatus ? 700 : 500,
                            }}>
                            {subLabel}
                        </text>

                        {/* ── Stacked segments ── */}
                        {segments.map((seg) => {
                            if (seg.count === 0) return null;
                            const isStatusFiltered = selectedStatus != null && selectedStatus !== seg.status;

                            // Round corners
                            const visibleSegs = segments.filter((s) => s.count > 0);
                            const isFirst = visibleSegs[0]?.status === seg.status;
                            const isLast = visibleSegs[visibleSegs.length - 1]?.status === seg.status;

                            return (
                                <g key={seg.status}>
                                    <rect
                                        x={seg.x}
                                        y={barY}
                                        width={seg.width}
                                        height={barH}
                                        rx={isFirst && isLast ? 3 : 0}
                                        fill={isStatusFiltered ? '#d1d5db' : STATUS_COLORS[seg.status]}
                                        style={{ cursor: 'pointer', transition: 'all 0.45s ease' }}
                                        onClick={() => onStatusClick(seg.status)}
                                    >
                                        <animate attributeName="width" from="0" to={seg.width} dur="0.45s" fill="freeze" />
                                    </rect>
                                    {/* Left rounded cap for first segment */}
                                    {isFirst && (
                                        <rect
                                            x={seg.x} y={barY}
                                            width={Math.min(seg.width, 6)} height={barH}
                                            rx={3} ry={3}
                                            fill={isStatusFiltered ? '#d1d5db' : STATUS_COLORS[seg.status]}
                                            style={{ pointerEvents: 'none', transition: 'fill 0.25s ease' }}
                                        />
                                    )}
                                    {/* Right rounded cap for last segment */}
                                    {isLast && seg.width > 6 && (
                                        <rect
                                            x={seg.x + seg.width - 6} y={barY}
                                            width={6} height={barH}
                                            rx={3} ry={3}
                                            fill={isStatusFiltered ? '#d1d5db' : STATUS_COLORS[seg.status]}
                                            style={{ pointerEvents: 'none', transition: 'fill 0.25s ease' }}
                                        />
                                    )}
                                </g>
                            );
                        })}
                    </g>
                );
            })}
        </svg>
    );
}

// ═══════════════════════════════════════════════════════════
// Dashboard Page
// ═══════════════════════════════════════════════════════════

export default function DashboardPage() {
    const { t } = useTranslation();
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const { data: userInfo } = useCurrentUser();

    const { data: dashboardData, isLoading, isError, refetch, isRefetching } = useDashboardQuery();
    const tasks = dashboardData?.items ?? [];

    const {
        donutSegments,
        barData,
        tableRows,
        totalTasks,
        totalTypes,
    } = useDashboardData(tasks, selectedStatus, selectedType);

    // ── Handlers ─────────────────────────────────────────
    const handleStatusClick = useCallback((label: string) => {
        setSelectedStatus((prev) => (prev === label ? null : label));
    }, []);

    const handleBarClick = useCallback((label: string) => {
        setSelectedType((prev) => (prev === label ? null : label));
    }, []);

    const clearAllFilters = useCallback(() => {
        setSelectedStatus(null);
        setSelectedType(null);
    }, []);

    const handleScopeChange = useCallback((nextScope: 'my' | 'approved') => {
        navigate('/', { state: { scope: nextScope } });
    }, [navigate]);

    const hasFilters = selectedStatus || selectedType;

    // ── Card style helper ────────────────────────────────
    const cardStyle: React.CSSProperties = {
        borderRadius: '14px',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        backgroundColor: 'var(--card)',
    };

    // ── Dashboard content (shared between desktop & mobile) ──
    const dashboardContent = (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
            {/* Mobile App Header — gradient background */}
            {isMobile && (
                <div
                    className="px-4 py-3 flex items-center shadow-sm relative z-20 shrink-0 w-full min-h-[60px]"
                    style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' }}
                >
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/10 active:bg-white/20 relative z-10"
                        aria-label="Open navigation menu"
                    >
                        <Menu size={22} className="text-white" />
                    </button>
                    <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-bold text-white tracking-wide pointer-events-none">
                        {t('nav.dashboard', 'Dashboard')}
                    </h1>
                </div>
            )}

            {/* ── Header ─────────────────────────────────── */}
            <div className="px-4 pt-5 pb-3 md:px-8 md:pt-8 md:pb-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {!isMobile && (
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                                    {t('dashboard.title')}
                                </h1>
                                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                    {t('dashboard.subtitle')}
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => refetch()}
                            disabled={isRefetching}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                            style={{
                                color: 'var(--primary)',
                                backgroundColor: 'var(--background)',
                                border: '1px solid var(--border)',
                            }}
                            title={t('common.refresh', 'Refresh')}
                        >
                            <RefreshCw size={12} className={isRefetching ? 'animate-spin' : ''} />
                            {t('common.refresh', 'Refresh')}
                        </button>
                        {hasFilters && (
                            <button
                                onClick={clearAllFilters}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                                style={{
                                    color: 'var(--destructive)',
                                    backgroundColor: 'var(--error-bg)',
                                    border: '1px solid var(--destructive)',
                                }}
                            >
                                <X size={12} />
                                {t('dashboard.clearFilters')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Loading State ────────────────────────────── */}
            {isLoading ? (
                <div className="flex items-center justify-center py-32">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('dashboard.loadingDashboard')}</p>
                    </div>
                </div>
            ) : isError ? (
                <div className="flex items-center justify-center py-32">
                    <div className="flex flex-col items-center gap-3 text-center px-6">
                        <AlertCircle size={32} style={{ color: 'var(--destructive)' }} />
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('dashboard.failedToLoad')}</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('dashboard.tryRefreshing')}</p>
                    </div>
                </div>
            ) : (
                /* ── Content ────────────────────────────────── */
                <div className="px-4 pb-8 md:px-8 space-y-5">

                    {/* ── Active filter pills ────────────────── */}
                    {hasFilters && (
                        <div className="flex items-center gap-2 flex-wrap min-h-[32px]">
                            <ListFilter size={14} style={{ color: 'var(--muted-foreground)' }} />
                            {selectedStatus && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                    style={{
                                        backgroundColor: `${STATUS_COLORS[selectedStatus]}15`,
                                        color: STATUS_COLORS[selectedStatus],
                                        border: `1px solid ${STATUS_COLORS[selectedStatus]}`,
                                    }}>
                                    {t('dashboard.filters.status', { status: selectedStatus })}
                                    <X size={10} className="cursor-pointer ml-0.5" onClick={() => setSelectedStatus(null)} />
                                </span>
                            )}
                            {selectedType && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                    style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning)' }}>
                                    {t('dashboard.filters.type', { type: selectedType })}
                                    <X size={10} className="cursor-pointer ml-0.5" onClick={() => setSelectedType(null)} />
                                </span>
                            )}
                        </div>
                    )}


                    {/* ── Main charts: 2-col desktop, stacked mobile ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">

                        {/* ─── Chart 1: Donut (1 col) ────────── */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35 }}
                            className="p-5 md:p-6 relative"
                            style={cardStyle}
                        >
                            {isRefetching && <RefetchOverlay />}
                            <div className="flex flex-col items-center">
                                <h3 className="text-xs md:text-sm font-bold mb-5 tracking-widest"
                                    style={{ color: 'var(--foreground)' }}>
                                    {t('dashboard.charts.tasksByStatus')}
                                </h3>
                                <DonutChart
                                    segments={donutSegments}
                                    size={180}
                                    strokeWidth={22}
                                    selectedLabel={selectedStatus}
                                    onSegmentClick={handleStatusClick}
                                    centerLabel={t('dashboard.charts.tasks')}
                                />
                                {/* Legend */}
                                <div className="mt-6 w-full max-w-[260px] space-y-2.5">
                                    {donutSegments.map((seg) => {
                                        const isSelected = selectedStatus === seg.label;
                                        return (
                                            <button
                                                key={seg.label}
                                                type="button"
                                                onClick={() => handleStatusClick(seg.label)}
                                                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all duration-200"
                                                style={{
                                                    backgroundColor: isSelected ? `${seg.color}15` : 'transparent',
                                                    border: isSelected ? `1.5px solid ${seg.color}` : '1.5px solid transparent',
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                                                    <span className="text-sm md:text-base"
                                                        style={{ color: isSelected ? seg.color : 'var(--foreground)', fontWeight: isSelected ? 700 : 500 }}>
                                                        {seg.label}
                                                    </span>
                                                </div>
                                                <span className="text-sm md:text-base font-bold"
                                                    style={{ color: isSelected ? seg.color : 'var(--foreground)' }}>
                                                    {seg.value}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>

                        {/* ─── Chart 2: Stacked Bar chart (1 col) ─────── */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.1 }}
                            className="overflow-hidden relative"
                            style={cardStyle}
                        >
                            {isRefetching && <RefetchOverlay />}
                            <div className="px-5 pt-5 pb-2 md:px-6 md:pt-6">
                                <h3 className="text-xs md:text-sm font-bold tracking-widest"
                                    style={{ color: 'var(--foreground)' }}>
                                    {t('dashboard.charts.tasksByType')}
                                </h3>
                                <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                    {selectedStatus
                                        ? t('dashboard.charts.filteredBy', { filter: selectedStatus })
                                        : t('dashboard.charts.groupedByTaskType')}
                                </p>
                            </div>

                            {/* Chart area — generous padding on mobile */}
                            <div className="px-2 pb-2 md:px-6 md:pb-6">
                                <StackedBarChart
                                    data={barData}
                                    selectedTypeLabel={selectedType}
                                    selectedStatus={selectedStatus}
                                    onBarClick={handleBarClick}
                                    onStatusClick={handleStatusClick}
                                    isMobile={isMobile}
                                />
                            </div>

                            {/* Bottom legend: 3 status labels */}
                            <div className="px-5 pb-4 md:px-6 md:pb-5 flex items-center gap-4 md:gap-6 border-t" style={{ borderColor: 'var(--border)' }}>
                                {STATUS_LABELS.map((status) => {
                                    const isActive = selectedStatus === status;
                                    const isFiltered = selectedStatus != null && !isActive;
                                    return (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => handleStatusClick(status)}
                                            className="flex items-center gap-1.5 md:gap-2 pt-3 transition-opacity"
                                            style={{ opacity: isFiltered ? 0.35 : 1 }}
                                        >
                                            <span
                                                className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm shrink-0"
                                                style={{
                                                    backgroundColor: STATUS_COLORS[status],
                                                    outline: isActive ? `2px solid ${STATUS_COLORS[status]}` : 'none',
                                                    outlineOffset: '2px',
                                                }}
                                            />
                                            <span
                                                className="text-[11px] md:text-sm"
                                                style={{
                                                    color: isActive ? STATUS_COLORS[status] : 'var(--foreground)',
                                                    fontWeight: isActive ? 700 : 600,
                                                }}
                                            >
                                                {status}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>

                    {/* ─── Chart 3: Task Table ────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.2 }}
                        className="overflow-hidden relative"
                        style={cardStyle}
                    >
                        {isRefetching && <RefetchOverlay />}
                        <div className="px-5 pt-5 pb-3 md:px-6 md:pt-6 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs md:text-sm font-bold tracking-widest"
                                    style={{ color: 'var(--foreground)' }}>
                                    {t('dashboard.charts.taskDetails')}
                                </h3>
                                <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                    {selectedType
                                        ? t('dashboard.charts.filteredBy', { filter: selectedType })
                                        : selectedStatus
                                            ? t('dashboard.charts.filteredBy', { filter: selectedStatus })
                                            : t('dashboard.charts.allTasks')}
                                    {tableRows.length > 0 && ` — ${t('dashboard.itemsCount', { count: tableRows.length })}`}
                                </p>
                            </div>
                        </div>

                        <div
                            className="overflow-auto rounded-b-[14px]"
                            style={{
                                maxHeight: '400px',
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#9ca3af transparent',
                            }}
                        >
                            {tableRows.length === 0 ? (
                                <div className="text-center py-10 text-sm text-muted-foreground border-t border-border">
                                    {t('dashboard.charts.noTasksFound', 'No tasks found')}
                                </div>
                            ) : isMobile ? (
                                <div className="flex flex-col border-t border-border divide-y divide-border">
                                    {tableRows.map((row, idx) => (
                                        <div key={`${row.docNumber}-${idx}`} className="flex relative items-center p-4 hover:bg-muted/50 transition-colors">
                                            {/* Left - Index */}
                                            <div className="w-[32px] text-xs font-bold text-muted-foreground shrink-0 mt-0.5">
                                                {idx + 1}
                                            </div>

                                            {/* Middle - Doc Number & Type */}
                                            <div className="flex-1 min-w-0 pr-4">
                                                <p className="text-sm font-bold text-slate-900 truncate" style={{ color: 'var(--foreground)' }}>
                                                    {row.docNumber}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1 truncate" style={{ color: 'var(--muted-foreground)' }}>
                                                    {row.documentTypeDesc || row.taskType}
                                                </p>
                                            </div>

                                            {/* Right - Amount & Status */}
                                            <div className="flex flex-col items-end pr-5 shrink-0 space-y-1.5">
                                                {row.totalNetAmount != null ? (
                                                    <p className="text-sm font-bold truncate tabular-nums text-foreground">
                                                        {row.totalNetAmount.toLocaleString(undefined, { minimumFractionDigits: row.displayCurrency?.toUpperCase() === 'VND' ? 0 : 2, maximumFractionDigits: row.displayCurrency?.toUpperCase() === 'VND' ? 0 : 2 })} {row.displayCurrency}
                                                    </p>
                                                ) : (
                                                    <p className="text-sm font-bold truncate text-muted-foreground">—</p>
                                                )}
                                                <div>
                                                    <StatusBadge status={row.status} />
                                                </div>
                                            </div>

                                            {/* Chevron */}
                                            <ChevronRight className="absolute right-4 w-4 h-4 text-slate-300" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <Table className="min-w-[640px]">
                                    <TableHeader className="sticky top-0 z-10 bg-muted">
                                        <TableRow className="hover:bg-muted border-b">
                                            <TableHead className="px-5 py-3 text-[11px] md:text-xs font-bold tracking-wider text-muted-foreground w-[60px]">
                                                {t('dashboard.table.rowNumber')}
                                            </TableHead>
                                            <TableHead className="px-5 py-3 text-[11px] md:text-xs font-bold tracking-wider text-muted-foreground">
                                                {t('dashboard.table.docNumber')}
                                            </TableHead>
                                            <TableHead className="px-5 py-3 text-[11px] md:text-xs font-bold tracking-wider text-muted-foreground">
                                                {t('dashboard.table.status')}
                                            </TableHead>
                                            <TableHead className="px-5 py-3 text-[11px] md:text-xs font-bold tracking-wider text-muted-foreground text-right">
                                                {t('dashboard.table.amount')}
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tableRows.map((row, idx) => (
                                            <TableRow key={`${row.docNumber}-${idx}`}>
                                                <TableCell className="px-5 py-3.5 text-xs md:text-sm font-semibold text-muted-foreground">
                                                    {idx + 1}
                                                </TableCell>
                                                <TableCell className="px-5 py-3.5 text-xs md:text-sm font-bold text-primary">
                                                    {row.docNumber}
                                                </TableCell>
                                                <TableCell className="px-5 py-3.5">
                                                    <StatusBadge status={row.status} />
                                                </TableCell>
                                                <TableCell className="px-5 py-3.5 text-xs md:text-sm font-bold text-right tabular-nums text-foreground">
                                                    {row.totalNetAmount != null
                                                        ? `${row.totalNetAmount.toLocaleString(undefined, { minimumFractionDigits: row.displayCurrency?.toUpperCase() === 'VND' ? 0 : 2, maximumFractionDigits: row.displayCurrency?.toUpperCase() === 'VND' ? 0 : 2 })} ${row.displayCurrency}`
                                                        : '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );

    // ── Layout: hamburger sidebar on mobile, desktop sidebar ──
    if (isMobile) {
        return (
            <div className="relative h-screen overflow-auto bg-background">
                {dashboardContent}
                <MobileSidebarSheet
                    isOpen={mobileMenuOpen}
                    onClose={() => setMobileMenuOpen(false)}
                    scope="my"
                    onScopeChange={handleScopeChange}
                    username={userInfo?.displayName}
                />
            </div>
        );
    }

    return (
        <div className="h-screen bg-slate-100/80">
            <div className="flex h-full">
                <TaskScopeSidebar
                    scope="my"
                    onScopeChange={handleScopeChange}
                    isCollapsed={sidebarCollapsed}
                    onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
                />
                <main className="relative min-w-0 flex-1 overflow-auto">
                    {dashboardContent}
                </main>
            </div>
        </div>
    );
}
