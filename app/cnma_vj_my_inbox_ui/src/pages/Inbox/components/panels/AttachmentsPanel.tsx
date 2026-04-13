/**
 * AttachmentsPanel — file attachment list with upload, download, and preview.
 */
import { useState, useRef } from 'react';
import {
    Download,
    Eye,
    Loader2,
    Upload,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { TaskDetail } from '@/services/inbox/inbox.types';
import { AttachmentPreviewCard, isPreviewableType } from '../AttachmentPreviewModal';
import { inboxApi } from '@/services/inbox/inbox.api';
import { useAddAttachment } from '@/pages/Inbox/hooks/useInbox';
import { formatDate, safe } from '@/pages/Inbox/utils/formatters';
import { formatFileSize } from '../TaskDetailSections.shared';
import {
    ALLOWED_ATTACHMENT_TYPES,
    MAX_ATTACHMENT_SIZE_MB,
    MAX_ATTACHMENT_SIZE_BYTES,
} from '@/pages/Inbox/utils/constants';
import { cleanFileName, friendlyFileType, Empty } from './shared';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function AttachmentsPanel({
    detail,
    isMobile = false,
    allowUpload = true,
}: {
    detail: TaskDetail;
    isMobile?: boolean;
    allowUpload?: boolean;
}) {
    const [previewAttachment, setPreviewAttachment] = useState<{
        id: string;
        fileName?: string;
        mimeType?: string;
    } | null>(null);
    const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
    const instanceId = detail.task.instanceId;
    const isPreviewOpen = !!previewAttachment;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const addAttachmentMutation = useAddAttachment();

    const ALLOWED_TYPES = ALLOWED_ATTACHMENT_TYPES as readonly string[];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error(`File type "${file.type || 'unknown'}" is not allowed. Supported: PDF, images, Office documents, text.`);
            return;
        }
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
            toast.error(`File size exceeds ${MAX_ATTACHMENT_SIZE_MB}MB limit.`);
            return;
        }

        addAttachmentMutation.mutate({
            instanceId,
            file,
            sapOrigin: detail.task.sapOrigin
        });
    };

    return (
        <div className={cn(
            'flex gap-4 items-stretch',
            isPreviewOpen && !isMobile && 'h-[calc(100vh-220px)] min-h-[500px]'
        )}>
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.odt,.ods,.odp"
                onChange={handleFileUpload}
            />

            <div className={cn(
                'transition-all duration-300 ease-in-out shrink-0 flex flex-col min-h-0',
                isPreviewOpen && !isMobile ? 'w-[340px]' : 'w-full'
            )}>
                <Card className="gap-0 bg-card border-border/70 shadow-sm h-full flex flex-col min-h-0">
                    <CardHeader className="shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Attachments</CardTitle>
                                <CardDescription>Files and links attached to this task</CardDescription>
                            </div>
                            {allowUpload && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={addAttachmentMutation.isPending}
                                    className="shrink-0"
                                >
                                    {addAttachmentMutation.isPending ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <Upload className="size-3.5" />
                                    )}
                                    {addAttachmentMutation.isPending ? 'Uploading...' : 'Upload'}
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className={cn('flex-1 overflow-y-auto pb-4', isMobile ? 'space-y-3' : 'space-y-2')}>
                        {detail.attachments.length === 0 && (
                            <Empty message="No files attached." />
                        )}
                        {detail.attachments.map((attachment) => (
                            <div
                                key={attachment.id}
                                className={cn(
                                    'rounded-md border p-3 transition-colors',
                                    isMobile ? 'space-y-2.5' : (isPreviewOpen ? 'space-y-2' : 'flex items-start justify-between gap-3'),
                                    previewAttachment?.id === attachment.id
                                        ? 'border-primary/40 bg-primary/5'
                                        : 'border-border/60 hover:bg-slate-50/60'
                                )}
                            >
                                <div className="min-w-0 space-y-1 flex-1">
                                    <div className="font-medium truncate text-sm">
                                        {safe(cleanFileName(attachment.fileName) || cleanFileName(attachment.fileDisplayName) || attachment.id)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {friendlyFileType(attachment.mimeType)} · {formatFileSize(attachment.fileSize)}
                                    </div>
                                </div>
                                <div className={cn(
                                    'flex items-center gap-1.5 shrink-0',
                                    isPreviewOpen && !isMobile && 'flex-wrap'
                                )}>
                                    {!isMobile && isPreviewableType(attachment.mimeType) && (
                                        <button
                                            onClick={() => {
                                                if (isPreviewOpen && previewAttachment?.id !== attachment.id) return;
                                                if (previewAttachment?.id === attachment.id) {
                                                    setPreviewAttachment(null);
                                                } else {
                                                    setPreviewAttachment({
                                                        id: attachment.id,
                                                        fileName: attachment.fileName || attachment.fileDisplayName,
                                                        mimeType: attachment.mimeType,
                                                    });
                                                }
                                            }}
                                            disabled={isPreviewOpen && previewAttachment?.id !== attachment.id}
                                            className={cn(
                                                'inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                                                previewAttachment?.id === attachment.id
                                                    ? 'border-primary/40 bg-primary/10 text-primary'
                                                    : isPreviewOpen
                                                        ? 'border-border/40 text-muted-foreground/40 bg-slate-50/40 cursor-not-allowed opacity-50'
                                                        : 'border-border/60 text-muted-foreground hover:bg-primary/5 hover:text-foreground'
                                            )}
                                            title={previewAttachment?.id === attachment.id ? 'Close preview' : isPreviewOpen ? 'Close current preview first' : 'Preview attachment'}
                                        >
                                            <Eye className="size-3.5" />
                                            {previewAttachment?.id === attachment.id ? 'Close' : 'View'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const fileName = cleanFileName(attachment.fileName) || cleanFileName(attachment.fileDisplayName);
                                            const downloadUrl = inboxApi.getAttachmentContentUrl(instanceId, attachment.id, 'attachment');
                                            setDownloadingAttachmentId(attachment.id);
                                            const toastId = toast.loading('Preparing file for download...');
                                            const link = document.createElement('a');
                                            link.href = downloadUrl;
                                            if (fileName) {
                                                link.download = fileName;
                                            }
                                            document.body.appendChild(link);
                                            link.click();
                                            link.remove();
                                            window.setTimeout(() => {
                                                toast.dismiss(toastId);
                                                setDownloadingAttachmentId((current) =>
                                                    current === attachment.id ? null : current
                                                );
                                            }, 1500);
                                        }}
                                        disabled={downloadingAttachmentId === attachment.id}
                                        className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-primary/5 hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                                        title={
                                            downloadingAttachmentId === attachment.id
                                                ? 'Preparing download'
                                                : 'Download attachment'
                                        }
                                    >
                                        {downloadingAttachmentId === attachment.id ? (
                                            <Loader2 className="size-3.5 animate-spin" />
                                        ) : (
                                            <Download className="size-3.5" />
                                        )}
                                        {downloadingAttachmentId === attachment.id ? 'Preparing...' : 'Download'}
                                    </button>
                                </div>
                                {(!isPreviewOpen || isMobile) && (
                                    <div className={cn('text-xs text-muted-foreground shrink-0', isMobile ? 'text-left' : 'text-right')}>
                                        <div>{formatDate(attachment.createdAt)}</div>
                                        <div>{safe(attachment.createdByName || attachment.createdBy)}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {!isMobile && (
                <AnimatePresence>
                    {previewAttachment && (
                        <motion.div
                            key={previewAttachment.id}
                            className="flex-1 min-w-0"
                            initial={{ opacity: 0, x: 40, width: 0 }}
                            animate={{ opacity: 1, x: 0, width: 'auto' }}
                            exit={{ opacity: 0, x: 40, width: 0 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        >
                            <AttachmentPreviewCard
                                instanceId={instanceId}
                                attachmentId={previewAttachment.id}
                                fileName={previewAttachment.fileName}
                                mimeType={previewAttachment.mimeType}
                                onClose={() => setPreviewAttachment(null)}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
