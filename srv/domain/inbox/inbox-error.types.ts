/**
 * Inbox Error Types — Phase 2 Normalized Error Categories
 *
 * Provides stable error classification for SAP integration failures.
 * Used by task-error-mapper to normalize exceptions before they reach callers.
 */

/** Normalized error categories for SAP task integration failures. */
export enum InboxErrorCategory {
    /** Authentication failed (401, missing/expired JWT) */
    AUTH_ERROR = 'AUTH_ERROR',
    /** Principal propagation user mapping failure */
    PROPAGATION_ERROR = 'PROPAGATION_ERROR',
    /** BTP destination unreachable or misconfigured */
    DESTINATION_ERROR = 'DESTINATION_ERROR',
    /** CSRF token fetch or validation failure */
    CSRF_ERROR = 'CSRF_ERROR',
    /** HTTP-level SAP error (4xx/5xx) */
    SAP_HTTP_ERROR = 'SAP_HTTP_ERROR',
    /** SAP business logic rejection (e.g. decision not allowed) */
    SAP_BUSINESS_ERROR = 'SAP_BUSINESS_ERROR',
    /** Client sent invalid input */
    INVALID_INPUT = 'INVALID_INPUT',
    /** Resource not found (task, attachment, etc.) */
    NOT_FOUND = 'NOT_FOUND',
    /** Unclassified / unexpected failure */
    UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
}

/**
 * Normalized error class for SAP task integration failures.
 * Preserves enough context for logging and caller behavior decisions.
 */
export class InboxError extends Error {
    constructor(
        message: string,
        public readonly category: InboxErrorCategory,
        public readonly operation: string,
        public readonly httpStatus?: number,
        public readonly cause?: Error,
    ) {
        super(message);
        this.name = 'InboxError';
    }

    /** Safe summary string for logging (no sensitive data). */
    get safeSummary(): string {
        return `[${this.category}] ${this.operation}: ${this.message}`;
    }

    /** Derive appropriate HTTP status code from error category. */
    get statusCode(): number {
        if (this.httpStatus) return this.httpStatus;
        switch (this.category) {
            case InboxErrorCategory.AUTH_ERROR:
            case InboxErrorCategory.PROPAGATION_ERROR:
                return 401;
            case InboxErrorCategory.INVALID_INPUT:
                return 400;
            case InboxErrorCategory.NOT_FOUND:
                return 404;
            case InboxErrorCategory.DESTINATION_ERROR:
            case InboxErrorCategory.SAP_HTTP_ERROR:
            case InboxErrorCategory.SAP_BUSINESS_ERROR:
            case InboxErrorCategory.CSRF_ERROR:
                return 502;
            default:
                return 500;
        }
    }
}
