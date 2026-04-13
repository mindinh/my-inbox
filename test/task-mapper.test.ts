/**
 * Task Mapper Tests — Phase 2 Workstream L
 *
 * Unit tests for the centralized SAP→domain mapping layer.
 * Tests are pure/deterministic — no SAP calls, no business logic.
 */
import { describe, it, expect } from 'vitest';
import {
    normalizeTask,
    normalizeTasks,
    normalizeDecisions,
    normalizeDescription,
    normalizeCustomAttributes,
    normalizeTaskObjects,
    normalizeComments,
    normalizeProcessingLogs,
    normalizeWorkflowLogs,
    normalizeAttachments,
} from '../srv/integrations/sap/task-mapper';

// ─── Fixtures ─────────────────────────────────────────────

const rawTaskMinimal = {
    InstanceID: 'TASK-001',
    SAP__Origin: 'LOCAL',
    TaskTitle: 'Approve PR 12345',
    Status: 'READY',
    Priority: '2',
    CreatedOn: '/Date(1696118400000)/',
};

const rawTaskFull = {
    ...rawTaskMinimal,
    CreatedByName: 'John Doe',
    ProcessorName: 'Jane Smith',
    ScenarioID: 'SC001',
    TaskDefinitionID: 'TS001',
    TaskDefinitionName: 'Purchase Requisition Approval',
    StartDeadLine: '2024-01-15T00:00:00Z',
    CompletionDeadLine: undefined,
    ExpiryDate: undefined,
    CompletedOn: undefined,
    ForwardedOn: undefined,
    IsEscalated: true,
    HasComments: true,
    HasAttachments: false,
    GUI_Link: 'https://sap.example.com/task/001',
    SupportsClaim: true,
    SupportsRelease: false,
    SupportsForward: true,
    SupportsComments: true,
};

// ─── Task Normalization ───────────────────────────────────

describe('normalizeTask', () => {
    it('normalizes a minimal raw SAP task', () => {
        const task = normalizeTask(rawTaskMinimal as any);
        expect(task.instanceId).toBe('TASK-001');
        expect(task.sapOrigin).toBe('LOCAL');
        expect(task.title).toBe('Approve PR 12345');
        expect(task.status).toBe('READY');
        expect(task.priority).toBe('HIGH'); // Priority '2' → HIGH
    });

    it('converts /Date(ms)/ format to ISO string', () => {
        const task = normalizeTask(rawTaskMinimal as any);
        expect(task.createdOn).toBe(new Date(1696118400000).toISOString());
    });

    it('normalizes full task with all fields', () => {
        const task = normalizeTask(rawTaskFull as any);
        expect(task.createdByName).toBe('John Doe');
        expect(task.processorName).toBe('Jane Smith');
        expect(task.isEscalated).toBe(true);
        expect(task.hasComments).toBe(true);
        expect(task.hasAttachments).toBe(false);
        expect(task.guiLink).toBe('https://sap.example.com/task/001');
        expect(task.supports.claim).toBe(true);
        expect(task.supports.release).toBe(false);
        expect(task.supports.forward).toBe(true);
    });

    it('handles missing/undefined optional fields gracefully', () => {
        const task = normalizeTask({ InstanceID: 'X', Status: '', Priority: '' } as any);
        expect(task.title).toBe('');
        expect(task.status).toBe('UNKNOWN');
        expect(task.priority).toBe('MEDIUM'); // fallback
        expect(task.createdByName).toBeUndefined();
    });
});

describe('normalizeTasks', () => {
    it('normalizes an array of raw tasks', () => {
        const tasks = normalizeTasks([rawTaskMinimal as any, rawTaskFull as any]);
        expect(tasks).toHaveLength(2);
        expect(tasks[0].instanceId).toBe('TASK-001');
        expect(tasks[1].createdByName).toBe('John Doe');
    });

    it('returns empty array for empty input', () => {
        expect(normalizeTasks([])).toEqual([]);
    });
});

// ─── Decision Options ─────────────────────────────────────

