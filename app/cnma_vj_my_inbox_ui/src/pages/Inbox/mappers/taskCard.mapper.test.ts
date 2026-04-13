import { describe, it, expect } from 'vitest';
import { mapBusinessChips } from '@/pages/Inbox/mappers/taskCard.mapper';
import type { InboxTask } from '@/services/inbox/inbox.types';

const baseTask: InboxTask = {
    instanceId: 'inst-1',
    taskDefinitionId: 'def-1',
    taskTitle: 'Approve PO 4500001234',
    status: 'READY',
    priority: 'MEDIUM',
    createdOn: '2024-04-09T10:00:00Z',
    createdByName: 'Test User',
    sapOrigin: 'origin1',
    decisionOptions: [],
};

describe('mapBusinessChips', () => {
    it('returns empty array when no businessContext', () => {
        expect(mapBusinessChips(baseTask)).toEqual([]);
    });

    it('returns empty array for unknown context type', () => {
        const task = {
            ...baseTask,
            businessContext: { type: 'UNKNOWN' },
        };
        expect(mapBusinessChips(task as any)).toEqual([]);
    });

    it('extracts PO total with currency', () => {
        const task = {
            ...baseTask,
            businessContext: {
                type: 'PO',
                po: {
                    header: {
                        purchaseOrderNetAmount: '1234.56',
                        documentCurrency: 'USD',
                    },
                },
            },
        };
        const chips = mapBusinessChips(task as any);
        const total = chips.find((c) => c.label === 'Total');
        expect(total).toBeDefined();
        expect(total!.value).toContain('1,234.56');
        expect(total!.value).toContain('USD');
        expect(total!.isPrimary).toBe(true);
    });

    it('extracts PO type text', () => {
        const task = {
            ...baseTask,
            businessContext: {
                type: 'PO',
                po: { header: { purchaseOrderTypeText: 'Standard PO' } },
            },
        };
        const chips = mapBusinessChips(task as any);
        expect(chips.find((c) => c.label === 'Type')?.value).toBe('Standard PO');
    });

    it('extracts PO supplier name', () => {
        const task = {
            ...baseTask,
            businessContext: {
                type: 'PO',
                po: { header: { supplierName: 'ACME Corp' } },
            },
        };
        const chips = mapBusinessChips(task as any);
        expect(chips.find((c) => c.value === 'ACME Corp')).toBeDefined();
    });

    it('falls back to supplier ID when supplierName is missing', () => {
        const task = {
            ...baseTask,
            businessContext: {
                type: 'PO',
                po: { header: { supplier: 'VENDOR001' } },
            },
        };
        const chips = mapBusinessChips(task as any);
        expect(chips.find((c) => c.value === 'VENDOR001')).toBeDefined();
    });

    it('extracts PR total with currency', () => {
        const task = {
            ...baseTask,
            businessContext: {
                type: 'PR',
                pr: { header: { totalNetAmount: '9876.50', displayCurrency: 'EUR' } },
            },
        };
        const chips = mapBusinessChips(task as any);
        const total = chips.find((c) => c.label === 'Total');
        expect(total).toBeDefined();
        expect(total!.value).toContain('9,876.5');
        expect(total!.value).toContain('EUR');
        expect(total!.isPrimary).toBe(true);
    });

    it('extracts PR type', () => {
        const task = {
            ...baseTask,
            businessContext: {
                type: 'PR',
                pr: { header: { purchaseRequisitionType: 'NB' } },
            },
        };
        const chips = mapBusinessChips(task as any);
        expect(chips.find((c) => c.label === 'Type')?.value).toBe('NB');
    });

    it('always includes hardcoded dept for PR', () => {
        const task = {
            ...baseTask,
            businessContext: { type: 'PR', pr: { header: {} } },
        };
        const chips = mapBusinessChips(task as any);
        const dept = chips.find((c) => c.label === 'Dept');
        expect(dept).toBeDefined();
        expect(dept!.value).toBe('1001201000 - IT department');
    });

    it('returns empty list when PO context has no header', () => {
        const task = {
            ...baseTask,
            businessContext: { type: 'PO', po: {} },
        };
        expect(mapBusinessChips(task as any)).toEqual([]);
    });
});
