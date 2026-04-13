/**
 * Business Object Registry
 * ─────────────────────────────────────────────────────────────
 * This is the SINGLE FILE admins edit to support new SAP business objects.
 *
 * To add a new object type (e.g. GR = Goods Receipt):
 *   1. Add an entry to BUSINESS_OBJECT_DEFINITIONS below
 *   2. Optionally create a sap-gr-factsheet-client.ts (copy PO client as template)
 *   3. Register a GoodsReceiptDataProvider in business-object-data-resolver.ts
 *   4. Add mock data in mock-sap-client.ts
 */

export interface BusinessObjectDefinition {
    /** Unique type key used across the system, e.g. 'PO', 'PR' */
    type: string;
    /** Human-readable display name */
    label: string;
    /** Custom attribute names (lowercase) that identify this object */
    attributeNames: string[];
    /** Custom attribute label substrings (lowercase) */
    attributeLabels: string[];
    /** Task object type substrings (lowercase) */
    objectTypePatterns: string[];
    /** ScenarioID substrings (uppercase) */
    scenarioPatterns: string[];
    /** TaskDefinitionID substrings (uppercase) */
    definitionPatterns: string[];
    /** Task title regex patterns */
    titlePatterns: RegExp[];
}

export const BUSINESS_OBJECT_DEFINITIONS: BusinessObjectDefinition[] = [
    {
        type: 'PR',
        label: 'Purchase Requisition',
        attributeNames: ['prnumber', 'purchaserequisition', 'pr_number', 'banfn', 'purchaserequisitionnumber', 'pr'],
        attributeLabels: ['purchase requisition', 'pr number', 'req. number', 'requisition'],
        objectTypePatterns: ['purchaserequisition'],
        scenarioPatterns: ['WS00800238', 'PR_APPROVAL', 'PURCHASE_REQ'],
        definitionPatterns: ['REQUISITION', 'PURCHASE_REQ', 'TS008002'],
        titlePatterns: [/purchase\s+requisition/i, /\bPR\s*[0-9]/i, /approve\s+pr\b/i, /release\s+pr\b/i],
    },
    {
        type: 'PO',
        label: 'Purchase Order',
        attributeNames: ['ponumber', 'purchaseorder', 'po_number', 'ebeln', 'purchaseordernumber', 'po'],
        attributeLabels: ['purchase order', 'po number', 'order number'],
        objectTypePatterns: ['purchaseorder'],
        scenarioPatterns: ['PO_APPROVAL', 'PURCHASE_ORD'],
        definitionPatterns: ['PURCHASE_ORD', 'PO_APPR'],
        titlePatterns: [/purchase\s+order/i, /\bPO\s*[0-9]/i, /approve\s+po\b/i, /release\s+po\b/i],
    },
    // ✨ ADD NEW OBJECTS BELOW — this is the only file you need to touch for detection
];