describe('normalizeDecisions', () => {
    it('normalizes decision options', () => {
        const decisions = normalizeDecisions([
            { DecisionKey: '0001', DecisionText: 'Approve', Nature: 'POSITIVE', CommentMandatory: false },
            { DecisionKey: '0002', DecisionText: 'Reject', Nature: 'NEGATIVE', CommentMandatory: true },
        ] as any);
        expect(decisions).toHaveLength(2);
        expect(decisions[0]).toEqual({
            key: '0001',
            text: 'Approve',
            nature: 'POSITIVE',
            commentMandatory: false,
            commentSupported: true,
        });
        expect(decisions[1].nature).toBe('NEGATIVE');
        expect(decisions[1].commentMandatory).toBe(true);
    });

    it('falls back to DecisionKey when DecisionText is missing', () => {
        const decisions = normalizeDecisions([{ DecisionKey: '0003' }] as any);
        expect(decisions[0].text).toBe('0003');
    });

    it('defaults Nature to NEUTRAL when not provided', () => {
        const decisions = normalizeDecisions([{ DecisionKey: '0004' }] as any);
        expect(decisions[0].nature).toBe('NEUTRAL');
    });
});

// ─── Description ──────────────────────────────────────────

describe('normalizeDescription', () => {
    it('returns undefined for null input', () => {
        expect(normalizeDescription(null)).toBeUndefined();
    });

    it('prefers HTML description over text', () => {
        const desc = normalizeDescription({
            DescriptionAsHtml: '<p>Hello</p>',
            Description: 'Hello',
        } as any);
        expect(desc).toEqual({ type: 'html', value: '<p>Hello</p>' });
    });

    it('falls back to text description', () => {
        const desc = normalizeDescription({ Description: 'Hello text' } as any);
        expect(desc).toEqual({ type: 'text', value: 'Hello text' });
    });

    it('returns undefined when both are empty', () => {
        expect(normalizeDescription({} as any)).toBeUndefined();
    });
});

// ─── Custom Attributes ────────────────────────────────────

describe('normalizeCustomAttributes', () => {
    it('normalizes attributes with definitions for label enrichment', () => {
        const attrs = normalizeCustomAttributes(
            [
                { Name: 'CompanyCode', Value: '1000', Label: '' } as any,
                { Name: 'Amount', Value: '5000', Label: '' } as any,
            ],
            [
                { Name: 'CompanyCode', Label: 'Company Code', Rank: 2 } as any,
                { Name: 'Amount', Label: 'Total Amount', Rank: 1 } as any,
            ]
        );
        expect(attrs).toHaveLength(2);
        // Sorted by rank: Amount (1) before CompanyCode (2)
        expect(attrs[0].label).toBe('Total Amount');
        expect(attrs[0].value).toBe('5000');
        expect(attrs[1].label).toBe('Company Code');
    });

    it('falls back to attribute Name when no definition exists', () => {
        const attrs = normalizeCustomAttributes(
            [{ Name: 'CustomField', Value: 'val' } as any],
            []
        );
        expect(attrs[0].label).toBe('CustomField');
    });
});

// ─── Task Objects ─────────────────────────────────────────

describe('normalizeTaskObjects', () => {
    it('maps raw task objects', () => {
        const objects = normalizeTaskObjects([
            { ObjectID: 'OBJ-1', ObjectType: 'BUS2121', ObjectName: 'PR 10001' } as any,
        ]);
        expect(objects[0]).toEqual({
            objectId: 'OBJ-1',
            type: 'BUS2121',
            name: 'PR 10001',
            url: undefined,
            mimeType: undefined,
        });
    });

    it('defaults ObjectType to UNKNOWN', () => {
        const objects = normalizeTaskObjects([{ ObjectID: 'OBJ-2' } as any]);
        expect(objects[0].type).toBe('UNKNOWN');
    });
});

// ─── Comments ─────────────────────────────────────────────

describe('normalizeComments', () => {
    it('maps and filters raw comments', () => {
        const comments = normalizeComments([
            { ID: 'C1', CreatedAt: '2024-01-15T10:00:00Z', CreatedByName: 'User A', Text: 'Looks good' } as any,
            { ID: '', Text: '' } as any, // should be filtered
        ]);
        expect(comments).toHaveLength(1);
        expect(comments[0].text).toBe('Looks good');
    });
});

// ─── Attachments ──────────────────────────────────────────

describe('normalizeAttachments', () => {
    it('maps and cleans duplicate extensions', () => {
        const attachments = normalizeAttachments([
            {
                ID: 'A1',
                FileName: 'report.xlsx.xlsx',
                FileDisplayName: 'Report',
                mime_type: 'application/octet-stream',
            } as any,
        ]);
        expect(attachments[0].fileName).toBe('report.xlsx'); // cleaned
        expect(attachments[0].mimeType).toBe(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ); // inferred
    });

    it('preserves correct MIME types', () => {
        const attachments = normalizeAttachments([
            { ID: 'A2', FileName: 'doc.pdf', mime_type: 'application/pdf' } as any,
        ]);
        expect(attachments[0].mimeType).toBe('application/pdf');
    });
});
