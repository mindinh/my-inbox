import { Routes, Route, HashRouter, useNavigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { useFLPSyncDirect, getInitialFLPRoute } from './hooks/useFLPSync';
import { useRef, useEffect, lazy, Suspense } from 'react';

// Lazy load pages for code-splitting
const InboxPage = lazy(() => import('./pages/Inbox'));
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'));

// Component to sync React Router with FLP shell URL
function ShellSync() {
    useFLPSyncDirect();
    return null;
}

// Component to navigate to initial route from FLP hash on app load
function InitialRouteNavigator() {
    const navigate = useNavigate();
    const hasNavigated = useRef(false);

    useEffect(() => {
        if (hasNavigated.current) return;
        hasNavigated.current = true;

        const initialRoute = getInitialFLPRoute();
        console.log("[App] Initial FLP route:", initialRoute);

        if (initialRoute && initialRoute !== "/") {
            console.log("[App] Navigating to initial route:", initialRoute);
            navigate(initialRoute, { replace: true });
        }
    }, [navigate]);

    return null;
}

// Loading fallback
function PageLoader() {
    return (
        <div className="h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3">
                <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <HashRouter>
            <ShellSync />
            <InitialRouteNavigator />
            <div className="min-h-screen bg-background">
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        {/* Inbox is the main landing page */}
                        <Route path="/" element={<InboxPage />} />
                        <Route path="/inbox" element={<InboxPage />} />
                        <Route path="/tasks/:taskId" element={<InboxPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                    </Routes>
                </Suspense>
                <Toaster closeButton />
            </div>
        </HashRouter>
    );
}
