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
        <Card className="gap-0 bg-card border-border/70 shadow-sm">
            <CardHeader>
                <CardTitle className="text-base">Comments</CardTitle>
                <CardDescription>Discussion and notes for this task</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

                {/* Comment list */}
                {isLoadingWorkflowComments && (
                    <div className="text-xs text-muted-foreground">Loading workflow comments...</div>
                )}
                {merged.length === 0 && !isLoadingWorkflowComments && (
                    <Empty message="No comments yet." />
                )}
                {merged.map((comment) => (
                    <div
                        key={comment.id}
                        className="rounded-lg border border-border/60 p-3 space-y-1.5"
                    >
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="size-3" />
                            <span className="font-medium text-foreground/80">{comment.createdBy}</span>
                            <span>·</span>
                            <span>{formatDateTime(comment.createdAt)}</span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{comment.text}</div>
                    </div>
                ))}
                {/* Comment input */}
                {allowAddComment && instanceId && (
                    <div className="flex gap-2">
                        <Textarea
                            placeholder="Type a comment..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            rows={2}
                        />
                        <Button
                            size="icon"
                            variant="default"
                            onClick={handleSubmit}
                            disabled={!commentText.trim() || addCommentMutation.isPending}
                            className="shrink-0 self-end"
                        >
                            {addCommentMutation.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Send className="size-4" />
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
