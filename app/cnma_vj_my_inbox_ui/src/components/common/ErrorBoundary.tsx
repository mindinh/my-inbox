import React from 'react';
import { AccessDenied } from './AccessDenied';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    isForbidden: boolean;
}

/**
 * Top-level error boundary that catches render-time crashes.
 * If the crash was triggered by a 403, shows AccessDenied.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, isForbidden: false };
    }

    static getDerivedStateFromError(error: any): ErrorBoundaryState {
        const isForbidden =
            error?.isForbidden === true ||
            error?.response?.status === 403 ||
            (error?.message && error.message.includes('403'));

        return { hasError: true, isForbidden };
    }

    componentDidCatch(error: any, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.state.isForbidden) {
                return <AccessDenied />;
            }
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                    <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
                    <p className="text-muted-foreground text-center max-w-md">
                        An unexpected error occurred. Please try refreshing the page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        Refresh Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
