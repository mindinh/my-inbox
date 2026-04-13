/**
 * Centralized constants for the Inbox feature.
 *
 * Replaces magic strings for decision keys, priority configs, and status configs
 * that were previously hardcoded across TaskCard, MassSelectionView, TaskList, etc.
 */

// ─── Decision Keys ─────────────────────────────────────────
// SAP TASKPROCESSING standard decision option keys
export const DECISION_KEYS = {
    APPROVE: '0001',
    REJECT: '0002',
} as const;

// ─── Priority Config ───────────────────────────────────────

export interface BadgeConfig {
    variant: string;
    label: string;
}

export const PRIORITY_CONFIG: Record<string, BadgeConfig> = {
    VERY_HIGH: { variant: 'destructive', label: 'Very High' },
    HIGH: { variant: 'warning', label: 'High' },
    MEDIUM: { variant: 'info', label: 'Medium' },
    LOW: { variant: 'success', label: 'Low' },
};

export const PRIORITY_FALLBACK: BadgeConfig = { variant: 'outline', label: '' };

// ─── Status Config ─────────────────────────────────────────

export const STATUS_CONFIG: Record<string, BadgeConfig> = {
    READY: { variant: 'info', label: 'Ready' },
    RESERVED: { variant: 'secondary', label: 'Reserved' },
    IN_PROGRESS: { variant: 'warning', label: 'In Progress' },
    COMPLETED: { variant: 'success', label: 'Completed' },
};

export const STATUS_FALLBACK: BadgeConfig = { variant: 'secondary', label: '' };

// ─── Attachment MIME Types ──────────────────────────────────

export const ALLOWED_ATTACHMENT_TYPES = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
] as const;

export const MAX_ATTACHMENT_SIZE_MB = 10;
export const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

// ─── Query Stale Times ─────────────────────────────────────

export const STALE = {
    LIST: 30_000,
    DETAIL: 15_000,
    INFORMATION: 20_000,
    WORKFLOW: 60_000,
} as const;

export const REFRESH = {
    LIST_MS: 180_000,
} as const;
