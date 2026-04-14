import type { FilterFieldConfig } from '@/components/filterbar/types';

/**
 * Inbox Task Filter Configuration
 *
 * Defines all available filter fields for the inbox task list.
 * Follows the SAP UI5 FilterBar pattern from ai-agent-extraction.
 */

export const INBOX_FILTER_CONFIG: FilterFieldConfig[] = [
    {
        key: 'search',
        label: 'Task Title',
        type: 'text',
        placeholder: 'Search by title...',
        visible: true,
    },
    {
        key: 'status',
        label: 'Status',
        type: 'multiselect',
        placeholder: 'All Status',
        visible: true,
        options: [
            { value: 'READY', label: 'In Approving' },
            { value: 'RESERVED', label: 'Reserved' },
            { value: 'REJECTED', label: 'Rejected' },
        ],
        showSelectAll: true,
    },
    {
        key: 'priority',
        label: 'Priority',
        type: 'multiselect',
        placeholder: 'All Priority',
        visible: true,
        options: [
            { value: 'VERY_HIGH', label: 'Very High' },
            { value: 'HIGH', label: 'High' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'LOW', label: 'Low' },
        ],
        showSelectAll: true,
    },
    {
        key: 'documentType',
        label: 'Document Type',
        type: 'select',
        placeholder: 'All Types',
        visible: true,
        options: [
            { value: 'PR', label: 'Purchase Requisition' },
            { value: 'PO', label: 'Purchase Order' },
        ],
    },
    {
        key: 'createdBy',
        label: 'Requestor',
        type: 'text',
        placeholder: 'Search by requestor...',
        visible: false,
    },
    {
        key: 'documentId',
        label: 'Document ID',
        type: 'text',
        placeholder: 'Search by doc ID...',
        visible: false,
    },
    {
        key: 'createdDate',
        label: 'Created Date',
        type: 'dateRange',
        visible: false,
    },
];
