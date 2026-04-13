import { ISapTaskClient } from '../clients/sap-task-client';
import {
    SapTaskRaw,
    SapDecisionOptionRaw,
    SapDescriptionRaw,
    SapCustomAttributeRaw,
    SapCustomAttributeDefinitionRaw,
    SapTaskObjectRaw,
    SapCommentRaw,
    SapProcessingLogRaw,
    SapWorkflowLogRaw,
    SapAttachmentRaw,
} from '../../types';

/**
 * Mock SAP Client
 * Returns realistic SAP TASKPROCESSING data for local development.
 * Activated when SAP_TASK_BASE_URL is not set or USE_MOCK_SAP=true.
 */

// ─── Mock Data ────────────────────────────────────────────

const MOCK_TASKS: SapTaskRaw[] = [
    {
        InstanceID: 'TASK-001',
        TaskTitle: 'Approve Purchase Requisition PR1000123',
        Status: 'READY',
        Priority: 'HIGH',
        CreatedOn: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        CreatedByName: 'Minh Nguyen',
        ProcessorName: 'JDOE',
        ScenarioID: 'WS00800238',
        TaskDefinitionID: 'TS00800238',
        SupportsClaim: false,
        SupportsRelease: false,
        SupportsForward: true,
        SupportsComments: true,
    },
    {
        InstanceID: 'TASK-002',
        TaskTitle: 'Release Purchase Order PO4500012345',
        Status: 'READY',
        Priority: 'MEDIUM',
        CreatedOn: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        CreatedByName: 'Trang Le',
        ProcessorName: 'JDOE',
        ScenarioID: 'PO_APPROVAL_01',
        TaskDefinitionID: 'TS_PO_001',
        SupportsClaim: true,
        SupportsRelease: true,
        SupportsForward: true,
        SupportsComments: true,
    },
    {
        InstanceID: 'TASK-003',
        TaskTitle: 'Approve Purchase Requisition PR1000456',
        Status: 'RESERVED',
        Priority: 'VERY_HIGH',
        CreatedOn: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        CreatedByName: 'Huy Pham',
        ProcessorName: 'JDOE',
        ScenarioID: 'WS00800238',
        TaskDefinitionID: 'TS00800238',
        SupportsClaim: false,
        SupportsRelease: true,
        SupportsForward: true,
        SupportsComments: true,
    },
    {
        InstanceID: 'TASK-004',
        TaskTitle: 'Review Material Request MR-2026-0042',
        Status: 'READY',
        Priority: 'LOW',
        CreatedOn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        CreatedByName: 'Lan Vo',
        ProcessorName: 'JDOE',
        ScenarioID: 'MAT_REVIEW',
        TaskDefinitionID: 'TS_MAT_001',
        SupportsClaim: true,
        SupportsRelease: false,
        SupportsForward: false,
        SupportsComments: true,
    },
    // ─── Extra mock tasks for pagination testing ───────────
    ...Array.from({ length: 21 }, (_, i) => {
        const idx = i + 5;
        const isPR = idx % 3 !== 0;
        const priorities = ['HIGH', 'MEDIUM', 'LOW', 'VERY_HIGH'] as const;
        const statuses = ['READY', 'RESERVED', 'IN_PROGRESS'] as const;
        const names = ['An Tran', 'Bao Nguyen', 'Chi Le', 'Dung Pham', 'Em Vo', 'Gia Hoang', 'Hai Do'];
        return {
            InstanceID: `TASK-${String(idx).padStart(3, '0')}`,
            TaskTitle: isPR
                ? `Approve Purchase Requisition PR${1000100 + idx}`
                : `Release Purchase Order PO450001${2000 + idx}`,
            Status: statuses[idx % statuses.length],
            Priority: priorities[idx % priorities.length],
            CreatedOn: new Date(Date.now() - idx * 5 * 60 * 60 * 1000).toISOString(),
            CreatedByName: names[idx % names.length],
            ProcessorName: 'JDOE',
            ScenarioID: isPR ? 'WS00800238' : 'PO_APPROVAL_01',
            TaskDefinitionID: isPR ? 'TS00800238' : 'TS_PO_001',
            SupportsClaim: idx % 2 === 0,
            SupportsRelease: idx % 3 === 0,
            SupportsForward: true,
            SupportsComments: true,
        } as SapTaskRaw;
    }),
];

