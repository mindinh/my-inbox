import { CheckCheck, ChevronLeft, ChevronRight, Inbox, LayoutDashboard } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

type TaskScope = 'my' | 'approved' | 'dashboard';

interface TaskScopeSidebarProps {
    scope: TaskScope;
    onScopeChange: (scope: TaskScope) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

interface TaskScopeFloatingBarProps {
    scope: TaskScope;
    onScopeChange: (scope: TaskScope) => void;
}

const scopeItems: Array<{ value: TaskScope; label: string; icon: typeof Inbox; route?: string }> = [
    { value: 'my', label: 'My Tasks', icon: Inbox, route: '/' },
    { value: 'approved', label: 'Approved Tasks', icon: CheckCheck, route: '/' },
    { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, route: '/dashboard' },
];

export function TaskScopeSidebar({
    scope,
    onScopeChange,
    isCollapsed,
    onToggleCollapse,
}: TaskScopeSidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const isDashboard = location.pathname === '/dashboard';
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

export function TaskScopeFloatingBar({ scope, onScopeChange }: TaskScopeFloatingBarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const isDashboard = location.pathname === '/dashboard';
    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_10px_25px_rgba(15,23,42,0.16)] backdrop-blur-sm">
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
                                'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors',
                                isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                            )}
                        >
                            <Icon className="size-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
