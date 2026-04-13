import { describe, it, expect } from 'vitest';
import {
    parseDate,
    formatDate,
    formatShortDate,
    formatAmount,
    formatAmountWithCurrency,
    safe,
    prettifyFieldLabel,
    formatDateShortLocale,
} from '@/pages/Inbox/utils/formatters';

describe('parseDate', () => {
    it('parses SAP /Date()/ format', () => {
        const d = parseDate('/Date(1712678400000)/');
        expect(d.getTime()).toBe(1712678400000);
    });

    it('parses SAP /Date()/ with timezone offset', () => {
        const d = parseDate('/Date(1712678400000+0000)/');
        expect(d.getTime()).toBe(1712678400000);
    });

    it('parses ISO 8601 strings', () => {
        const d = parseDate('2024-04-09T12:00:00Z');
        expect(d.toISOString()).toBe('2024-04-09T12:00:00.000Z');
    });

    it('returns Invalid Date for unparseable strings', () => {
        const d = parseDate('not-a-date');
        expect(Number.isNaN(d.getTime())).toBe(true);
    });
});

describe('formatDate', () => {
    it('returns - for undefined', () => {
        expect(formatDate(undefined)).toBe('-');
    });

    it('returns - for empty string', () => {
        expect(formatDate('')).toBe('-');
    });

    it('returns the raw value for unparseable dates', () => {
        expect(formatDate('garbage')).toBe('garbage');
    });

    it('formats a valid ISO date', () => {
        const result = formatDate('2024-01-15T10:30:00Z');
        // Should contain day, month abbreviation
        expect(result).toMatch(/15 Jan 2024/);
    });
});

describe('formatShortDate', () => {
    it('returns - for undefined', () => {
        expect(formatShortDate(undefined)).toBe('-');
    });

    it('formats short date correctly', () => {
        const result = formatShortDate('2024-04-09T00:00:00Z');
        expect(result).toMatch(/09 Apr 2024/);
    });
});

describe('formatAmount', () => {
    it('formats a number with thousand separators', () => {
        expect(formatAmount('1234567.89')).toBe('1,234,567.89');
    });

    it('truncates to 2 decimal places', () => {
        expect(formatAmount('123.456')).toBe('123.46');
    });

    it('returns the raw value for non-numeric input', () => {
        expect(formatAmount('abc')).toBe('abc');
    });

    it('handles zero', () => {
        expect(formatAmount('0')).toBe('0');
    });
});

describe('formatAmountWithCurrency', () => {
    it('returns - for null/undefined', () => {
        expect(formatAmountWithCurrency(null as any)).toBe('-');
        expect(formatAmountWithCurrency(undefined)).toBe('-');
    });

    it('appends currency code', () => {
        expect(formatAmountWithCurrency('1000', 'USD')).toBe('1,000 USD');
    });

    it('works without currency', () => {
        expect(formatAmountWithCurrency(500)).toBe('500');
    });

    it('handles non-numeric string with currency', () => {
        expect(formatAmountWithCurrency('abc', 'EUR')).toBe('abc EUR');
    });
});

describe('formatDateShortLocale', () => {
    it('returns - for falsy', () => {
        expect(formatDateShortLocale(undefined)).toBe('-');
        expect(formatDateShortLocale('')).toBe('-');
    });

    it('handles SAP date format via parseDate', () => {
        const result = formatDateShortLocale('/Date(1712678400000)/');
        // Should be a locale date string
        expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
});

describe('safe', () => {
    it('returns - for undefined', () => {
        expect(safe(undefined)).toBe('-');
    });

    it('returns - for empty string', () => {
        expect(safe('')).toBe('-');
    });

    it('returns - for whitespace-only string', () => {
        expect(safe('   ')).toBe('-');
    });

    it('returns the value for non-empty string', () => {
        expect(safe('hello')).toBe('hello');
    });
});

describe('prettifyFieldLabel', () => {
    it('converts camelCase to sentence', () => {
        expect(prettifyFieldLabel('purchaseOrderNetAmount')).toBe('Purchase Order Net Amount');
    });

    it('converts snake_case to sentence', () => {
        expect(prettifyFieldLabel('created_on')).toBe('Created on');
    });

    it('handles kebab-case', () => {
        expect(prettifyFieldLabel('document-type')).toBe('Document type');
    });

    it('returns key for empty result', () => {
        expect(prettifyFieldLabel('')).toBe('');
    });
});
