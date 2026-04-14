import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  LogOut,
  Inbox,
  Home,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/pages/Inbox/hooks/inboxQueries';

// ── Nav config types ──────────────────────────────────────────────

interface NavLeaf {
  type: 'leaf';
  to: string;
  icon: LucideIcon;
  label: string;
  adminOnly?: boolean;
}

interface NavGroup {
  type: 'group';
  icon: LucideIcon;
  label: string;
  adminOnly?: boolean;
  children: NavEntry[];
}

type NavEntry = NavLeaf | NavGroup;

// ── Build nav tree ────────────────────────────────────────────────

function useNavTree(): NavEntry[] {
  const { t } = useTranslation();
  return [
    { type: 'leaf', to: '/', icon: Home, label: t('nav.home', 'Home') },
    { type: 'leaf', to: '/inbox', icon: Inbox, label: t('nav.myInbox', 'prorequest') },
    // TODO: Add more navigation items here
  ];
}

// ── Check if any leaf in a subtree matches the current path ───────

function isGroupActive(entry: NavEntry, pathname: string): boolean {
  if (entry.type === 'leaf') {
    return entry.to === pathname || (entry.to !== '/' && pathname.startsWith(entry.to));
  }
  return entry.children.some(child => isGroupActive(child, pathname));
}

// ── Leaf nav item ────────────────────────────────────────────────

function NavLeafItem({ to, icon: Icon, label, isCollapsed, depth = 0, onClick }: {
  to: string; icon: LucideIcon; label: string; isCollapsed: boolean; depth?: number; onClick?: () => void;
}) {
  const location = useLocation();
  const isActive = to === location.pathname || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 py-1.5 rounded-lg transition-all duration-200 group relative text-sm',
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isCollapsed ? 'justify-center px-2' : 'px-3',
      )}
      style={!isCollapsed ? { paddingLeft: `${12 + depth * 12}px` } : undefined}
      title={isCollapsed ? label : undefined}
    >
      <Icon
        size={depth > 0 ? 16 : 18}
        className={cn(
          'transition-colors shrink-0',
          isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground group-hover:text-sidebar-accent-foreground'
        )}
      />
      {!isCollapsed && (
        <span className="font-medium whitespace-nowrap overflow-hidden truncate">{label}</span>
      )}
    </Link>
  );
}

// ── Collapsible nav group ────────────────────────────────────────

function NavGroupItem({ entry, isCollapsed, depth = 0, onLeafClick }: {
  entry: NavGroup; isCollapsed: boolean; depth?: number; onLeafClick?: () => void;
}) {
  const location = useLocation();
  const hasActiveChild = isGroupActive(entry, location.pathname);
  const [isOpen, setIsOpen] = useState(hasActiveChild);
  const Icon = entry.icon;

  React.useEffect(() => {
    if (hasActiveChild && !isOpen) setIsOpen(true);
  }, [hasActiveChild]);

  if (isCollapsed) return null;

  return (
    <div>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(prev => !prev); }}
        className={cn(
          'w-full flex items-center gap-2.5 py-1.5 rounded-lg transition-all duration-200 text-sm cursor-pointer',
          hasActiveChild
            ? 'text-sidebar-foreground font-semibold'
            : 'text-sidebar-foreground font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )}
        style={{ paddingLeft: `${12 + depth * 12}px`, paddingRight: '12px' }}
      >
        <Icon size={depth > 0 ? 16 : 18} className="shrink-0 text-sidebar-foreground" />
        <span className="flex-1 text-left whitespace-nowrap overflow-hidden truncate">{entry.label}</span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 transition-transform duration-200', isOpen ? '' : '-rotate-90')}
        />
      </button>

      {isOpen && (
        <div className="space-y-0.5 mt-0.5">
          {entry.children.map((child, idx) =>
            child.type === 'leaf' ? (
              <NavLeafItem
                key={child.to}
                {...child}
                isCollapsed={false}
                depth={depth + 1}
                onClick={onLeafClick}
              />
            ) : (
              <NavGroupItem
                key={idx}
                entry={child as NavGroup}
                isCollapsed={false}
                depth={depth + 1}
                onLeafClick={onLeafClick}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Layout ──────────────────────────────────────────────────

export function MainLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { t } = useTranslation();
  const isInWorkZone = typeof window !== 'undefined' && window.parent !== window;
  const { data: userInfo } = useCurrentUser();
  const username = userInfo?.displayName || 'User';

  const navTree = useNavTree();

  return (
    <div className="h-screen overflow-hidden bg-background flex font-sans">
      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 lg:static lg:translate-x-0",
          isMobileOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0",
          isCollapsed ? "lg:w-16" : "lg:w-72"
        )}
      >
        {!isInWorkZone && (
          <div className={cn("p-4 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
            {!isCollapsed && (
              <div className="flex items-center gap-2 overflow-hidden">
                <img src="./RESOURCE_FAVICON.png" alt="Logo" className="w-6 h-6 shrink-0 rounded-sm" />
                <span className="text-sm font-bold tracking-wide text-sidebar-foreground">{t('app.title', 'prorequest')}</span>
              </div>
            )}

            {/* Mobile Close Button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden text-sidebar-foreground p-1 hover:bg-sidebar-accent rounded-md"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navTree.map((entry, idx) =>
            entry.type === 'leaf' ? (
              <NavLeafItem
                key={entry.to}
                {...entry}
                isCollapsed={isCollapsed}
                onClick={() => setIsMobileOpen(false)}
              />
            ) : (
              <NavGroupItem
                key={idx}
                entry={entry as NavGroup}
                isCollapsed={isCollapsed}
                onLeafClick={() => setIsMobileOpen(false)}
              />
            )
          )}
        </div>

        {/* User Profile — hidden in WorkZone */}
        {!isInWorkZone && (
          <div className={cn("mt-auto border-t border-sidebar-border p-4", isCollapsed ? "items-center" : "")}>
            <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "")}>
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-sidebar-accent-foreground shrink-0 border border-sidebar-border">
                {username.charAt(0).toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{username}</p>
                </div>
              )}
              <button
                onClick={() => { window.location.href = '/do/logout'; }}
                className={cn(
                  "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors",
                  isCollapsed ? "mt-2" : ""
                )}
                title={t('nav.logOut', 'Log Out')}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Collapse Toggle (Desktop Only) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm hover:bg-sidebar-accent"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Main Content */}
      <main id="main-scroll-container" className="flex-1 overflow-auto bg-background flex flex-col w-full scroll-smooth">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center p-4 border-b border-border bg-card shadow-sm z-30 relative">
          <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(true)} className="mr-3 text-muted-foreground hover:bg-slate-100/80 -ml-2">
            <Menu size={22} strokeWidth={2.5} />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <img src="./RESOURCE_FAVICON.png" alt="Logo" className="w-6 h-6 shrink-0 rounded-sm" />
            <h1 className="text-[17px] font-bold text-slate-800 tracking-tight">{t('app.title', 'prorequest')}</h1>
          </div>
        </div>

        <div className="flex-1 w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
