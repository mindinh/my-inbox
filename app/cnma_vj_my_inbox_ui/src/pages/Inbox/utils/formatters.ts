/**
 * Centralized formatting utilities for the Inbox feature.
 *
 * Consolidates duplicated formatDate / parseDate / formatAmount / safe / etc.
 * functions that were previously scattered across TaskDetailPanels, TaskCard,
 * MassSelectionView, and TaskDetail components.
 */
import { format, formatDistanceToNow } from 'date-fns';

// ─── Date Helpers ──────────────────────────────────────────

/**
 * Parse a date string, handling SAP `/Date(…)/` format transparently.
 */
export function parseDate(value: string): Date {
    const sapMatch = value.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    if (sapMatch) {
        return new Date(Number(sapMatch[1]));
    }
    return new Date(value);
}

/**
 * Format a date string to `dd MMM yyyy, HH:mm`.
 * Returns `'-'` for falsy or unparseable values.
 */
export function formatDate(value?: string): string {
    if (!value) return '-';
    const date = parseDate(value);
    if (Number.isNaN(date.getTime())) return value;
    return format(date, 'dd MMM yyyy, HH:mm');
}

/**
 * Format a date string as a short date for list views (e.g. `09 Apr 2026`).
 */
export function formatShortDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/**
 * Format a date string as a human-readable relative string (e.g. "3 hours ago").
 * Returns `undefined` for falsy or unparseable values.
 */
export function formatRelative(value?: string): string | undefined {
    if (!value) return undefined;
    const date = parseDate(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return formatDistanceToNow(date, { addSuffix: true });
}

// ─── Number / Amount Helpers ───────────────────────────────

/**
 * Format a numeric string with locale-aware thousand separators and max-2 decimals.
 */
export function formatAmount(value: string): string {
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return num.toLocaleString('en-US', {
        maximumFractionDigits: 2,
    });
}

/**
 * Format an amount value with an optional trailing currency code.
 * Used primarily by PO/PR factsheet renderers.
 * Returns `'-'` for falsy or unparseable values.
 */
export function formatAmountWithCurrency(value?: string | number, currency?: string): string {
    if (value == null) return '-';
    const num = Number(value);
    if (Number.isNaN(num)) return currency ? `${value} ${currency}` : String(value);
    const formatted = num.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return currency ? `${formatted} ${currency}` : formatted;
}

/**
 * Format a date as a short locale string (e.g. `09/04/2026`).
 * Handles SAP `/Date(…)/` format. Returns `'-'` for missing values.
 */
export function formatDateShortLocale(value?: string): string {
    if (!value) return '-';
    const date = parseDate(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-GB');
}

/**
 * Return the value if non-empty, otherwise `'-'`.
 * Use wherever optional string values are rendered in UI.
 */
export function safe(value?: string): string {
    return value && String(value).trim() ? value : '-';
}

/**
 * Convert a camelCase or snake_case key into a human-readable label.
 * Example: `purchaseOrderNetAmount` → `Purchase order net amount`
 */
export function prettifyFieldLabel(key: string): string {
    const withSpaces = key
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim();
    if (!withSpaces) return key;
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