const MOCK_DECISIONS: Record<string, SapDecisionOptionRaw[]> = {
    'TASK-001': [
        { DecisionKey: '0001', DecisionText: 'Approve', Nature: 'POSITIVE' },
        { DecisionKey: '0002', DecisionText: 'Reject', Nature: 'NEGATIVE' },
    ],
    'TASK-002': [
        { DecisionKey: '0001', DecisionText: 'Release', Nature: 'POSITIVE' },
        { DecisionKey: '0002', DecisionText: 'Hold', Nature: 'NEUTRAL' },
        { DecisionKey: '0003', DecisionText: 'Reject', Nature: 'NEGATIVE' },
    ],
    'TASK-003': [
        { DecisionKey: '0001', DecisionText: 'Approve', Nature: 'POSITIVE' },
        { DecisionKey: '0002', DecisionText: 'Reject', Nature: 'NEGATIVE' },
        { DecisionKey: '0003', DecisionText: 'Request Info', Nature: 'NEUTRAL' },
    ],
    'TASK-004': [
        { DecisionKey: '0001', DecisionText: 'Approve', Nature: 'POSITIVE' },
        { DecisionKey: '0002', DecisionText: 'Return', Nature: 'NEGATIVE' },
    ],
};

const MOCK_DESCRIPTIONS: Record<string, SapDescriptionRaw> = {
    'TASK-001': {
        Description: 'Please approve the purchase requisition PR1000123 for office supplies. Total value: $2,450.00. Requested by Minh Nguyen, Department: Administration.',
        DescriptionAsHtml: '<p>Please approve the purchase requisition <strong>PR1000123</strong> for office supplies.</p><ul><li>Total value: <strong>$2,450.00</strong></li><li>Requested by: Minh Nguyen</li><li>Department: Administration</li></ul>',
    },
    'TASK-002': {
        Description: 'Release purchase order PO4500012345 for raw materials. Vendor: ACME Corp. Total: $15,800.00.',
        DescriptionAsHtml: '<p>Release purchase order <strong>PO4500012345</strong></p><table><tr><td>Vendor</td><td>ACME Corp</td></tr><tr><td>Total</td><td>$15,800.00</td></tr></table>',
    },
    'TASK-003': {
        Description: 'Urgent: Approve PR1000456 for IT equipment. Budget already allocated. Total: $8,200.00.',
    },
    'TASK-004': {
        Description: 'Review material request MR-2026-0042 for warehouse stock replenishment.',
    },
};

const MOCK_CUSTOM_ATTRIBUTES: Record<string, SapCustomAttributeRaw[]> = {
    'TASK-001': [
        { Name: 'PRNumber', Label: 'Purchase Requisition', Value: '1000123', Type: 'String' },
        { Name: 'TotalValue', Label: 'Total Value', Value: '2450.00', Type: 'Decimal' },
        { Name: 'Currency', Label: 'Currency', Value: 'USD', Type: 'String' },
        { Name: 'CompanyCode', Label: 'Company Code', Value: '1000', Type: 'String' },
    ],
    'TASK-002': [
        { Name: 'PONumber', Label: 'Purchase Order', Value: '4500012345', Type: 'String' },
        { Name: 'VendorName', Label: 'Vendor', Value: 'ACME Corp', Type: 'String' },
        { Name: 'TotalValue', Label: 'Total Value', Value: '15800.00', Type: 'Decimal' },
        { Name: 'Currency', Label: 'Currency', Value: 'USD', Type: 'String' },
    ],
    'TASK-003': [
        { Name: 'PRNumber', Label: 'Purchase Requisition', Value: '1000456', Type: 'String' },
        { Name: 'TotalValue', Label: 'Total Value', Value: '8200.00', Type: 'Decimal' },
        { Name: 'Currency', Label: 'Currency', Value: 'USD', Type: 'String' },
        { Name: 'Department', Label: 'Department', Value: 'IT', Type: 'String' },
    ],
    'TASK-004': [],
};

const MOCK_TASK_OBJECTS: Record<string, SapTaskObjectRaw[]> = {
    'TASK-001': [
        { ObjectID: 'OBJ-001', ObjectType: 'PurchaseRequisition', ObjectName: 'PR1000123' },
    ],
    'TASK-002': [
        { ObjectID: 'OBJ-002', ObjectType: 'PurchaseOrder', ObjectName: 'PO4500012345' },
    ],
    'TASK-003': [
        { ObjectID: 'OBJ-003', ObjectType: 'PurchaseRequisition', ObjectName: 'PR1000456' },
    ],
    'TASK-004': [],
};

