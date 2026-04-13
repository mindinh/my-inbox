import { Badge } from '@/components/ui/badge';
import { PRIORITY_CONFIG, PRIORITY_FALLBACK, STATUS_CONFIG, STATUS_FALLBACK } from '@/pages/Inbox/utils/constants';

export function PriorityBadge({ priority }: { priority?: string }) {
    if (!priority) return null;

    // Normalize input to handle different cases
    const normalizedPriority = priority.toUpperCase().replace(/\s+/g, '_');

    const { variant, label } = PRIORITY_CONFIG[normalizedPriority] || {
        ...PRIORITY_FALLBACK,
        label: priority,
    };

    return (
        <Badge variant={variant as any} className="px-2 py-0.5 text-[11px] font-semibold">
            {label}
        </Badge>
    );
}

export function StatusBadge({ status }: { status?: string }) {
    if (!status) return null;

    // Try normal config first (e.g. READY, IN_PROGRESS, COMPLETED)
    const normalizedStatus = status.toUpperCase().replace(/\s+/g, '_');

    let config = STATUS_CONFIG[normalizedStatus];

    // Fallbacks for mapping dashboard text formats internally
    if (!config) {
        if (normalizedStatus === 'IN_PROCESS' || normalizedStatus === 'STARTED') {
            config = STATUS_CONFIG['IN_PROGRESS'];
        } else if (normalizedStatus === 'APPROVED' || normalizedStatus === 'COMPLETE') {
            config = STATUS_CONFIG['COMPLETED'];
        }
    }

    const { variant, label } = config || {
        ...STATUS_FALLBACK,
        label: status, // Render whatever text was given if unknown
    };

    return (
        <Badge variant={variant as any} className="px-2.5 py-0.5 text-[11px] font-bold">
            {label || status}
        </Badge>
    );
}
