/**
 * Centralized predicate / classification utilities for the Inbox feature.
 *
 * Replaces duplicated approval-status helpers that were defined locally in
 * TaskDetailPanels.tsx and error-checking helpers in useInbox.ts.
 */

// ─── Approval Status ──────────────────────────────────────

/**
 * Normalize a raw approval status string to uppercase for comparison.
 */
export function normalizeApprovalStatus(value?: string): string {
    if (!value) return 'UNKNOWN';
    return value.trim().toUpperCase();
}

/**
 * Returns `true` if the approval status represents a "pending" state.
 */
export function isPendingApprovalStatus(value?: string): boolean {
    const status = normalizeApprovalStatus(value);
    return (
        status === 'PENDING' ||
        status === 'IN_PROCESS' ||
        status === 'CURRENT' ||
        status === 'OPEN'
    );
}

/**
 * Format a raw approval status string into a human-readable label.
 * Example: `'IN_PROCESS'` → `'In Process'`
 */
export function formatApprovalStatus(value?: string): string {
    const status = normalizeApprovalStatus(value);
    if (status === 'UNKNOWN') return 'Unknown';
    return status
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

// ─── Error Classification ──────────────────────────────────

/**
 * Detect the SAP user mapping error so we can disable polling / retry.
 */
export function isSapUserMappingMissing(error: any): boolean {
    return error?.response?.data?.code === 'SAP_USER_MAPPING_MISSING';
}

/**
 * Extract a usable error message from an Axios-style error object.
 */
export function extractErrorMessage(error: any, fallback: string): string {
    return error?.response?.data?.error || error?.message || fallback;
}
