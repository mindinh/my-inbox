/**
 * Task Error Mapper Tests — Phase 2 Workstream L
 *
 * Unit tests for error classification and wrapping logic.
 * Ensures consistent error categorization across all failure scenarios.
 */
import { describe, it, expect } from 'vitest';
import { classifyError, classifyAndWrapError, extractSapErrorMessage } from '../srv/integrations/sap/task-error-mapper';
import { InboxErrorCategory, InboxError } from '../srv/domain/inbox/inbox-error.types';

// ─── classifyError ────────────────────────────────────────

describe('classifyError', () => {
    it('classifies 401 as AUTH_ERROR', () => {
        const err = { message: 'Request failed', response: { status: 401 } };
        expect(classifyError(err)).toBe(InboxErrorCategory.AUTH_ERROR);
    });

    it('classifies "unauthorized" message as AUTH_ERROR', () => {
        const err = new Error('Unauthorized access');
        expect(classifyError(err)).toBe(InboxErrorCategory.AUTH_ERROR);
    });

    it('classifies principal propagation failure', () => {
        const err = new Error('Principal propagation failed for user');
        expect(classifyError(err)).toBe(InboxErrorCategory.PROPAGATION_ERROR);
    });

    it('classifies "no sap user" as PROPAGATION_ERROR', () => {
        const err = new Error('No SAP user could be derived');
        expect(classifyError(err)).toBe(InboxErrorCategory.PROPAGATION_ERROR);
    });

    it('classifies destination errors', () => {
        const err = new Error('Destination "SAP_TASK" not found');
        expect(classifyError(err)).toBe(InboxErrorCategory.DESTINATION_ERROR);
    });

    it('classifies ECONNREFUSED as DESTINATION_ERROR', () => {
        const err = new Error('connect ECONNREFUSED 127.0.0.1:443');
        expect(classifyError(err)).toBe(InboxErrorCategory.DESTINATION_ERROR);
    });

    it('classifies CSRF errors', () => {
        const err = new Error('CSRF token validation failed');
        expect(classifyError(err)).toBe(InboxErrorCategory.CSRF_ERROR);
    });

    it('classifies 404 as NOT_FOUND', () => {
        const err = { message: 'Task', response: { status: 404 } };
        expect(classifyError(err)).toBe(InboxErrorCategory.NOT_FOUND);
    });

    it('classifies "not found" in message as NOT_FOUND', () => {
        const err = new Error('Task instance not found');
        expect(classifyError(err)).toBe(InboxErrorCategory.NOT_FOUND);
    });

    it('classifies "required" as INVALID_INPUT', () => {
        const err = new Error('Decision key is required');
        expect(classifyError(err)).toBe(InboxErrorCategory.INVALID_INPUT);
    });

    it('classifies SAP business errors', () => {
        const err = {
            message: 'SAP call failed',
            response: {
                status: 400,
                data: { error: { message: { value: 'Item already approved' } } },
            },
        };
        expect(classifyError(err)).toBe(InboxErrorCategory.SAP_BUSINESS_ERROR);
    });

    it('classifies generic 500 as SAP_HTTP_ERROR', () => {
        const err = { message: 'Server error', response: { status: 500 } };
        expect(classifyError(err)).toBe(InboxErrorCategory.SAP_HTTP_ERROR);
    });

    it('classifies unknown errors as UNEXPECTED_ERROR', () => {
        const err = new Error('Something went wrong');
        expect(classifyError(err)).toBe(InboxErrorCategory.UNEXPECTED_ERROR);
    });

    it('handles non-Error inputs (strings)', () => {
        expect(classifyError('random string')).toBe(InboxErrorCategory.UNEXPECTED_ERROR);
    });

    it('handles null/undefined', () => {
        expect(classifyError(null)).toBe(InboxErrorCategory.UNEXPECTED_ERROR);
        expect(classifyError(undefined)).toBe(InboxErrorCategory.UNEXPECTED_ERROR);
    });
});

// ─── classifyAndWrapError ─────────────────────────────────

describe('classifyAndWrapError', () => {
    it('wraps a raw error into InboxError with correct category', () => {
        const raw = { message: 'Unauthorized', response: { status: 401 } };
        const result = classifyAndWrapError(raw, 'task.query.fetchTasks');
        expect(result).toBeInstanceOf(InboxError);
        expect(result.category).toBe(InboxErrorCategory.AUTH_ERROR);
        expect(result.operation).toBe('task.query.fetchTasks');
    });

    it('returns existing InboxError as-is', () => {
        const existing = new InboxError(
            'Already wrapped',
            InboxErrorCategory.CSRF_ERROR,
            'task.decision.execute'
        );
        const result = classifyAndWrapError(existing, 'task.decision.execute');
        expect(result).toBe(existing); // Same reference
    });

    it('InboxError statusCode matches category', () => {
        const result = classifyAndWrapError(new Error('Not found'), 'task.detail.fetch');
        expect(result.statusCode).toBe(404);
    });
});

// ─── extractSapErrorMessage ───────────────────────────────

describe('extractSapErrorMessage', () => {
    it('extracts nested value from OData error response', () => {
        const data = { error: { message: { value: 'Task locked by another user' } } };
        expect(extractSapErrorMessage(data)).toBe('Task locked by another user');
    });

    it('extracts string message variant', () => {
        const data = { error: { message: 'Simple error' } };
        expect(extractSapErrorMessage(data)).toBe('Simple error');
    });

    it('returns undefined for non-error data', () => {
        expect(extractSapErrorMessage(null)).toBeUndefined();
        expect(extractSapErrorMessage({})).toBeUndefined();
        expect(extractSapErrorMessage({ error: {} })).toBeUndefined();
    });
});
