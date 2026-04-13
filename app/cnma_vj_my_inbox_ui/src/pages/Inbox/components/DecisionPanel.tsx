import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Decision } from '@/services/inbox/inbox.types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, HelpCircle, Loader2 } from 'lucide-react';

interface DecisionPanelProps {
    decisions: Decision[];
    onExecute: (decisionKey: string, comment: string) => void;
    isExecuting: boolean;
}

/**
 * Renders decision buttons directly (from SAP TASKPROCESSING DecisionOptions).
 * Clicking a button opens a confirmation dialog where the user can add a comment.
 * Comment is mandatory for NEGATIVE decisions or when decision.commentMandatory is true.
 */
export function DecisionPanel({ decisions, onExecute, isExecuting }: DecisionPanelProps) {
    const [activeDecision, setActiveDecision] = useState<Decision | null>(null);
    const [comment, setComment] = useState('');

    if (!decisions.length) return null;

    const isCommentRequired = (decision: Decision): boolean => {
        // Respect SAP TASKPROCESSING.DecisionOption.CommentMandatory
        if (decision.commentMandatory === true) return true;
        // Fallback: NEGATIVE nature requires comment
        if (decision.nature === 'NEGATIVE') return true;
        return false;
    };

    const handleOpen = (decision: Decision) => {
        setActiveDecision(decision);
        setComment('');
    };

    const handleConfirm = () => {
        if (!activeDecision) return;
        onExecute(activeDecision.key, comment.trim());
        setComment('');
        setActiveDecision(null);
    };

    const commentRequired = activeDecision ? isCommentRequired(activeDecision) : false;
    const canSubmit = !commentRequired || comment.trim().length > 0;
    const commentSupported = activeDecision?.commentSupported !== false; // defaults to true per SAP schema

    return (
        <>
            {/* Decision Buttons — rendered dynamically from SAP TASKPROCESSING DecisionOptions */}
            {/* Order: NEGATIVE → NEUTRAL → POSITIVE (Reject before Approve) */}
            <div className="flex flex-wrap justify-end gap-2">
                {[...decisions]
                    .sort((a, b) => {
                        const order: Record<string, number> = { NEGATIVE: 0, NEUTRAL: 1, POSITIVE: 2 };
                        return (order[a.nature || 'NEUTRAL'] ?? 1) - (order[b.nature || 'NEUTRAL'] ?? 1);
                    })
                    .map((decision) => (
                        <DecisionButton
                            key={decision.key}
                            decision={decision}
                            onClick={() => handleOpen(decision)}
                            disabled={isExecuting}
                            isExecuting={isExecuting}
                        />
                    ))}
            </div>

            {/* Confirmation Dialog */}
            <Dialog
                open={!!activeDecision}
                onOpenChange={(open) => {
                    if (!open) {
                        setActiveDecision(null);
                        setComment('');
                    }
                }}
            >
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {activeDecision && (
                                <DecisionIcon nature={activeDecision.nature} />
                            )}
                            {activeDecision?.text}
                        </DialogTitle>
                        <DialogDescription>
                            {commentRequired
                                ? 'A comment is required for this action.'
                                : 'You may optionally add a comment before confirming.'}
                        </DialogDescription>
                    </DialogHeader>

                    {commentSupported && (
                        <div className="space-y-2 py-2">
                            <Label htmlFor="decision-dialog-comment" className="text-sm font-medium">
                                Comment {commentRequired && <span className="text-destructive">*</span>}
                            </Label>
                            <Textarea
                                id="decision-dialog-comment"
                                placeholder={
                                    commentRequired
                                        ? 'Enter your comment (required)...'
                                        : 'Add a comment (optional)...'
                                }
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="min-h-[100px] resize-none text-sm"
                                autoFocus
                            />
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            className='mr-2'
                            onClick={() => {
                                setActiveDecision(null);
                                setComment('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant={activeDecision?.nature === 'NEGATIVE' ? 'destructive' : 'success'}
                            onClick={handleConfirm}
                            disabled={!canSubmit || isExecuting}
                        >
                            {isExecuting ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                activeDecision && <DecisionIcon nature={activeDecision.nature} />
                            )}
                            {activeDecision?.text}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─── Decision Button ──────────────────────────────────────

function DecisionButton({
    decision,
    onClick,
    disabled,
    isExecuting,
}: {
    decision: Decision;
    onClick: () => void;
    disabled: boolean;
    isExecuting: boolean;
}) {
    const variantMap: Record<string, 'success' | 'destructive' | 'outline'> = {
        POSITIVE: 'success',
        NEGATIVE: 'destructive',
        NEUTRAL: 'outline',
    };

    const variant = variantMap[decision.nature || 'NEUTRAL'] || 'outline';

    return (
        <Button
            id={`decision-btn-${decision.key}`}
            variant={variant}
            onClick={onClick}
            disabled={disabled}
            className="min-w-[100px]"
        >
            {isExecuting ? (
                <Loader2 className="size-4 animate-spin" />
            ) : (
                <DecisionIcon nature={decision.nature} />
            )}
            {decision.text}
        </Button>
    );
}

function DecisionIcon({ nature }: { nature?: string }) {
    switch (nature) {
        case 'POSITIVE':
            return <CheckCircle className="size-4" />;
        case 'NEGATIVE':
            return <XCircle className="size-4" />;
        default:
            return <HelpCircle className="size-4" />;
    }
}