const MOCK_CUSTOM_ATTRIBUTE_DEFINITIONS: Record<string, SapCustomAttributeDefinitionRaw[]> = {
    'TS00800238': [
        { TaskDefinitionID: 'TS00800238', Name: 'PRNumber', Label: 'Purchase Requisition', Type: 'String', Rank: 10 },
        { TaskDefinitionID: 'TS00800238', Name: 'TotalValue', Label: 'Total Value', Type: 'Decimal', Rank: 20 },
        { TaskDefinitionID: 'TS00800238', Name: 'Currency', Label: 'Currency', Type: 'String', Rank: 30 },
        { TaskDefinitionID: 'TS00800238', Name: 'CompanyCode', Label: 'Company Code', Type: 'String', Rank: 40 },
    ],
    'TS_PO_001': [
        { TaskDefinitionID: 'TS_PO_001', Name: 'PONumber', Label: 'Purchase Order', Type: 'String', Rank: 10 },
        { TaskDefinitionID: 'TS_PO_001', Name: 'VendorName', Label: 'Vendor', Type: 'String', Rank: 20 },
        { TaskDefinitionID: 'TS_PO_001', Name: 'TotalValue', Label: 'Total Value', Type: 'Decimal', Rank: 30 },
        { TaskDefinitionID: 'TS_PO_001', Name: 'Currency', Label: 'Currency', Type: 'String', Rank: 40 },
    ],
};

const MOCK_COMMENTS: Record<string, SapCommentRaw[]> = {
    'TASK-001': [
        {
            ID: 'CMT-001',
            CreatedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
            CreatedBy: 'MNGUYEN',
            CreatedByName: 'Minh Nguyen',
            Text: 'Budget confirmed. Please proceed with approval.',
        },
    ],
    'TASK-002': [
        {
            ID: 'CMT-002',
            CreatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            CreatedBy: 'TLE',
            CreatedByName: 'Trang Le',
            Text: 'Vendor shipment is time-critical.',
        },
    ],
};

const MOCK_PROCESSING_LOGS: Record<string, SapProcessingLogRaw[]> = {
    'TASK-001': [
        {
            OrderID: 1,
            Timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            ActionName: 'Task Created',
            PerformedBy: 'WF-BATCH',
            PerformedByName: 'Workflow Engine',
            TaskStatus: 'READY',
        },
    ],
    'TASK-002': [
        {
            OrderID: 1,
            Timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            ActionName: 'Task Created',
            PerformedBy: 'WF-BATCH',
            PerformedByName: 'Workflow Engine',
            TaskStatus: 'READY',
        },
        {
            OrderID: 2,
            Timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            ActionName: 'Reminder Sent',
            PerformedBy: 'WF-BATCH',
            PerformedByName: 'Workflow Engine',
            TaskStatus: 'READY',
        },
    ],
};

const MOCK_WORKFLOW_LOGS: Record<string, SapWorkflowLogRaw[]> = {
    'TASK-001': [
        {
            ID: 'WFL-001',
            Timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            ActionName: 'Workflow Step Started',
            UserName: 'Workflow Engine',
            Description: 'Approval step assigned to manager.',
        },
    ],
    'TASK-002': [
        {
            ID: 'WFL-002',
            Timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            ActionName: 'Workflow Step Started',
            UserName: 'Workflow Engine',
            Description: 'PO release task created.',
        },
    ],
};

const MOCK_ATTACHMENTS: Record<string, SapAttachmentRaw[]> = {
    'TASK-001': [
        {
            ID: 'ATT-001',
            FileName: 'PR1000123.pdf',
            FileDisplayName: 'Purchase Requisition PR1000123',
            mime_type: 'application/pdf',
            FileSize: 245760,
            CreatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            CreatedBy: 'MNGUYEN',
            CreatedByName: 'Minh Nguyen',
        },
    ],
    'TASK-002': [
        {
            ID: 'ATT-002',
            FileName: 'PO4500012345.xlsx',
            FileDisplayName: 'PO Item Breakdown',
            mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            FileSize: 108544,
            CreatedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
            CreatedBy: 'TLE',
            CreatedByName: 'Trang Le',
        },
    ],
};

// Track claimed/decided tasks for stateful mock behavior
const executedDecisions = new Set<string>();

// ─── Mock Client Implementation ───────────────────────────

