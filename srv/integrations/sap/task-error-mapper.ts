/**
 * Task Error Mapper — Phase 2 Error Normalization
 *
 * Maps transport/SAP/runtime failures into normalized internal error categories.
 * Preserves enough context for logs and caller behavior decisions.
 *
 * Rules:
 *   - Do not leak unstable SAP error structures outside adapter boundaries
 *   - Do not hide necessary debugging context from logs
 *   - Preserve caller behavior expected by current API contract
 */

import { InboxErrorCategory, InboxError } from '../../domain/inbox/inbox-error.types';

/**
 * Classify a raw error into a normalized InboxErrorCategory.
 */
export function classifyError(error: unknown): InboxErrorCategory {
    const err = asErrorLike(error);
    const message = readString(err.message)?.toLowerCase() || '';
    const status = extractHttpStatus(err);

    // Auth / propagation errors
    if (status === 401 || message.includes('unauthorized')) {
        return InboxErrorCategory.AUTH_ERROR;
    }
    if (
        message.includes('principal propagation') ||
        message.includes('user mapping') ||
        message.includes('no sap user')
    ) {
        return InboxErrorCategory.PROPAGATION_ERROR;
    }

    // Destination / connectivity errors
    if (
        message.includes('destination') ||
        message.includes('connectivity') ||
        message.includes('econnrefused') ||
        message.includes('enotfound')
    ) {
        return InboxErrorCategory.DESTINATION_ERROR;
    }

    // CSRF errors
    if (message.includes('csrf') || message.includes('x-csrf-token')) {
        return InboxErrorCategory.CSRF_ERROR;
    }

    // Not found
    if (status === 404 || message.includes('not found')) {
        return InboxErrorCategory.NOT_FOUND;
    }

    // Input validation
    if (
        message.includes('required') ||
        message.includes('invalid') ||
        message.includes('missing')
    ) {
        return InboxErrorCategory.INVALID_INPUT;
    }

    // SAP business errors (OData error body present)
    if (hasSapBusinessError(err)) {
        return InboxErrorCategory.SAP_BUSINESS_ERROR;
    }

    // SAP HTTP errors (status 4xx/5xx)
    if (status && status >= 400) {
        return InboxErrorCategory.SAP_HTTP_ERROR;
    }

    return InboxErrorCategory.UNEXPECTED_ERROR;
}

/**
 * Classify and wrap an error into a normalized InboxError.
 * The resulting error is safe to pass to callers and includes
 * enough context for structured logging.
 */
export function classifyAndWrapError(error: unknown, operation: string): InboxError {
    // If already an InboxError, re-throw as-is
    if (error instanceof InboxError) {
        return error;
    }

    const category = classifyError(error);
    const err = asErrorLike(error);
    const message = readString(err.message) || 'Unknown error';
    const status = extractHttpStatus(err);

    const inboxError = new InboxError(
        message,
        category,
        operation,
        status,
        error instanceof Error ? error : undefined,
    );

    // Log the normalized error for diagnostics
    console.error(
        JSON.stringify({
            event: 'task.error.normalized',
            operation,
            category,
            httpStatus: status,
            message: message.length > 200 ? `${message.slice(0, 200)}...` : message,
        })
    );

    return inboxError;
}

/**
 * Extract SAP OData error message from a response body.
 * Handles both `{ error: { message: { value: "..." } } }` and string variants.
 */
export function extractSapErrorMessage(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const d = data as { error?: { message?: { value?: string } | string } };
    const messageNode = d.error?.message;
    if (!messageNode) return undefined;
    if (typeof messageNode === 'string') return messageNode;
    return messageNode.value;
}

// ─── Internal Helpers ─────────────────────────────────────

function extractHttpStatus(err: Record<string, unknown>): number | undefined {
    const response = asRecord(err.response);
    if (typeof response.status === 'number') {
        return response.status;
    }

    const cause = asRecord(err.cause);
    const causeResponse = asRecord(cause.response);
    if (typeof causeResponse.status === 'number') {
        return causeResponse.status;
    }

    if (typeof err.status === 'number') return err.status;
    if (typeof err.statusCode === 'number') return err.statusCode;
    return undefined;
}

function hasSapBusinessError(err: Record<string, unknown>): boolean {
    const response = asRecord(err.response);
    const data = response.data;
    if (!data || typeof data !== 'object') return false;
    const d = data as { error?: { message?: unknown } };
    return !!d.error?.message;
}

function asErrorLike(error: unknown): Record<string, unknown> {
    if (!error || typeof error !== 'object') {
        return { message: String(error) };
    }
    return error as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
