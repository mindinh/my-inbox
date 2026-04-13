/**
 * Task Transport Utilities — Phase 2 Shared Helpers
 *
 * Low-level helper functions shared across SAP task adapters.
 * These support adapters without replacing them.
 *
 * Rules:
 *   - Only extract helpers that are clearly shared
 *   - Helpers should support adapters, not replace adapters
 *   - Keep helper APIs simple and explicit
 */

/**
 * Context passed from business service to adapters.
 * Provides SAP user identity needed for all SAP calls.
 */
export interface AdapterContext {
    sapUser: string;
    userJwt?: string;
}

/**
 * Escape single quotes for OData string literals.
 * SAP OData requires doubling single quotes inside string parameters.
 */
export function escapeODataString(value: string): string {
    return value.replace(/'/g, "''");
}

/**
 * Extract SAP error message from OData error response body.
 * Handles both `{ error: { message: { value: "..." } } }` and string form.
 */
export function extractSapMessage(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const err = data as {
        error?: {
            message?: { value?: string } | string;
        };
    };
    const messageNode = err.error?.message;
    if (!messageNode) return undefined;
    if (typeof messageNode === 'string') return messageNode;
    return messageNode.value;
}

/**
 * Safely decode a URI component, returning original value on failure.
 */
export function decodeURIComponentSafe(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

/**
 * Deep-decode a URI component up to maxRounds to handle multi-encoded values.
 * SAP attachment IDs are sometimes double- or triple-encoded.
 */
export function decodeURIComponentSafeDeep(value: string, maxRounds = 3): string {
    let current = value;
    for (let i = 0; i < maxRounds; i += 1) {
        const next = decodeURIComponentSafe(current);
        if (next === current) return current;
        current = next;
    }
    return current;
}

// ─── Module-Aware Adapter Logging (Workstream K) ──────────

export interface AdapterLogEvent {
    event: string;
    module: string;
    operation: string;
    status: 'started' | 'success' | 'error';
    latencyMs?: number;
    errorCategory?: string;
}

/**
 * Emit a structured module-aware diagnostic log event.
 * Follows Phase 2 naming convention: `task.<module>.<operation>.<status>`
 *
 * Examples:
 *   - task.query.fetchTasks.started
 *   - task.detail.fetchTaskDetailBundle.finished → status: success
 *   - task.decision.execute.finished → status: error, errorCategory: SAP_HTTP_ERROR
 */
export function logAdapterEvent(entry: AdapterLogEvent): void {
    console.info(JSON.stringify(entry));
}

/**
 * Wrap an async adapter operation with structured start/finish logging.
 * Returns the operation result; re-throws errors after logging.
 */
export async function withAdapterLogging<T>(
    module: string,
    operation: string,
    fn: () => Promise<T>
): Promise<T> {
    const event = `task.${module}.${operation}`;
    logAdapterEvent({ event: `${event}.started`, module, operation, status: 'started' });

    const startedAt = Date.now();
    try {
        const result = await fn();
        logAdapterEvent({
            event: `${event}.finished`,
            module,
            operation,
            status: 'success',
            latencyMs: Date.now() - startedAt,
        });
        return result;
    } catch (error) {
        const errorCategory = (error as { category?: string })?.category || 'UNEXPECTED_ERROR';
        logAdapterEvent({
            event: `${event}.finished`,
            module,
            operation,
            status: 'error',
            latencyMs: Date.now() - startedAt,
            errorCategory,
        });
        throw error;
    }
}

