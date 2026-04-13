/**
 * Dashboard Mock Data
 *
 * Simulates what the OData endpoint ZI_MY_TASK_DASHBOARD would return.
 * Each item represents a single task assigned to the current user.
 */

export interface DashboardTask {
    TaskId: string;
    DocumentNumber: string;
    TaskType: string;
    Status: 'NEW' | 'APPROVED' | 'REJECTED';
    TotalValue: number;
    Currency: string;
    CreatedOn: string;
    Title: string;
}

export const MOCK_DASHBOARD_TASKS: DashboardTask[] = [
    // ─── PR Expense Type ─────────────────────────────────
    { TaskId: 'T001', DocumentNumber: 'PR-100234', TaskType: 'PR Expense Type', Status: 'NEW', TotalValue: 25_000_000, Currency: 'VND', CreatedOn: '2026-04-08T08:30:00Z', Title: 'Approve PR 100234' },
    { TaskId: 'T002', DocumentNumber: 'PR-100235', TaskType: 'PR Expense Type', Status: 'NEW', TotalValue: 12_500_000, Currency: 'VND', CreatedOn: '2026-04-07T10:00:00Z', Title: 'Approve PR 100235' },
    { TaskId: 'T003', DocumentNumber: 'PR-100236', TaskType: 'PR Expense Type', Status: 'NEW', TotalValue: 8_700_000, Currency: 'VND', CreatedOn: '2026-04-06T14:20:00Z', Title: 'Approve PR 100236' },
    { TaskId: 'T004', DocumentNumber: 'PR-100237', TaskType: 'PR Expense Type', Status: 'APPROVED', TotalValue: 45_000_000, Currency: 'VND', CreatedOn: '2026-04-05T09:40:00Z', Title: 'Approve PR 100237' },
    { TaskId: 'T005', DocumentNumber: 'PR-100238', TaskType: 'PR Expense Type', Status: 'APPROVED', TotalValue: 32_100_000, Currency: 'VND', CreatedOn: '2026-04-04T07:15:00Z', Title: 'Approve PR 100238' },
    { TaskId: 'T006', DocumentNumber: 'PR-100239', TaskType: 'PR Expense Type', Status: 'NEW', TotalValue: 5_600_000, Currency: 'VND', CreatedOn: '2026-04-03T11:50:00Z', Title: 'Approve PR 100239' },
    { TaskId: 'T007', DocumentNumber: 'PR-100240', TaskType: 'PR Expense Type', Status: 'REJECTED', TotalValue: 18_900_000, Currency: 'VND', CreatedOn: '2026-04-02T16:30:00Z', Title: 'Approve PR 100240' },

    // ─── Purchase Order ──────────────────────────────────
    { TaskId: 'T010', DocumentNumber: 'PO-990021', TaskType: 'Purchase Order', Status: 'NEW', TotalValue: 120_000_000, Currency: 'VND', CreatedOn: '2026-04-09T08:00:00Z', Title: 'Approve PO 990021' },
    { TaskId: 'T011', DocumentNumber: 'PO-990022', TaskType: 'Purchase Order', Status: 'NEW', TotalValue: 85_300_000, Currency: 'VND', CreatedOn: '2026-04-08T13:20:00Z', Title: 'Approve PO 990022' },
    { TaskId: 'T012', DocumentNumber: 'PO-990023', TaskType: 'Purchase Order', Status: 'APPROVED', TotalValue: 200_000_000, Currency: 'VND', CreatedOn: '2026-04-07T09:45:00Z', Title: 'Approve PO 990023' },
    { TaskId: 'T013', DocumentNumber: 'PO-990024', TaskType: 'Purchase Order', Status: 'NEW', TotalValue: 67_400_000, Currency: 'VND', CreatedOn: '2026-04-06T10:10:00Z', Title: 'Approve PO 990024' },
    { TaskId: 'T014', DocumentNumber: 'PO-990025', TaskType: 'Purchase Order', Status: 'REJECTED', TotalValue: 155_600_000, Currency: 'VND', CreatedOn: '2026-04-05T14:00:00Z', Title: 'Approve PO 990025' },
    { TaskId: 'T015', DocumentNumber: 'PO-990026', TaskType: 'Purchase Order', Status: 'NEW', TotalValue: 42_000_000, Currency: 'VND', CreatedOn: '2026-04-04T08:20:00Z', Title: 'Approve PO 990026' },

    // ─── PR Asset ────────────────────────────────────────
    { TaskId: 'T020', DocumentNumber: 'PR-200100', TaskType: 'PR Asset', Status: 'NEW', TotalValue: 350_000_000, Currency: 'VND', CreatedOn: '2026-04-09T09:00:00Z', Title: 'Approve PR Asset 200100' },
    { TaskId: 'T021', DocumentNumber: 'PR-200101', TaskType: 'PR Asset', Status: 'REJECTED', TotalValue: 180_000_000, Currency: 'VND', CreatedOn: '2026-04-08T15:45:00Z', Title: 'Approve PR Asset 200101' },
    { TaskId: 'T022', DocumentNumber: 'PR-200102', TaskType: 'PR Asset', Status: 'APPROVED', TotalValue: 420_000_000, Currency: 'VND', CreatedOn: '2026-04-07T11:30:00Z', Title: 'Approve PR Asset 200102' },
    { TaskId: 'T023', DocumentNumber: 'PR-200103', TaskType: 'PR Asset', Status: 'NEW', TotalValue: 95_000_000, Currency: 'VND', CreatedOn: '2026-04-06T08:00:00Z', Title: 'Approve PR Asset 200103' },

    // ─── Service Entry Sheet ─────────────────────────────
    { TaskId: 'T030', DocumentNumber: 'SES-300010', TaskType: 'Service Entry Sheet', Status: 'NEW', TotalValue: 75_000_000, Currency: 'VND', CreatedOn: '2026-04-10T07:30:00Z', Title: 'Approve SES 300010' },
    { TaskId: 'T031', DocumentNumber: 'SES-300011', TaskType: 'Service Entry Sheet', Status: 'NEW', TotalValue: 62_800_000, Currency: 'VND', CreatedOn: '2026-04-09T14:15:00Z', Title: 'Approve SES 300011' },
    { TaskId: 'T032', DocumentNumber: 'SES-300012', TaskType: 'Service Entry Sheet', Status: 'APPROVED', TotalValue: 110_000_000, Currency: 'VND', CreatedOn: '2026-04-08T10:00:00Z', Title: 'Approve SES 300012' },
    { TaskId: 'T033', DocumentNumber: 'SES-300013', TaskType: 'Service Entry Sheet', Status: 'REJECTED', TotalValue: 48_500_000, Currency: 'VND', CreatedOn: '2026-04-07T13:00:00Z', Title: 'Approve SES 300013' },

    // ─── PR Stock ────────────────────────────────────────
    { TaskId: 'T040', DocumentNumber: 'PR-400050', TaskType: 'PR Stock', Status: 'NEW', TotalValue: 28_000_000, Currency: 'VND', CreatedOn: '2026-04-10T09:00:00Z', Title: 'Approve PR Stock 400050' },
    { TaskId: 'T041', DocumentNumber: 'PR-400051', TaskType: 'PR Stock', Status: 'APPROVED', TotalValue: 15_200_000, Currency: 'VND', CreatedOn: '2026-04-09T11:00:00Z', Title: 'Approve PR Stock 400051' },
    { TaskId: 'T042', DocumentNumber: 'PR-400052', TaskType: 'PR Stock', Status: 'REJECTED', TotalValue: 33_500_000, Currency: 'VND', CreatedOn: '2026-04-08T16:00:00Z', Title: 'Approve PR Stock 400052' },
];

export const STATUS_LABELS: Record<string, string> = {
    NEW: 'New',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
};

export const STATUS_COLORS: Record<string, string> = {
    NEW: '#0070f2',         // SAP Info Blue
    APPROVED: '#30914c',    // SAP Success Green
    REJECTED: '#bb0000',    // SAP Error Red
};
