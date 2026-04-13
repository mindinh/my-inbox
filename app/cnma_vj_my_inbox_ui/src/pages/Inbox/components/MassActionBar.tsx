/**
 * MassActionBar — floating action bar for bulk approve/reject operations.
 *
 * Renders differently on desktop (inline strip) and mobile (fixed bottom sheet).
 * Receives all state via props — no internal business logic.
 */
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, XCircle } from 'lucide-react';
import { DECISION_KEYS } from '@/pages/Inbox/utils/constants';
import { cn } from '@/lib/utils';

interface MassActionBarProps {
    selectedCount: number;
    totalCount: number;
    onToggleSelectAll: () => void;
    onMassDecision?: (decisionKey: string, comment: string, taskIds: string[]) => void;
    selectedIds: Set<string>;
    isExecuting: boolean;
    isMobile: boolean;
}

export function MassActionBar({
    selectedCount,
    totalCount,
    onToggleSelectAll,
    onMassDecision,
    selectedIds,
    isExecuting,
    isMobile,
}: MassActionBarProps) {
    if (totalCount === 0) return null;

    // ─── Desktop: inline strip ─────────────────────────
    if (!isMobile) {
        return (
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/50 px-3 py-1.5">
                <Checkbox
                    checked={selectedCount === totalCount && totalCount > 0}
                    onCheckedChange={onToggleSelectAll}
                />
                <span className="text-xs text-muted-foreground">
                    {selectedCount > 0
                        ? `${selectedCount} of ${totalCount} selected`
                        : 'Select all'}
                </span>
            </div>
        );
    }

    // ─── Mobile: fixed bottom sheet ────────────────────
    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/98 p-3 shadow-[0_12px_28px_rgba(15,23,42,0.14)]">
                <div className="flex items-center gap-2">
                    <div className="mr-auto text-sm font-medium text-slate-600">
                        {selectedCount} selected
                    </div>
                    {selectedCount > 0 && onMassDecision && (
                        <>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                    onMassDecision(DECISION_KEYS.REJECT, '', [...selectedIds])
                                }
                                disabled={isExecuting}
                                className="rounded-lg"
                            >
                                <XCircle className="size-3.5 mr-1" />
                                Reject ({selectedCount})
                            </Button>
                            <Button
                                variant="success"
                                size="sm"
                                onClick={() =>
                                    onMassDecision(DECISION_KEYS.APPROVE, '', [...selectedIds])
                                }
                                disabled={isExecuting}
                                className="rounded-lg text-white"
                            >
                                <CheckCircle className="size-3.5 mr-1" />
                                Approve ({selectedCount})
                            </Button>
                        </>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToggleSelectAll}
                        className="rounded-lg border-slate-200"
                    >
                        {selectedCount === totalCount ? 'Clear' : 'All'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
