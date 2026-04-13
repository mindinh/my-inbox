/**
 * Transport Utils Tests — Phase 2 Workstream L
 *
 * Unit tests for shared transport utilities used across adapters.
 */
import { describe, it, expect } from 'vitest';
import {
    escapeODataString,
    extractSapMessage,
    decodeURIComponentSafe,
    decodeURIComponentSafeDeep,
} from '../srv/integrations/sap/task-transport-utils';

describe('escapeODataString', () => {
    it('doubles single quotes for OData safety', () => {
        expect(escapeODataString("O'Brien")).toBe("O''Brien");
    });

    it('handles multiple single quotes', () => {
        expect(escapeODataString("it's a 'test'")).toBe("it''s a ''test''");
    });

    it('returns unchanged string without quotes', () => {
        expect(escapeODataString('hello world')).toBe('hello world');
    });
});

describe('extractSapMessage', () => {
    it('extracts nested OData error value', () => {
        const data = { error: { message: { value: 'Task expired' } } };
        expect(extractSapMessage(data)).toBe('Task expired');
    });

    it('extracts string message variant', () => {
        const data = { error: { message: 'Simple error' } };
        expect(extractSapMessage(data)).toBe('Simple error');
    });

    it('returns undefined for non-object', () => {
        expect(extractSapMessage(null)).toBeUndefined();
        expect(extractSapMessage('string')).toBeUndefined();
    });

    it('returns undefined when no error node', () => {
        expect(extractSapMessage({ data: 'ok' })).toBeUndefined();
    });
});

describe('decodeURIComponentSafe', () => {
    it('decodes valid encoded strings', () => {
        expect(decodeURIComponentSafe('%20')).toBe(' ');
    });

    it('returns original on invalid encoding', () => {
        expect(decodeURIComponentSafe('%ZZ')).toBe('%ZZ');
    });
});

describe('decodeURIComponentSafeDeep', () => {
    it('handles double-encoded values', () => {
        const doubleEncoded = encodeURIComponent(encodeURIComponent('hello world'));
        expect(decodeURIComponentSafeDeep(doubleEncoded)).toBe('hello world');
    });

    it('returns original for non-encoded string', () => {
        expect(decodeURIComponentSafeDeep('plain')).toBe('plain');
    });

    it('stops after maxRounds', () => {
        // Triple-encode but only allow 2 rounds
        const tripled = encodeURIComponent(encodeURIComponent(encodeURIComponent('x')));
        const result = decodeURIComponentSafeDeep(tripled, 2);
        // After 2 rounds we should still have one layer of encoding
        expect(result).toBe(encodeURIComponent('x'));
    });
});
