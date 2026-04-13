import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TaskScopeSidebar, TaskScopeFloatingBar } from '@/pages/Inbox/components/TaskScopeSidebar';
import { useIsMobile } from '@/components/ui/use-mobile';
import {
    CircleCheck,
    BadgeCheck,
    Clock,
    Layers,
    ListFilter,
    X,
    Loader2,
    AlertCircle,
} from 'lucide-react';
import { useDashboardQuery, useDashboardData, STATUS_COLORS } from './use-dashboard-data';
import type { DonutSegment } from './use-dashboard-data';
import { StatusBadge } from '@/pages/Inbox/components/TaskBadges';

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
// Horizontal Bar Chart (In Process / Remaining style)
// Matches reference: label on left, count below, grey bar = total, orange bar = in process
// ═══════════════════════════════════════════════════════════

function HorizontalBarChart({
    data,
    selectedLabel,
    onBarClick,
}: {
    data: { label: string; total: number; inProcess: number }[];
    selectedLabel: string | null;
    onBarClick: (label: string) => void;
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
    const barH = 14;
    const rowHeight = 64;
    const labelWidth = 160;
    const chartLeft = labelWidth + 16;
    const chartWidth = 280;
    const totalHeight = data.length * rowHeight + 36;

    return (
        <svg
            viewBox={`0 0 ${chartLeft + chartWidth + 20} ${totalHeight}`}
            width="100%"
            style={{ overflow: 'visible' }}
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
                const barY = yBase + 8;
                const totalW = Math.max((d.total / axisMax) * chartWidth, 2);
                const inProcessW = Math.max((d.inProcess / axisMax) * chartWidth, 0);

                const isBarActive = selectedLabel === d.label;
                const isBarFiltered = selectedLabel != null && !isBarActive;

                return (
                    <g
                        key={d.label}
                        style={{ cursor: 'pointer', opacity: isBarFiltered ? 0.32 : 1, transition: 'opacity 0.2s ease' }}
                        onClick={() => onBarClick(d.label)}
                    >
                        {/* Hit area */}
                        <rect x={0} y={yBase - 4} width={chartLeft + chartWidth + 20} height={rowHeight}
                            fill="transparent" />

                        {/* ── Label: type name ── */}
                        <text x={labelWidth} y={barY + barH / 2 - 1} textAnchor="end" dominantBaseline="central"
                            style={{
                                fill: isBarActive ? 'var(--primary)' : 'var(--foreground)',
                                fontSize: '12px',
                                fontWeight: isBarActive ? 700 : 600,
                            }}>
                            {d.label.length > 20 ? d.label.slice(0, 20) + '…' : d.label}
                        </text>

                        {/* ── Sub-label: in-process / total ── */}
                        <text x={labelWidth} y={barY + barH + 16} textAnchor="end" dominantBaseline="central"
                            style={{
                                fill: 'var(--muted-foreground)',
                                fontSize: '11px',
                                fontWeight: 500,
                            }}>
                            {d.inProcess}/{d.total}
                        </text>

                        {/* ── Grey bar: Remaining (total) ── */}
                        <rect x={chartLeft} y={barY} width={totalW} height={barH}
                            rx={3} fill="#d1d5db">
                            <animate attributeName="width" from="0" to={totalW} dur="0.45s" fill="freeze" />
                        </rect>

                        {/* ── Orange bar: In Process ── */}
                        {d.inProcess > 0 && (
                            <rect x={chartLeft} y={barY} width={inProcessW} height={barH}
                                rx={3} fill={STATUS_COLORS['In Process']}>
                                <animate attributeName="width" from="0" to={inProcessW} dur="0.45s" fill="freeze" />
                            </rect>
                        )}
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
    const isMobile = useIsMobile();
    const navigate = useNavigate();

    const { data: dashboardData, isLoading, isError } = useDashboardQuery();
    const tasks = dashboardData?.items ?? [];

    const {
        donutSegments,
        barData,
        tableRows,
        totalTasks,
        totalTypes,
    } = useDashboardData(tasks, selectedStatus, selectedType);

    // ── Transform barData to In Process / Remaining format ──
    const barChartData = barData.map((d) => ({
        label: d.label,
        total: d.total,
        inProcess: d.statusCounts['In Process'] || 0,
    }));

    // ── Handlers ─────────────────────────────────────────
    const handleDonutClick = useCallback((label: string) => {
        setSelectedStatus((prev) => (prev === label ? null : label));
        setSelectedType(null);
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
        <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
            {/* ── Header ─────────────────────────────────── */}
            <div className="px-4 pt-5 pb-3 md:px-8 md:pt-8 md:pb-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                            {t('dashboard.title')}
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                            {t('dashboard.subtitle')}
                        </p>
                    </div>
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

            {/* ── Loading State ────────────────────────────── */}
            {isLoading ? (
                <div className="flex items-center justify-center py-32">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('dashboard.loadingDashboard')}</p>
                    </div>
                </div>
            ) : isError ? (
                /* ── Error State ────────────────────────────── */
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
                    <AnimatePresence>
                        {hasFilters && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex items-center gap-2 flex-wrap"
                            >
                                <ListFilter size={14} style={{ color: 'var(--muted-foreground)' }} />
                                {selectedStatus && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                        style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)', border: '1px solid var(--info)' }}>
                                        {t('dashboard.filters.status', { status: selectedStatus })}
                                        <X size={10} className="cursor-pointer ml-0.5" onClick={() => { setSelectedStatus(null); setSelectedType(null); }} />
                                    </span>
                                )}
                                {selectedType && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                        style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning)' }}>
                                        {t('dashboard.filters.type', { type: selectedType })}
                                        <X size={10} className="cursor-pointer ml-0.5" onClick={() => setSelectedType(null)} />
                                    </span>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Stat Cards ─────────────────────────── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { icon: Layers, label: t('dashboard.statCards.totalTasks'), value: totalTasks, color: 'var(--primary)' },
                            { icon: CircleCheck, label: t('dashboard.statCards.ready'), value: donutSegments.find((s) => s.label === 'Ready')?.value ?? 0, color: STATUS_COLORS['Ready'] },
                            { icon: Clock, label: t('dashboard.statCards.inProcess'), value: donutSegments.find((s) => s.label === 'In Process')?.value ?? 0, color: STATUS_COLORS['In Process'] },
                            { icon: BadgeCheck, label: t('dashboard.statCards.approved'), value: donutSegments.find((s) => s.label === 'Approved')?.value ?? 0, color: STATUS_COLORS['Approved'] },
                        ].map((card) => (
                            <motion.div
                                key={card.label}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="p-4 md:p-5"
                                style={cardStyle}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${card.color}15` }}>
                                        <card.icon size={16} style={{ color: card.color }} />
                                    </div>
                                </div>
                                <p className="text-2xl md:text-3xl font-extrabold" style={{ color: 'var(--foreground)' }}>{card.value}</p>
                                <p className="text-[11px] md:text-xs font-semibold mt-1 tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                                    {card.label.toUpperCase()}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* ── Main charts: 2-col desktop, stacked mobile ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">

                        {/* ─── Chart 1: Donut (1 col) ────────── */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35 }}
                            className="p-5 md:p-6"
                            style={cardStyle}
                        >
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
                                    onSegmentClick={handleDonutClick}
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
                                                onClick={() => handleDonutClick(seg.label)}
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

                        {/* ─── Chart 2: Bar chart (1 col) ─────── */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.1 }}
                            className="overflow-hidden"
                            style={cardStyle}
                        >
                            <div className="px-5 pt-5 pb-2 md:px-6 md:pt-6">
                                <h3 className="text-xs md:text-sm font-bold tracking-widest"
                                    style={{ color: 'var(--foreground)' }}>
                                    {t('dashboard.charts.tasksByType')}
                                </h3>
                                <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                    {selectedStatus ? t('dashboard.charts.filteredBy', { filter: selectedStatus }) : t('dashboard.charts.groupedByTaskType')}
                                </p>
                            </div>

                            <div className="px-5 pb-5 md:px-6 md:pb-6">
                                <HorizontalBarChart
                                    data={barChartData}
                                    selectedLabel={selectedType}
                                    onBarClick={handleBarClick}
                                />
                            </div>

                            {/* Bottom legend */}
                            <div className="px-5 pb-4 md:px-6 md:pb-5 flex items-center gap-6 border-t" style={{ borderColor: 'var(--border)' }}>
                                <div className="flex items-center gap-2 pt-3">
                                    <span className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS['In Process'] }} />
                                    <span className="text-xs md:text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('dashboard.charts.inProcess')}</span>
                                </div>
                                <div className="flex items-center gap-2 pt-3">
                                    <span className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: '#d1d5db' }} />
                                    <span className="text-xs md:text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('dashboard.charts.remaining')}</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* ─── Chart 3: Task Table ────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.2 }}
                        className="overflow-hidden"
                        style={cardStyle}
                    >
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

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px]">
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                                        <th className="text-left px-5 py-3 text-[11px] md:text-xs font-bold tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{t('dashboard.table.rowNumber')}</th>
                                        <th className="text-left px-5 py-3 text-[11px] md:text-xs font-bold tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{t('dashboard.table.type')}</th>
                                        <th className="text-left px-5 py-3 text-[11px] md:text-xs font-bold tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{t('dashboard.table.docNumber')}</th>
                                        <th className="text-left px-5 py-3 text-[11px] md:text-xs font-bold tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{t('dashboard.table.status')}</th>
                                        <th className="text-right px-5 py-3 text-[11px] md:text-xs font-bold tracking-wider" style={{ color: 'var(--muted-foreground)' }}>{t('dashboard.table.amount')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-10 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                                {t('dashboard.charts.noTasksFound')}
                                            </td>
                                        </tr>
                                    ) : tableRows.map((row, idx) => {
                                        const statusColor = STATUS_COLORS[row.status] || 'var(--muted-foreground)';
                                        return (
                                            <tr
                                                key={`${row.docNumber}-${idx}`}
                                                className="transition-colors"
                                                style={{ borderBottom: '1px solid var(--border)' }}
                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--muted)')}
                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                            >
                                                <td className="px-5 py-3.5 text-xs md:text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                                                    {idx + 1}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs md:text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                                                    {row.documentTypeDesc}
                                                </td>
                                                <td className="px-5 py-3.5 text-xs md:text-sm font-bold" style={{ color: 'var(--primary)' }}>
                                                    {row.docNumber}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <StatusBadge status={row.status} />
                                                </td>
                                                <td className="px-5 py-3.5 text-xs md:text-sm font-bold text-right tabular-nums" style={{ color: 'var(--foreground)' }}>
                                                    {row.totalNetAmount != null
                                                        ? `${row.totalNetAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${row.displayCurrency}`
                                                        : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );

    // ── Layout: sidebar on desktop, floating bar on mobile ──
    if (isMobile) {
        return (
            <div className="relative h-screen overflow-auto bg-background">
                {dashboardContent}
                <TaskScopeFloatingBar
                    scope="my"
                    onScopeChange={handleScopeChange}
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
