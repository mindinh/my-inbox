import { DashboardTask } from '../../types';

/**
 * Mock dashboard data for local development.
 * Mirrors the shape returned by SAP's ZI_PR_DASH_BOARD entity.
 */
export const MOCK_DASHBOARD_TASKS: DashboardTask[] = [
    // ── PR Expense Type (ZEXP) ────────────────────────────
    { taskId: '198190', documentNumber: '0010001603', taskType: 'Purchase Requisition', documentType: 'ZEXP', documentTypeDesc: 'Expense PR', status: 'In Process', currency: 'EUR', totalNetAmount: 100, displayCurrency: 'EUR' },
    { taskId: '198192', documentNumber: '0010001602', taskType: 'Purchase Requisition', documentType: 'ZEXP', documentTypeDesc: 'Expense PR', status: 'Approved', currency: 'VND', totalNetAmount: 250000, displayCurrency: 'VND' },
    { taskId: '198233', documentNumber: '0010001601', taskType: 'Purchase Requisition', documentType: 'ZEXP', documentTypeDesc: 'Expense PR', status: 'Ready', currency: 'USD', totalNetAmount: 500, displayCurrency: 'USD' },
    { taskId: '198234', documentNumber: '0010001604', taskType: 'Purchase Requisition', documentType: 'ZEXP', documentTypeDesc: 'Expense PR', status: 'Ready', currency: 'EUR', totalNetAmount: 1200, displayCurrency: 'EUR' },
    { taskId: '198235', documentNumber: '0010001605', taskType: 'Purchase Requisition', documentType: 'ZEXP', documentTypeDesc: 'Expense PR', status: 'Ready', currency: 'USD', totalNetAmount: 75.50, displayCurrency: 'USD' },
    { taskId: '198236', documentNumber: '0010001606', taskType: 'Purchase Requisition', documentType: 'ZEXP', documentTypeDesc: 'Expense PR', status: 'In Process', currency: 'VND', totalNetAmount: 180000, displayCurrency: 'VND' },
    { taskId: '198237', documentNumber: '0010001607', taskType: 'Purchase Requisition', documentType: 'ZEXP', documentTypeDesc: 'Expense PR', status: 'Approved', currency: 'EUR', totalNetAmount: 3400, displayCurrency: 'EUR' },

    // ── Purchase Order ────────────────────────────────────
    { taskId: '198300', documentNumber: '4500012345', taskType: 'Purchase Order', documentType: 'NB', documentTypeDesc: 'Standard Purchase Order', status: 'Ready', currency: 'USD', totalNetAmount: 8500, displayCurrency: 'USD' },
    { taskId: '198301', documentNumber: '4500012346', taskType: 'Purchase Order', documentType: 'NB', documentTypeDesc: 'Standard Purchase Order', status: 'In Process', currency: 'EUR', totalNetAmount: 2200, displayCurrency: 'EUR' },
    { taskId: '198302', documentNumber: '4500012347', taskType: 'Purchase Order', documentType: 'NB', documentTypeDesc: 'Standard Purchase Order', status: 'Ready', currency: 'USD', totalNetAmount: 15000, displayCurrency: 'USD' },
    { taskId: '198303', documentNumber: '4500012348', taskType: 'Purchase Order', documentType: 'NB', documentTypeDesc: 'Standard Purchase Order', status: 'Approved', currency: 'VND', totalNetAmount: 500000, displayCurrency: 'VND' },
    { taskId: '198304', documentNumber: '4500012349', taskType: 'Purchase Order', documentType: 'NB', documentTypeDesc: 'Standard Purchase Order', status: 'Approved', currency: 'EUR', totalNetAmount: 6100, displayCurrency: 'EUR' },
    { taskId: '198305', documentNumber: '4500012350', taskType: 'Purchase Order', documentType: 'NB', documentTypeDesc: 'Standard Purchase Order', status: 'Ready', currency: 'USD', totalNetAmount: 950, displayCurrency: 'USD' },

    // ── PR Asset ──────────────────────────────────────────
    { taskId: '198400', documentNumber: '0010002001', taskType: 'Purchase Requisition', documentType: 'ZAST', documentTypeDesc: 'Asset PR', status: 'Ready', currency: 'USD', totalNetAmount: 45000, displayCurrency: 'USD' },
    { taskId: '198401', documentNumber: '0010002002', taskType: 'Purchase Requisition', documentType: 'ZAST', documentTypeDesc: 'Asset PR', status: 'In Process', currency: 'EUR', totalNetAmount: 12000, displayCurrency: 'EUR' },
    { taskId: '198402', documentNumber: '0010002003', taskType: 'Purchase Requisition', documentType: 'ZAST', documentTypeDesc: 'Asset PR', status: 'Approved', currency: 'VND', totalNetAmount: 780000, displayCurrency: 'VND' },
    { taskId: '198403', documentNumber: '0010002004', taskType: 'Purchase Requisition', documentType: 'ZAST', documentTypeDesc: 'Asset PR', status: 'Ready', currency: 'USD', totalNetAmount: 9800, displayCurrency: 'USD' },

    // ── Service Entry Sheet ───────────────────────────────
    { taskId: '198500', documentNumber: '0020003001', taskType: 'Service Entry Sheet', documentType: 'SES', documentTypeDesc: 'Service Entry Sheet', status: 'Ready', currency: 'EUR', totalNetAmount: 5500, displayCurrency: 'EUR' },
    { taskId: '198501', documentNumber: '0020003002', taskType: 'Service Entry Sheet', documentType: 'SES', documentTypeDesc: 'Service Entry Sheet', status: 'In Process', currency: 'USD', totalNetAmount: 3200, displayCurrency: 'USD' },
    { taskId: '198502', documentNumber: '0020003003', taskType: 'Service Entry Sheet', documentType: 'SES', documentTypeDesc: 'Service Entry Sheet', status: 'Approved', currency: 'VND', totalNetAmount: 420000, displayCurrency: 'VND' },

    // ── PR Stock ──────────────────────────────────────────
    { taskId: '198600', documentNumber: '0010003001', taskType: 'Purchase Requisition', documentType: 'NB', documentTypeDesc: 'Stock PR', status: 'In Process', currency: 'USD', totalNetAmount: 2800, displayCurrency: 'USD' },
    { taskId: '198601', documentNumber: '0010003002', taskType: 'Purchase Requisition', documentType: 'NB', documentTypeDesc: 'Stock PR', status: 'Approved', currency: 'EUR', totalNetAmount: 1650, displayCurrency: 'EUR' },
    { taskId: '198602', documentNumber: '0010003003', taskType: 'Purchase Requisition', documentType: 'NB', documentTypeDesc: 'Stock PR', status: 'Ready', currency: 'VND', totalNetAmount: 95000, displayCurrency: 'VND' },
];
