import { CheckCheck, ChevronLeft, ChevronRight, Home, Inbox, LayoutDashboard, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

type TaskScope = 'my' | 'approved' | 'dashboard' | 'home';

interface TaskScopeSidebarProps {
    scope: TaskScope;
    onScopeChange: (scope: TaskScope) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

interface MobileSidebarSheetProps {
    isOpen: boolean;
    onClose: () => void;
    scope: TaskScope;
    onScopeChange: (scope: 'my' | 'approved') => void;
    /** Display name shown under the app title in the drawer header */
    username?: string;
}

/** Desktop-only nav items (no Home — it's mobile-only) */
export function useScopeItems() {
    const { t } = useTranslation();
    return [
        { value: 'my' as TaskScope, label: t('nav.myTasks'), icon: Inbox, route: '/' },
        { value: 'approved' as TaskScope, label: t('nav.approvedTasks'), icon: CheckCheck, route: '/' },
        { value: 'dashboard' as TaskScope, label: t('nav.dashboard'), icon: LayoutDashboard, route: '/dashboard' },
    ];
}

/** Mobile nav items include Home at the top */
function useMobileScopeItems() {
    const { t } = useTranslation();
    return [
        { value: 'home' as TaskScope, label: t('nav.home', 'Home'), icon: Home, route: '/home' },
        { value: 'my' as TaskScope, label: t('nav.myTasks'), icon: Inbox, route: '/' },
        { value: 'approved' as TaskScope, label: t('nav.approvedTasks'), icon: CheckCheck, route: '/' },
        { value: 'dashboard' as TaskScope, label: t('nav.dashboard'), icon: LayoutDashboard, route: '/dashboard' },
    ];
}

// ── Desktop sidebar ──────────────────────────────────────

export function TaskScopeSidebar({
    scope,
    onScopeChange,
    isCollapsed,
    onToggleCollapse,
}: TaskScopeSidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const isDashboard = location.pathname === '/dashboard';
    const scopeItems = useScopeItems();
    return (
        <aside
            className={cn(
                'relative flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
                isCollapsed ? 'w-16' : 'w-72'
            )}
        >


            <nav className="flex-1 space-y-1 p-3">
                {scopeItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.value === 'dashboard'
                        ? isDashboard
                        : !isDashboard && scope === item.value;

                    return (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                                if (item.route === '/dashboard') {
                                    navigate('/dashboard');
                                } else {
                                    if (isDashboard) {
                                        navigate('/', { state: { scope: item.value } });
                                    } else {
                                        onScopeChange(item.value as 'my' | 'approved');
                                    }
                                }
                            }}
                            className={cn(
                                'group flex w-full items-center rounded-lg py-2 text-sm transition-all duration-200',
                                isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3',
                                isActive
                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                            )}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <Icon
                                className={cn(
                                    'size-4 shrink-0',
                                    isActive
                                        ? 'text-sidebar-primary-foreground'
                                        : 'text-sidebar-foreground group-hover:text-sidebar-accent-foreground'
                                )}
                            />
                            {!isCollapsed && <span className="truncate font-medium">{item.label}</span>}
                        </button>
                    );
                })}
            </nav>

            <button
                type="button"
                onClick={onToggleCollapse}
                className="absolute right-[-12px] top-6 z-30 hidden h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-sidebar-accent md:flex"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
            </button>
        </aside>
    );
}

// ── Mobile sidebar drawer (matches reference prorequest design) ──
// Animated slide-in panel with gradient header, app name, close button,
// and nav items with active indicator bar on the left edge.

export function MobileSidebarSheet({
    isOpen,
    onClose,
    scope,
    onScopeChange,
    username,
}: MobileSidebarSheetProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const isDashboard = location.pathname === '/dashboard';
    const isHome = location.pathname === '/home';
    const scopeItems = useMobileScopeItems();

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/40 z-40 md:hidden"
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    {/* Drawer Panel */}
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                        className="fixed top-0 left-0 h-full w-[280px] bg-white shadow-2xl z-50 flex flex-col md:hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Navigation menu"
                    >
                        {/* Header - Brand Red Gradient */}
                        <div
                            className="relative px-5 pt-6 pb-5"
                            style={{
                                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                            }}
                        >
                            <button
                                type="button"
                                onClick={onClose}
                                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors p-1"
                                aria-label="Close menu"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="text-white">
                                <p className="text-base font-bold tracking-tight">prorequest</p>
                                <p className="text-sm text-white/70 mt-0.5">{username || 'User'}</p>
                            </div>
                        </div>

                        {/* Navigation Items */}
                        <nav className="flex-1 py-2" aria-label="Main navigation">
                            {scopeItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = item.value === 'dashboard'
                                    ? isDashboard
                                    : item.value === 'home'
                                        ? isHome
                                        : !isDashboard && !isHome && scope === item.value;

                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            if (item.route === '/home') {
                                                navigate('/home');
                                            } else if (item.route === '/dashboard') {
                                                navigate('/dashboard');
                                            } else {
                                                if (isDashboard || isHome) {
                                                    navigate('/', { state: { scope: item.value } });
                                                } else {
                                                    onScopeChange(item.value as 'my' | 'approved');
                                                }
                                            }
                                        }}
                                        className={cn(
                                            'flex w-full items-center gap-4 px-5 py-3.5 text-[15px] font-medium transition-colors relative',
                                            isActive
                                                ? 'text-primary bg-primary/5'
                                                : 'text-foreground hover:bg-muted'
                                        )}
                                    >
                                        {/* Active indicator bar */}
                                        {isActive && (
                                            <span
                                                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Keep TaskScopeFloatingBar as a deprecated export for backward compat
// (can be removed once all pages migrate to MobileSidebarSheet)
/** @deprecated Use MobileSidebarSheet instead */
export function TaskScopeFloatingBar({ scope, onScopeChange }: { scope: TaskScope; onScopeChange: (scope: TaskScope) => void }) {
    return null; // No-op — replaced by hamburger sidebar
}
