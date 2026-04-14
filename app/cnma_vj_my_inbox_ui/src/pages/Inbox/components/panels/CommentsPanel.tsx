/**
 * CommentsPanel — displays merged task + workflow comments with add-comment form.
 */
import { useState, useMemo } from 'react';
import { Send, Loader2, MessageSquare, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { TaskDetail, WorkflowApprovalComment } from '@/services/inbox/inbox.types';
import { useAddComment } from '@/pages/Inbox/hooks/useInbox';
import { formatRelative } from '@/pages/Inbox/utils/formatters';
import { mergeAndDeduplicateComments } from '@/pages/Inbox/mappers/comments.mapper';
import { Empty } from './shared';
import { formatDate, formatDateTime } from '@/utils/formatters/date';
import { cn } from '@/lib/utils';

export function CommentsPanel({
    detail,
    instanceId,
    onCommentAdded,
    context,
    workflowComments,
    isLoadingWorkflowComments,
    allowAddComment = true,
}: {
    detail: TaskDetail;
    instanceId?: string;
    onCommentAdded?: () => void;
    context?: { sapOrigin?: string; documentId?: string; businessObjectType?: string };
    workflowComments?: WorkflowApprovalComment[];
    isLoadingWorkflowComments?: boolean;
    allowAddComment?: boolean;
}) {
    const [commentText, setCommentText] = useState('');
    const addCommentMutation = useAddComment();

    const merged = useMemo(
        () => mergeAndDeduplicateComments(detail.comments, workflowComments),
        [detail.comments, workflowComments]
    );

    const handleSubmit = () => {
        if (!commentText.trim() || !instanceId) return;
        addCommentMutation.mutate(
            {
                instanceId,
                text: commentText.trim(),
                context: context
                    ? {
                        sapOrigin: context.sapOrigin,
                        documentId: context.documentId,
                        businessObjectType: context.businessObjectType,
                    }
                    : undefined,
            },
            {
                onSuccess: () => {
                    setCommentText('');
                    onCommentAdded?.();
                },
            }
        );
    };

    return (
        <div className="bg-white rounded-none sm:rounded-xl shadow-none sm:shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 text-slate-800">
                <MessageSquare className="size-5 text-slate-600" />
                <h3 className="text-base font-semibold">Comments</h3>
            </div>
            
            <div className="p-5 flex flex-col space-y-6">
                {/* Comment list */}
                {isLoadingWorkflowComments && (
                    <div className="py-4 text-center text-sm text-muted-foreground">Loading comments...</div>
                )}
                {merged.length === 0 && !isLoadingWorkflowComments && (
                    <div className="py-8 text-center text-sm text-slate-400">
                        No comments yet.
                    </div>
                )}
                <div className="space-y-3">
                    {merged.map((comment) => (
                        <div
                            key={comment.id}
                            className="rounded-lg border border-slate-100 p-3 space-y-1.5"
                        >
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <User className="size-3" />
                                <span className="font-medium text-slate-700">{comment.createdBy}</span>
                                <span>·</span>
                                <span>{formatDateTime(comment.createdAt)}</span>
                            </div>
                            <div className="text-sm whitespace-pre-wrap text-slate-800">{comment.text}</div>
                        </div>
                    ))}
                </div>

                {/* Comment input */}
                {allowAddComment && instanceId && (
                    <div className="flex flex-col gap-3">
                        <Textarea
                            placeholder="Write a comment..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            rows={3}
                            className="resize-none bg-white border-slate-200 focus-visible:ring-slate-300"
                            onKeyDown={(e) => {
                                if (e.ctrlKey && e.key === 'Enter') {
                                    handleSubmit();
                                }
                            }}
                        />
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Ctrl+Enter to submit</span>
                            <Button
                                onClick={handleSubmit}
                                disabled={!commentText.trim() || addCommentMutation.isPending}
                                className={cn(
                                    "bg-[#b31d22] hover:bg-[#98181d] text-white disabled:opacity-50",
                                    "px-4 h-9 font-medium transition-colors"
                                )}
                            >
                                {addCommentMutation.isPending && (
                                    <Loader2 className="size-4 animate-spin mr-2" />
                                )}
                                Add Comment
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
