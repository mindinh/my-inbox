import { describe, it, expect } from 'vitest';
import { mergeAndDeduplicateComments } from '@/pages/Inbox/mappers/comments.mapper';
import type { TaskComment, WorkflowApprovalComment } from '@/services/inbox/inbox.types';

const makeTaskComment = (overrides: Partial<TaskComment> = {}): TaskComment => ({
    id: 'tc-1',
    text: 'Hello',
    createdBy: 'user1',
    createdByName: 'User One',
    createdAt: '2024-04-09T10:00:00Z',
    ...overrides,
});

const makeWorkflowComment = (overrides: Partial<WorkflowApprovalComment> = {}): WorkflowApprovalComment => ({
    docNum: '100',
    lineNo: 1,
    level: 1,
    noteText: 'Approved',
    userComment: 'manager1',
    postedOn: '2024-04-09',
    postedTime: '10:00:00',
    ...overrides,
});

describe('mergeAndDeduplicateComments', () => {
    it('returns empty array for empty inputs', () => {
        expect(mergeAndDeduplicateComments([], undefined)).toEqual([]);
        expect(mergeAndDeduplicateComments([], [])).toEqual([]);
    });

    it('returns task comments when no workflow comments', () => {
        const tc = makeTaskComment();
        const result = mergeAndDeduplicateComments([tc]);
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('Hello');
        expect(result[0].createdBy).toBe('User One');
    });

    it('returns workflow comments when no task comments', () => {
        const wc = makeWorkflowComment();
        const result = mergeAndDeduplicateComments([], [wc]);
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('Approved');
        expect(result[0].createdBy).toBe('manager1');
    });

    it('merges non-duplicate comments', () => {
        const tc = makeTaskComment({ text: 'Unique task comment' });
        const wc = makeWorkflowComment({ noteText: 'Unique workflow comment' });
        const result = mergeAndDeduplicateComments([tc], [wc]);
        expect(result).toHaveLength(2);
    });

    it('deduplicates comments with same text within 24h', () => {
        const wc = makeWorkflowComment({
            noteText: 'Same text',
            postedOn: '2024-04-09',
            postedTime: '10:00:00',
        });
        const tc = makeTaskComment({
            text: 'Same text',
            createdAt: '2024-04-09T12:00:00Z',
        });
        const result = mergeAndDeduplicateComments([tc], [wc]);
        expect(result).toHaveLength(1);
        expect(result[0].createdBy).toBe('manager1');
    });

    it('keeps comments with same text but >24h apart', () => {
        const wc = makeWorkflowComment({
            noteText: 'Same text',
            postedOn: '2024-04-07',
            postedTime: '10:00:00',
        });
        const tc = makeTaskComment({
            text: 'Same text',
            createdAt: '2024-04-09T12:00:00Z',
        });
        const result = mergeAndDeduplicateComments([tc], [wc]);
        expect(result).toHaveLength(2);
    });

    it('sorts chronologically', () => {
        const earlier = makeTaskComment({
            id: 'tc-early',
            text: 'First',
            createdAt: '2024-04-08T08:00:00Z',
        });
        const later = makeTaskComment({
            id: 'tc-late',
            text: 'Second',
            createdAt: '2024-04-10T15:00:00Z',
        });
        const result = mergeAndDeduplicateComments([later, earlier]);
        expect(result[0].text).toBe('First');
        expect(result[1].text).toBe('Second');
    });

    it('assigns deterministic IDs for workflow comments', () => {
        const wc = makeWorkflowComment({ docNum: '200' });
        const result = mergeAndDeduplicateComments([], [wc]);
        expect(result[0].id).toMatch(/^wc-200-/);
    });

    it('defaults createdBy to System for workflow comments without user', () => {
        const wc = makeWorkflowComment({ userComment: undefined });
        const result = mergeAndDeduplicateComments([], [wc as any]);
        expect(result[0].createdBy).toBe('System');
    });

    it('defaults createdBy to Unknown for task comments without user', () => {
        const tc = makeTaskComment({
            createdBy: undefined as any,
            createdByName: undefined as any,
        });
        const result = mergeAndDeduplicateComments([tc]);
        expect(result[0].createdBy).toBe('Unknown');
    });
});