export class MockSapTaskClient implements ISapTaskClient {
    private delay(): Promise<void> {
        // Simulate network latency (100-400ms)
        return new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 300));
    }

    async fetchTasks(_sapUser: string, _userJwt?: string, pagination?: { top?: number; skip?: number }): Promise<{ results: SapTaskRaw[]; totalCount: number }> {
        await this.delay();
        console.log('[MockSAP] fetchTasks');
        const all = MOCK_TASKS.filter((t) => !executedDecisions.has(t.InstanceID));
        const totalCount = all.length;
        const skip = pagination?.skip ?? 0;
        const top = pagination?.top ?? all.length;
        const results = all.slice(skip, skip + top);
        return { results, totalCount };
    }

    async fetchApprovedTasks(_sapUser: string, _userJwt?: string, pagination?: { top?: number; skip?: number }): Promise<{ results: SapTaskRaw[]; totalCount: number }> {
        await this.delay();
        console.log('[MockSAP] fetchApprovedTasks');
        const all = MOCK_TASKS.filter((t) => t.Status === 'COMPLETED' || executedDecisions.has(t.InstanceID));
        const totalCount = all.length;
        const skip = pagination?.skip ?? 0;
        const top = pagination?.top ?? all.length;
        const results = all.slice(skip, skip + top);
        return { results, totalCount };
    }

    async fetchTaskDetail(
        _sapUser: string,
        instanceId: string,
        _userJwt?: string
    ): Promise<SapTaskRaw> {
        await this.delay();
        console.log(`[MockSAP] fetchTaskDetail(${instanceId})`);
        const task = MOCK_TASKS.find((t) => t.InstanceID === instanceId);
        if (!task) throw new Error(`Task ${instanceId} not found`);
        return { ...task };
    }

    async fetchTaskDetailBundle(
        _sapUser: string,
        instanceId: string,
        _userJwt?: string,
        _hints?: { sapOrigin?: string }
    ): Promise<SapTaskRaw> {
        await this.delay();
        console.log(`[MockSAP] fetchTaskDetailBundle(${instanceId})`);
        const task = MOCK_TASKS.find((t) => t.InstanceID === instanceId);
        if (!task) throw new Error(`Task ${instanceId} not found`);
        const taskDefinitionData = task.TaskDefinitionID
            ? {
                TaskDefinitionID: task.TaskDefinitionID,
                TaskName: task.TaskDefinitionName,
                CustomAttributeDefinitionData: {
                    results: MOCK_CUSTOM_ATTRIBUTE_DEFINITIONS[task.TaskDefinitionID] || [],
                },
            }
            : undefined;
        return {
            ...task,
            Description: MOCK_DESCRIPTIONS[instanceId] || undefined,
            DecisionOptions: { results: MOCK_DECISIONS[instanceId] || [] },
            TaskDefinitionData: taskDefinitionData,
            CustomAttributeData: { results: MOCK_CUSTOM_ATTRIBUTES[instanceId] || [] },
            TaskObjects: { results: MOCK_TASK_OBJECTS[instanceId] || [] },
            Comments: { results: MOCK_COMMENTS[instanceId] || [] },
            ProcessingLogs: { results: MOCK_PROCESSING_LOGS[instanceId] || [] },
            WorkflowLogs: { results: MOCK_WORKFLOW_LOGS[instanceId] || [] },
            Attachments: { results: MOCK_ATTACHMENTS[instanceId] || [] },
        };
    }

    async fetchDecisionOptions(
        _sapUser: string,
        instanceId: string,
        _userJwt?: string
    ): Promise<SapDecisionOptionRaw[]> {
        await this.delay();
        console.log(`[MockSAP] fetchDecisionOptions(${instanceId})`);
        return MOCK_DECISIONS[instanceId] || [];
    }

    async fetchDescription(
        _sapUser: string,
        instanceId: string,
        _userJwt?: string
    ): Promise<SapDescriptionRaw | null> {
        await this.delay();
        console.log(`[MockSAP] fetchDescription(${instanceId})`);
        return MOCK_DESCRIPTIONS[instanceId] || null;
    }

    async fetchCustomAttributes(
        _sapUser: string,
        instanceId: string,
        _userJwt?: string
    ): Promise<SapCustomAttributeRaw[]> {
        await this.delay();
        console.log(`[MockSAP] fetchCustomAttributes(${instanceId})`);
        return MOCK_CUSTOM_ATTRIBUTES[instanceId] || [];
    }

    async fetchCustomAttributeDefinitions(
        _sapUser: string,
        taskDefinitionId: string,
        _userJwt?: string
    ): Promise<SapCustomAttributeDefinitionRaw[]> {
        await this.delay();
        console.log(`[MockSAP] fetchCustomAttributeDefinitions(${taskDefinitionId})`);
        return MOCK_CUSTOM_ATTRIBUTE_DEFINITIONS[taskDefinitionId] || [];
    }

    async fetchTaskObjects(
        _sapUser: string,
        instanceId: string,
        _userJwt?: string
    ): Promise<SapTaskObjectRaw[]> {
        await this.delay();
        console.log(`[MockSAP] fetchTaskObjects(${instanceId})`);
        return MOCK_TASK_OBJECTS[instanceId] || [];
    }

    async fetchComments(
        _sapUser: string,
        instanceId: string,
        _userJwt?: string
    ): Promise<SapCommentRaw[]> {
        await this.delay();
        console.log(`[MockSAP] fetchComments(${instanceId})`);
        return MOCK_COMMENTS[instanceId] || [];
    }

    async fetchProcessingLogs(
        _sapUser: string,
        instanceId: string,
        _userJwt?: string
    ): Promise<SapProcessingLogRaw[]> {
        await this.delay();
        console.log(`[MockSAP] fetchProcessingLogs(${instanceId})`);
        return MOCK_PROCESSING_LOGS[instanceId] || [];
    }

    async fetchWorkflowLogs(
        _sapUser: string,
        instanceId: string,
        _userJwt?: string
    ): Promise<SapWorkflowLogRaw[]> {
        await this.delay();
        console.log(`[MockSAP] fetchWorkflowLogs(${instanceId})`);
        return MOCK_WORKFLOW_LOGS[instanceId] || [];
    }

    async fetchAttachments(
        _sapUser: string,
        instanceId: string,
        _userJwt?: string
    ): Promise<SapAttachmentRaw[]> {
        await this.delay();
        console.log(`[MockSAP] fetchAttachments(${instanceId})`);
        return MOCK_ATTACHMENTS[instanceId] || [];
    }

    async executeDecision(
        _sapUser: string,
        instanceId: string,
        decisionKey: string,
        comment?: string,
        _userJwt?: string
    ): Promise<void> {
        await this.delay();
        console.log(`[MockSAP] executeDecision(${instanceId}, key=${decisionKey}, comment="${comment || ''}")`);
        executedDecisions.add(instanceId);
    }

    async forwardTask(
        _sapUser: string,
        instanceId: string,
        forwardTo: string,
        _userJwt?: string
    ): Promise<void> {
        await this.delay();
        console.log(`[MockSAP] forwardTask(${instanceId} → ${forwardTo})`);
        executedDecisions.add(instanceId); // Remove from list
    }

    async addComment(
        _sapUser: string,
        instanceId: string,
        text: string,
        _userJwt?: string
    ): Promise<SapCommentRaw> {
        await this.delay();
        const comment: SapCommentRaw = {
            ID: `CMT-mock-${Date.now()}`,
            InstanceID: instanceId,
            CreatedAt: new Date().toISOString(),
            CreatedBy: _sapUser || 'MOCKUSER',
            CreatedByName: 'Mock User',
            Text: text,
        };
        console.log(`[MockSAP] addComment(${instanceId}, "${text}")`);

        // Persist to in-memory mock data so re-fetching shows the new comment
        if (!MOCK_COMMENTS[instanceId]) {
            MOCK_COMMENTS[instanceId] = [];
        }
        MOCK_COMMENTS[instanceId].push(comment);

        return comment;
    }

    async addAttachment(
        _sapUser: string,
        instanceId: string,
        fileName: string,
        mimeType: string,
        buffer: Buffer,
        _userJwt?: string,
        _sapOrigin?: string
    ): Promise<SapAttachmentRaw> {
        await this.delay();
        const attachment: SapAttachmentRaw = {
            ID: `att-mock-${Date.now()}`,
            InstanceID: instanceId,
            FileName: fileName,
            FileDisplayName: fileName,
            mime_type: mimeType,
            FileSize: buffer.byteLength,
            CreatedAt: new Date().toISOString(),
            CreatedBy: _sapUser || 'MOCKUSER',
            CreatedByName: 'Mock User',
        };
        console.log(`[MockSAP] addAttachment(${instanceId}, "${fileName}", ${mimeType}, ${buffer.byteLength} bytes)`);

        if (!MOCK_ATTACHMENTS[instanceId]) {
            MOCK_ATTACHMENTS[instanceId] = [];
        }
        MOCK_ATTACHMENTS[instanceId].push(attachment);

        return attachment;
    }

    async fetchAttachmentContent(
        _sapUser: string,
        _instanceId: string,
        _attachmentId: string,
        _origin: string,
        _attachmentMetadataUri?: string,
        _userJwt?: string
    ): Promise<{ data: Buffer; contentType: string }> {
        await this.delay();
        console.log(`[MockSAP] fetchAttachmentContent(${_instanceId}, ${_attachmentId})`);
        // Return a small placeholder text for mock mode
        return {
            data: Buffer.from('Mock attachment content — replace with real binary in production.', 'utf-8'),
            contentType: 'text/plain',
        };
    }
}
