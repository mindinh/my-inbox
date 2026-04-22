import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Clock,
    CheckCircle2,
    Menu,
    BarChart3,
    Inbox,
    CheckCheck,
    ChevronRight,
    Layers,
    LogOut,
} from 'lucide-react';
import { performLogout } from '@/services/inbox/inbox.api';
import { MobileSidebarSheet } from '@/pages/Inbox/components/TaskScopeSidebar';
import { useIsMobile } from '@/components/ui/use-mobile';
import { useDashboardQuery, normalizeDashboardStatus } from '@/pages/Dashboard/use-dashboard-data';
import type { DashboardTask, InboxTask } from '@/services/inbox/inbox.types';
import { TaskCard } from '@/pages/Inbox/components/TaskCard';
import { useTasks, useCurrentUser } from '@/pages/Inbox/hooks/inboxQueries';

/**
 * HomePage — Mobile-only landing page.
 * On desktop, redirects to /inbox automatically.
 * Shows: gradient header, stat cards (Total/New/Approved), top-5 newest tasks, quick access grid.
 */
export default function HomePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { data: userInfo } = useCurrentUser();

    // Redirect desktop users to inbox — home page is mobile-only
    useEffect(() => {
        if (!isMobile) {
            navigate('/inbox', { replace: true });
        }
    }, [isMobile, navigate]);

    // Reuse the dashboard query for real stats and task data
    const { data: dashboardData, isLoading } = useDashboardQuery();
    const tasks: DashboardTask[] = dashboardData?.items ?? [];

    // Compute stats
    const stats = useMemo(() => {
        const totalTasks = tasks.length;
        const newTasks = tasks.filter(
            (t) => normalizeDashboardStatus(t.status) === 'In Approving'
        ).length;
        const approved = tasks.filter(
            (t) => normalizeDashboardStatus(t.status) === 'Approved'
        ).length;
        return { totalTasks, newTasks, approved };
    }, [tasks]);

    // Real My Inbox Task data for Newest Tasks feed
    const { data: inboxData, isLoading: isInboxLoading } = useTasks({ top: 5 });
    const newestTasks: InboxTask[] = inboxData?.items || [];

    const quickAccessItems = [
        {
            icon: <Inbox className="w-6 h-6" />,
            iconClass: 'text-orange-500 bg-orange-50',
            label: t('nav.myTasks', 'My Tasks'),
            to: '/inbox',
            state: { scope: 'my' },
        },
        {
            icon: <CheckCheck className="w-6 h-6" />,
            iconClass: 'text-emerald-600 bg-emerald-50',
            label: t('nav.approvedTasks', 'Approved Tasks'),
            to: '/inbox',
            state: { scope: 'approved' },
        },
        {
            icon: <BarChart3 className="w-6 h-6" />,
            iconClass: 'text-indigo-600 bg-indigo-50',
            label: t('nav.dashboard', 'Dashboard'),
            to: '/dashboard',
            state: undefined,
        },
    ];

    // Desktop: don't render (redirect in effect handles it)
    if (!isMobile) return null;

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
            {/* ── Gradient Header ────────────────────────── */}
            <div
                className="relative px-5 pt-5 pb-16"
                style={{
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                }}
            >
                {/* Hamburger + Logout */}
                <div className="flex items-center justify-between mb-3">
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/10 active:bg-white/20"
                        aria-label="Open navigation menu"
                    >
                        <Menu size={22} className="text-white" />
                    </button>
                    <button
                        onClick={() => { performLogout(); }}
                        className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/10 active:bg-white/20"
                        aria-label={t('nav.logOut', 'Log Out')}
                    >
                        <LogOut size={20} className="text-white" />
                    </button>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <p className="text-white/80 text-base font-medium">
                        {t('home.welcomeBack', 'Welcome back')},{' '}
                        <span className="text-white font-bold text-lg">{userInfo?.displayName || 'User'}</span>
                    </p>
                    <p className="text-white/60 text-xs mt-1">
                        {stats.newTasks > 0
                            ? t('home.pendingApprovals', { count: stats.newTasks, defaultValue: `${stats.newTasks} pending approvals` })
                            : t('home.allCaughtUp', 'All caught up! No pending approvals')}
                    </p>
                </motion.div>
            </div>

            {/* ── Stat Cards (overlapping the gradient) ──── */}
            <div className="px-4 -mt-8 relative z-10 space-y-3">
                {/* Total Tasks — full-width, Info Blue */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="rounded-2xl px-5 py-4 flex items-center gap-4"
                    style={{
                        backgroundColor: 'var(--marketing-info-blue-bg)',
                        border: '1.5px solid var(--marketing-info-blue-border)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                >
                    <div
                        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--marketing-info-blue-border)' }}
                    >
                        <Layers className="w-6 h-6" style={{ color: 'var(--marketing-info-blue)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold" style={{ color: 'var(--marketing-info-blue)' }}>
                            {t('home.totalTasks', 'Total Tasks')}
                        </p>
                        <p className="text-3xl font-extrabold leading-tight" style={{ color: 'var(--marketing-info-blue)' }}>
                            {isLoading ? '—' : stats.totalTasks}
                        </p>
                    </div>
                </motion.div>

                {/* In Approving + Approved — two half-width cards */}
                <div className="grid grid-cols-2 gap-3">
                    {/* In Approving → Attention Orange */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.08 }}
                        className="rounded-2xl px-4 py-4 flex items-center gap-3 cursor-pointer active:scale-[0.97] transition-transform"
                        style={{
                            backgroundColor: 'var(--marketing-attention-bg)',
                            border: '1.5px solid var(--marketing-attention-border)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        }}
                        onClick={() => navigate('/inbox', { state: { scope: 'my' } })}
                    >
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: 'var(--marketing-attention-border)' }}
                        >
                            <Clock className="w-5 h-5" style={{ color: 'var(--marketing-attention)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--marketing-attention)' }}>
                                {t('dashboard.statCards.inApproving', 'In Approving')}
                            </p>
                            <p className="text-2xl font-extrabold leading-tight" style={{ color: 'var(--marketing-attention)' }}>
                                {isLoading ? '—' : stats.newTasks}
                            </p>
                        </div>
                    </motion.div>

                    {/* Approved → Positive Green */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.16 }}
                        className="rounded-2xl px-4 py-4 flex items-center gap-3 cursor-pointer active:scale-[0.97] transition-transform"
                        style={{
                            backgroundColor: 'var(--marketing-positive-bg)',
                            border: '1.5px solid var(--marketing-positive-border)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        }}
                        onClick={() => navigate('/inbox', { state: { scope: 'approved' } })}
                    >
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: 'var(--marketing-positive-border)' }}
                        >
                            <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--marketing-positive)' }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--marketing-positive)' }}>
                                {t('dashboard.statCards.approved', 'Approved')}
                            </p>
                            <p className="text-2xl font-extrabold leading-tight" style={{ color: 'var(--marketing-positive)' }}>
                                {isLoading ? '—' : stats.approved}
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ── Top 5 Newest Tasks ─────────────────────── */}
            <div className="px-4 mt-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                        {t('home.newestTasks', 'Newest Tasks')}
                    </h2>
                    <button
                        onClick={() => navigate('/inbox', { state: { scope: 'my' } })}
                        className="text-sm font-semibold hover:underline"
                        style={{ color: 'var(--primary)' }}
                    >
                        {t('home.viewAll', 'View All')}
                    </button>
                </div>

                {isInboxLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={`skeleton-${i}`}
                                className="rounded-xl p-4 border animate-pulse"
                                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                            >
                                <div className="h-4 w-3/4 rounded bg-muted mb-2" />
                                <div className="h-3 w-1/2 rounded bg-muted" />
                            </div>
                        ))}
                    </div>
                ) : newestTasks.length === 0 ? (
                    <div
                        className="rounded-xl p-8 border text-center"
                        style={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.10)',
                        }}
                    >
                        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            {t('home.noTasks', "No pending tasks. You're all caught up!")}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {newestTasks.map((task, i) => (
                            <motion.div
                                key={`${task.instanceId}-${i}`}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, delay: i * 0.05 }}
                            >
                                <TaskCard 
                                    task={task}
                                    isSelected={false}
                                    onClick={() => navigate(`/tasks/${task.instanceId}`, { state: { scope: 'my' } })}
                                    variant="mobile"
                                />
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Quick Access ───────────────────────────── */}
            <div className="px-4 mt-6 pb-8">
                <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--foreground)' }}>
                    {t('home.quickAccess', 'Quick Access')}
                </h2>
                <div className="grid grid-cols-3 gap-3">
                    {quickAccessItems.map((item, i) => (
                        <motion.button
                            key={item.label}
                            type="button"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.06 }}
                            onClick={() => navigate(item.to, item.state ? { state: item.state } : undefined)}
                            className="rounded-xl p-4 border text-center hover:shadow-lg active:scale-[0.97] transition-all"
                            style={{
                                backgroundColor: 'var(--card)',
                                borderColor: 'var(--border)',
                                boxShadow: '0 4px 20px -2px rgba(0,0,0,0.10), 0 2px 8px -2px rgba(0,0,0,0.06)',
                            }}
                        >
                            <div
                                className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 mx-auto ${item.iconClass}`}
                            >
                                {item.icon}
                            </div>
                            <p className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>
                                {item.label}
                            </p>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Mobile Sidebar Drawer */}
            <MobileSidebarSheet
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                scope="my"
                onScopeChange={(s) => {
                    navigate('/inbox', { state: { scope: s } });
                }}
                username={userInfo?.displayName}
            />
        </div>
    );
}
