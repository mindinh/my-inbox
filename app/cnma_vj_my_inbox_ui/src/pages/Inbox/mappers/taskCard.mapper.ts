/**
 * Task Card Mapper — transforms raw InboxTask data into display-ready models.
 *
 * Extracts the useBusinessChips logic from TaskCard.tsx so that the component
 * receives pre-computed display data instead of applying business rules inline.
 */
import type {
    InboxTask,
    PurchaseOrderFactsheetData,
    PurchaseRequisitionFactsheetData,
} from '@/services/inbox/inbox.types';
import { formatAmount } from '@/pages/Inbox/utils/formatters';

// ─── Types ─────────────────────────────────────────────────

/**
 * A single info chip to display on a task card.
 */
export interface BusinessChip {
    label?: string;
    value: string;
    isPrimary?: boolean;
}

// ─── Mapper ────────────────────────────────────────────────

/**
 * Extract key business details per document type from the task's
 * businessContext (enriched by the backend at list level).
 *
 * Pure function — no hooks, no side effects.
 */
export function mapBusinessChips(task: InboxTask): BusinessChip[] {
    const ctx = task.businessContext;
    if (!ctx) return [];

    const chips: BusinessChip[] = [];

    if (ctx.type === 'PO' && ctx.po) {
        const po = ctx.po as PurchaseOrderFactsheetData;
        const hdr = po.header;
        if (hdr) {
            if (hdr.purchaseOrderNetAmount) {
                const cur = hdr.documentCurrency || '';
                chips.push({
                    label: 'Total',
                    value: `${formatAmount(hdr.purchaseOrderNetAmount)} ${cur}`.trim(),
                    isPrimary: true,
                });
            }
            if (hdr.purchaseOrderTypeText) {
                chips.push({ label: 'Type', value: hdr.purchaseOrderTypeText });
            }
            if (hdr.supplierName || hdr.supplier) {
                chips.push({ value: (hdr.supplierName || hdr.supplier)! });
            }
            if (hdr.purchasingGroupName || hdr.companyCodeName) {
                chips.push({ label: 'Dept', value: (hdr.purchasingGroupName || hdr.companyCodeName)! });
            }
        }
    } else if (ctx.type === 'PR' && ctx.pr) {
        const pr = ctx.pr as PurchaseRequisitionFactsheetData;
        const hdr = pr.header;
        if (hdr) {
            const totalValue = hdr.totalNetAmount;
            const totalCurrency = hdr.displayCurrency || '';
            if (totalValue) {
                chips.push({
                    label: 'Total',
                    value: `${formatAmount(totalValue)} ${totalCurrency}`.trim(),
                    isPrimary: true,
                });
            }
            if (hdr.purchaseRequisitionType) {
                chips.push({ label: 'Type', value: hdr.purchaseRequisitionType });
            }
            // Department: hardcoded per business requirement
            chips.push({ label: 'Dept', value: '1001201000 - IT department' });
        }
    }

    return chips;
}
