import { Fragment, useState, useRef, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    Clock3,
    Circle,
    Download,
    Eye,
    FileText,
    Link2,
    Loader2,
    MessageSquare,
    Paperclip,
    Send,
    GitBranch,
    Tag,
    Upload,
    User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { type TaskDetail, type CustomAttribute, type TaskComment, type PurchaseOrderFactsheetData, type WorkflowApprovalTreeResponse, type WorkflowApprovalComment } from '@/services/inbox/inbox.types';
import type { BusinessSectionModel } from './TaskDetailSections.types';
import { formatFileSize } from './TaskDetailSections.shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AttachmentPreviewCard, isPreviewableType } from './AttachmentPreviewModal';
import { inboxApi } from '@/services/inbox/inbox.api';
import { useAddAttachment } from '@/hooks/useInbox';
import { toast } from 'sonner';

/* ─── Attachment Filename Helpers ──────────────────────────── */

/** Remove duplicate extensions: "report.xlsx.xlsx" → "report.xlsx" */
function cleanFileName(name?: string): string | undefined {
    if (!name) return undefined;
    // Match pattern like "foo.ext.ext" where both ext are identical (case-insensitive)
    const match = name.match(/^(.+)\.([^.]+)\.([^.]+)$/);
    if (match && match[2].toLowerCase() === match[3].toLowerCase()) {
        return `${match[1]}.${match[3]}`;
    }
    return name;
}

/** Map a MIME type to a short, human-readable label */
function friendlyFileType(mimeType?: string): string {
    if (!mimeType) return 'File';
    const map: Record<string, string> = {
        'application/pdf': 'PDF',
        'application/msword': 'Word Document',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
        'application/vnd.ms-excel': 'Excel Spreadsheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
        'application/vnd.ms-powerpoint': 'PowerPoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
        'application/vnd.oasis.opendocument.text': 'ODF Text',
        'application/vnd.oasis.opendocument.spreadsheet': 'ODF Spreadsheet',
        'application/vnd.oasis.opendocument.presentation': 'ODF Presentation',
        'application/zip': 'ZIP Archive',
        'application/x-zip-compressed': 'ZIP Archive',
        'application/gzip': 'GZIP Archive',
        'application/json': 'JSON',
        'application/xml': 'XML',
        'application/octet-stream': 'Binary File',
        'text/plain': 'Text File',
        'text/csv': 'CSV',
        'text/html': 'HTML',
        'image/png': 'PNG Image',
        'image/jpeg': 'JPEG Image',
        'image/gif': 'GIF Image',
        'image/webp': 'WebP Image',
        'image/svg+xml': 'SVG Image',
    };
    return map[mimeType.toLowerCase()] || mimeType;
}

// Overview panel removed based on user request.


export function BusinessPanel({
    model,
    detail,
    isMobile = false,
}: {
    model: BusinessSectionModel;
    detail: TaskDetail;
    isMobile?: boolean;
}) {
    const [selectedRow, setSelectedRow] = useState<{
        tableTitle: string;
        rowId: string;
        fields: Array<{ label: string; value: string }>;
    } | null>(null);
    const allFields = [
        { key: 'sys_created_on', label: 'Created On', value: formatDate(detail.task.createdOn) },
        ...model.cards.flatMap((card) => card.fields).filter(f => f.label !== 'Created On' && f.label !== 'Creation Date')
    ];

    const regularFields = allFields.filter(f => f.label !== 'Description' && f.label !== 'Header Note');
    const descriptionFields = allFields.filter(f => f.label === 'Description' || f.label === 'Header Note');

    return (
        <div className="space-y-6">
            {/* ── Header Info Cards (Flattened) ── */}
            {isMobile ? (
                /* Mobile: compact key-value list inside a single card without section headers */
                <Card className="gap-0 bg-card border-border/70 shadow-sm">
                    <CardHeader className="pb-2 border-b border-border/40">
                        <CardTitle className="text-lg">{model.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="flex flex-col gap-1 px-4 py-3">
                            {regularFields.map((item) => (
                                <div key={item.key} className="flex items-start justify-between gap-3 py-3">
                                    <span className="text-slate-500 text-[12px] uppercase tracking-wider font-medium pt-[1px] w-5/12 shrink-0">{item.label}</span>
                                    <span className="font-medium text-slate-900 text-[14px] text-right break-words">{item.value}</span>
                                </div>
                            ))}
                            {descriptionFields.map((item) => (
                                <div key={item.key} className="flex flex-col gap-1.5 py-3">
                                    <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">{item.label}</span>
                                    <div className="font-medium text-slate-900 border border-slate-200 bg-slate-50 rounded-lg p-3.5 mt-1 text-sm whitespace-pre-wrap leading-relaxed break-words">
                                        {item.value || <span className="text-slate-400 italic">No value</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                /* Desktop: flat grid without nested cards */
                <Card className="gap-0 bg-card border-border/70 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">{model.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                        {regularFields.map((item) => (
                            <div key={item.key} className="flex flex-col gap-1">
                                <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">{item.label}</span>
                                <span className="font-medium text-sm text-slate-900">{item.value}</span>
                            </div>
                        ))}
                        {descriptionFields.map((item) => (
                            <div key={item.key} className="flex flex-col gap-1.5 col-span-full pt-2">
                                <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">{item.label}</span>
                                <div className="font-medium text-slate-900 border border-slate-200 bg-slate-50 rounded-lg p-3.5 mt-1 text-sm whitespace-pre-wrap leading-relaxed">
                                    {item.value || <span className="text-slate-400 italic">No value</span>}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {model.tables
                .filter((table) => !['Header Facts', 'Custom Attributes', 'Related Objects'].includes(table.title))
                .map((table) => (
                    <Card key={table.id} className="gap-0 bg-card border-border/70 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">{table.title}</CardTitle>
                            {!isMobile && table.rows.length > 0 && (
                                <CardDescription>Click a row to view complete details</CardDescription>
                            )}
                        </CardHeader>
                        <CardContent>
                            {isMobile ? (
                                <div className="divide-y divide-border/60">
                                    {table.rows.length === 0 && (
                                        <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                                            {table.emptyMessage || 'No data'}
                                        </div>
                                    )}
                                    {table.rows.map((row) => (
                                        <div key={row.id} className="py-4 first:pt-3 last:pb-3 space-y-2">
                                            {table.columns.map((column) => (
                                                <div
                                                    key={`${row.id}-${column.key}`}
                                                    className="flex items-start justify-between gap-3"
                                                >
                                                    <span className="text-[13px] font-medium text-slate-500 pt-[1px] w-5/12 shrink-0">
                                                        {column.label}
                                                    </span>
                                                    <span className="text-[15px] font-semibold text-slate-900 text-right break-words">
                                                        {safe(row.values[column.key])}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="max-h-[420px] overflow-auto rounded-xl border border-border/60 bg-white">
                                    <Table>
                                        <TableHeader className="bg-slate-100/90">
                                            <TableRow className="border-border/70 bg-transparent hover:bg-transparent">
                                                {table.columns.map((column) => (
                                                    <TableHead
                                                        key={column.key}
                                                        className={cn(
                                                            'h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500',
                                                            column.align === 'right' && 'text-right'
                                                        )}
                                                    >
                                                        {column.label}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {table.rows.length === 0 && (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={table.columns.length}
                                                        className="px-4 py-8 text-center text-muted-foreground whitespace-normal"
                                                    >
                                                        {table.emptyMessage || 'No data'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {table.rows.map((row) => (
                                                <TableRow
                                                    key={row.id}
                                                    onClick={() => {
                                                        const selectedFields = table.columns.map((column) => ({
                                                            label: column.label,
                                                            value: safe(row.values[column.key]),
                                                        }));
                                                        const knownKeys = new Set(table.columns.map((column) => column.key));
                                                        for (const [key, value] of Object.entries(row.values)) {
                                                            if (knownKeys.has(key)) continue;
                                                            selectedFields.push({
                                                                label: table.detailFieldLabels?.[key] || prettifyFieldLabel(key),
                                                                value: safe(value),
                                                            });
                                                        }
                                                        setSelectedRow({
                                                            tableTitle: table.title,
                                                            rowId: row.id,
                                                            fields: selectedFields,
                                                        });
                                                    }}
                                                    className="border-border/60 cursor-pointer hover:bg-primary/5"
                                                >
                                                    {table.columns.map((column) => (
                                                        <TableCell
                                                            key={`${row.id}-${column.key}`}
                                                            className={cn(
                                                                'px-4 py-3.5 text-sm whitespace-normal',
                                                                column.align === 'right' && 'text-right'
                                                            )}
                                                        >
                                                            {safe(row.values[column.key])}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

            {!isMobile && (
                <Sheet
                    open={!!selectedRow}
                    onOpenChange={(open) => {
                        if (!open) setSelectedRow(null);
                    }}
                >
                    <SheetContent side="right" className="w-[520px] sm:max-w-[520px] p-0">
                        <SheetHeader className="border-b border-border/60 bg-slate-50/90">
                            <SheetTitle>{selectedRow?.tableTitle || 'Details'}</SheetTitle>
                            <SheetDescription>
                                Row ID: {selectedRow?.rowId || '-'}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="p-4 overflow-auto">
                            <div className="overflow-hidden rounded-xl border border-border/60 bg-white">
                                <Table>
                                    <TableBody>
                                        {(selectedRow?.fields || []).map((item) => (
                                            <TableRow key={`${item.label}-${item.value}`}>
                                                <TableCell className="w-[42%] bg-slate-50/70 px-4 py-3 text-muted-foreground whitespace-normal">
                                                    {item.label}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 font-medium break-all whitespace-normal">
                                                    {item.value}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            )}
        </div>
    );
}


export function AttachmentsPanel({ detail, isMobile = false }: { detail: TaskDetail; isMobile?: boolean }) {
    const [previewAttachment, setPreviewAttachment] = useState<{
        id: string;
        fileName?: string;
        mimeType?: string;
    } | null>(null);
    const instanceId = detail.task.instanceId;
    const isPreviewOpen = !!previewAttachment;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const addAttachmentMutation = useAddAttachment();

    const ALLOWED_TYPES = [
        'application/pdf',
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'text/plain', 'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.presentation',
    ];
    const MAX_SIZE_MB = 10;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset input so same file can be re-selected
        e.target.value = '';

        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error(`File type "${file.type || 'unknown'}" is not allowed. Supported: PDF, images, Office documents, text.`);
            return;
        }
        if (file.size > MAX_SIZE_BYTES) {
            toast.error(`File size exceeds ${MAX_SIZE_MB}MB limit.`);
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
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.odt,.ods,.odp"
                onChange={handleFileUpload}
            />

            {/* ── Left: Attachment list card — shrinks when preview is open ── */}
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
                                    {/* View/Preview — desktop only */}
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
                                    <a
                                        href={inboxApi.getAttachmentContentUrl(instanceId, attachment.id, 'attachment')}
                                        download={cleanFileName(attachment.fileName) || cleanFileName(attachment.fileDisplayName)}
                                        className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-primary/5 hover:text-foreground transition-colors"
                                        title="Download attachment"
                                    >
                                        <Download className="size-3.5" />
                                        Download
                                    </a>
                                </div>
                                {/* Date/author */}
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

            {/* ── Right: Preview card — slides in from the right (desktop only) ── */}
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

export function mergeAndDeduplicateComments(
    taskComments: TaskComment[],
    workflowComments?: WorkflowApprovalComment[]
) {
    const unified: any[] = [];

    for (const c of (workflowComments || [])) {
        // Reconstruct a parseable date string
        let dateStr = c.postedOn || '';
        if (c.postedOn && c.postedTime) {
            // If SAP EDM.Time format like PT14H35M00S
            let t = c.postedTime;
            if (t.startsWith('PT')) {
                t = t.replace('PT', '').replace('H', ':').replace('M', ':').replace('S', '');
            }
            dateStr += `T${t.split('.')[0]}`;
        }
        const dateObj = parseDate(dateStr);
        unified.push({
            id: `wc-${c.docNum}-${dateStr}-${Math.random()}`,
            text: c.noteText || '',
            createdBy: c.userComment || 'System',
            createdAt: dateStr,
            dateObj: Number.isNaN(dateObj.getTime()) ? new Date(0) : dateObj,
        });
    }

    for (const c of taskComments) {
        const dateObj = parseDate(c.createdAt || '');
        const textNorm = (c.text || '').trim();
        
        // Deduplicate: avoid pushing identical text that occurred within 24 hours
        const isDuplicate = unified.some(u => 
            u.text.trim() === textNorm &&
            Math.abs(u.dateObj.getTime() - dateObj.getTime()) < 1000 * 60 * 60 * 24
        );

        if (!isDuplicate) {
            unified.push({
                id: c.id,
                text: c.text,
                createdBy: c.createdByName || c.createdBy || 'Unknown',
                createdAt: c.createdAt,
                dateObj: Number.isNaN(dateObj.getTime()) ? new Date(0) : dateObj,
            });
        }
    }

    unified.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    return unified;
}

export function CommentsPanel({
    detail,
    instanceId,
    onCommentAdded,
    context,
    workflowComments,
    isLoadingWorkflowComments,
}: {
    detail: TaskDetail;
    instanceId?: string;
    onCommentAdded?: () => void;
    context?: { sapOrigin?: string; documentId?: string; businessObjectType?: string };
    workflowComments?: WorkflowApprovalComment[];
    isLoadingWorkflowComments?: boolean;
}) {
    const [commentText, setCommentText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!commentText.trim() || !instanceId) return;
        setIsSubmitting(true);
        try {
            const { addComment } = await import('@/services/inbox/inbox.api').then(m => ({ addComment: m.inboxApi.addComment }));
            await addComment(instanceId, commentText.trim(), context);
            setCommentText('');
            onCommentAdded?.();
        } catch {
            // Error toast is handled by the hook/api layer
        } finally {
            setIsSubmitting(false);
        }
    };

    const allComments = useMemo(() => {
        return mergeAndDeduplicateComments(detail.comments, workflowComments);
    }, [workflowComments, detail.comments]);

    const hasAnyComments = allComments.length > 0;

    return (
        <Card className="gap-0 bg-card border-border/70 shadow-sm">
            <CardHeader>
                <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {isLoadingWorkflowComments ? (
                    <div className="flex items-center justify-center p-4">
                        <Loader2 className="size-5 animate-spin text-muted-foreground/60" />
                    </div>
                ) : (
                    <>
                        {!hasAnyComments && !instanceId && <Empty message="No comments yet." />}
                        {!hasAnyComments && instanceId && (
                            <div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                                <MessageSquare className="size-4" />
                                No comments available.
                            </div>
                        )}
                        {allComments.map((comment: any) => (
                            <Fragment key={comment.id}>
                                <div className="rounded-md border border-border/60 p-3">
                                    <div className="mb-1 text-xs text-muted-foreground">
                                        {safe(comment.createdBy)} - {formatDate(comment.createdAt)}
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{safe(comment.text)}</p>
                                </div>
                            </Fragment>
                        ))}
                    </>
                )}

                {/* Add Comment Form */}
                {instanceId && (
                    <div className="border-t border-border/60 pt-3 mt-2 space-y-2">
                        <Textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Add a comment..."
                            disabled={isSubmitting}
                        />
                        <div className="flex justify-end">
                            <Button
                                size="sm"
                                onClick={handleSubmit}
                                disabled={!commentText.trim() || isSubmitting}
                                className="gap-1.5"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                    <Send className="size-3.5" />
                                )}
                                {isSubmitting ? 'Sending...' : 'Add Comment'}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function ActivityPanel({ detail }: { detail: TaskDetail }) {
    const processingRows = detail.processingLogs.map((log, idx) => ({
        id: `proc-${log.orderId ?? idx}`,
        timestamp: formatDate(log.timestamp),
        actor: safe(log.performedByName || log.performedBy),
        action: safe(log.actionName || log.taskStatus),
        details: safe(log.comments),
    }));

    const workflowRows = detail.workflowLogs.map((log) => ({
        id: `wf-${log.id}`,
        timestamp: formatDate(log.timestamp),
        actor: safe(log.userName || log.user),
        action: safe(log.action),
        details: safe(log.details),
    }));

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Card className="gap-0 bg-card border-border/70 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Processing Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    <ActivityTimeline
                        rows={processingRows}
                        emptyMessage="No processing logs yet"
                        accent="processing"
                    />
                </CardContent>
            </Card>

            <Card className="gap-0 bg-card border-border/70 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Workflow Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    <ActivityTimeline
                        rows={workflowRows}
                        emptyMessage="No workflow logs yet"
                        accent="workflow"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

export function WorkflowApprovalPanel({
    data,
    isLoading,
    error,
}: {
    data?: WorkflowApprovalTreeResponse;
    isLoading: boolean;
    error?: string;
}) {
    const [expandedStepLevels, setExpandedStepLevels] = useState<number[]>([]);

    const toggleExpand = (level: number) => {
        setExpandedStepLevels(prev =>
            prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
        );
    };

    const steps = [...(data?.steps || [])].sort((a, b) => a.level - b.level);
    const currentIndex = steps.findIndex((step) => isPendingApprovalStatus(step.status));
    const nextIndex = currentIndex >= 0 && currentIndex < steps.length - 1 ? currentIndex + 1 : -1;

    return (
        <Card className="gap-0 bg-card border-border/70 shadow-sm">
            <CardHeader>
                <CardTitle className="text-base">Workflow Approval Tree</CardTitle>
                <CardDescription>
                    {data?.prNumber ? `PR ${data.prNumber}` : 'Approval sequence from SAP'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {isLoading && (
                    <div className="rounded-lg border border-border/70 px-4 py-5 text-sm text-muted-foreground">
                        Loading workflow approval steps...
                    </div>
                )}

                {!isLoading && error && (
                    <div className="rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                        {error}
                    </div>
                )}

                {!isLoading && !error && steps.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                        No workflow approval steps found for this task.
                    </div>
                )}

                {!isLoading && !error && steps.length > 0 && (
                    <div className="relative pl-1">
                        <div className="absolute left-[15px] top-1 bottom-1 w-px bg-border/80" />
                        <div className="space-y-2.5">
                            {steps.map((step, index) => {
                                const isCurrent = index === currentIndex;
                                const isNext = index === nextIndex;
                                const isCompleted = currentIndex >= 0 ? index < currentIndex : normalizeApprovalStatus(step.status) === 'APPROVED';
                                const status = normalizeApprovalStatus(step.status);
                                const isExpanded = expandedStepLevels.includes(step.level);

                                // Use data from backend response
                                const formattedDate = step.postedOn ? `${step.postedOn}${step.postedTime ? ` ${step.postedTime.split('.')[0]}` : ''}` : 'No date provided';
                                const noteData = step.noteText;


                                return (
                                    <motion.div
                                        key={`${step.prNumber}-${step.level}-${index}`}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2, delay: index * 0.04 }}
                                        className="relative pl-10"
                                    >
                                        <div className="absolute left-0 top-1">
                                            {isCompleted ? (
                                                <CheckCircle2
                                                    className="size-6 rounded-full bg-emerald-50 p-1 text-emerald-600"
                                                />
                                            ) : (
                                                <Circle
                                                    className={cn(
                                                        'size-6 rounded-full p-1',
                                                        isCurrent && 'bg-amber-50 text-amber-600',
                                                        isNext && 'bg-blue-50 text-blue-600',
                                                        !isCurrent && !isNext && 'bg-slate-100 text-slate-500'
                                                    )}
                                                />
                                            )}
                                        </div>
                                        <div
                                            className={cn(
                                                "rounded-lg border border-border/70 bg-background/95 px-3 py-2.5 transition-colors",
                                                isCompleted ? "cursor-pointer hover:bg-slate-50" : ""
                                            )}
                                            onClick={() => isCompleted && toggleExpand(step.level)}
                                        >
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <span className="font-semibold text-foreground/80">Level {step.level}</span>
                                                <span>•</span>
                                                <span>Code {safe(step.releaseCode)}</span>
                                                {isCurrent && <Badge variant="warning">Current</Badge>}
                                                {isNext && <Badge variant="info">Next</Badge>}
                                            </div>
                                            <div className="mt-1 text-sm font-semibold">
                                                {safe(step.approver || step.approverUserId)}
                                            </div>
                                            {step.approverUserId && (
                                                <div className="mt-0.5 text-xs text-muted-foreground">
                                                    User ID: {step.approverUserId}
                                                </div>
                                            )}
                                            <div className="mt-0.5 flex justify-between items-center text-sm text-muted-foreground">
                                                <span>Status: {formatApprovalStatus(status)}</span>
                                                {isCompleted && (
                                                    <span className="text-xs text-muted-foreground/70">
                                                        {isExpanded ? "Hide details" : "Show details"}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Expanded Note View */}
                                            <AnimatePresence>
                                                {isExpanded && isCompleted && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                        animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                                                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="pt-3 border-t border-border/60">
                                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                                                                <Clock3 className="size-3" />
                                                                <span>{formattedDate}</span>
                                                            </div>
                                                            {noteData ? (
                                                                <div className="rounded bg-slate-50 p-2.5 text-sm text-slate-700 border border-slate-100">
                                                                    <div className="flex items-start gap-2">
                                                                        <MessageSquare className="size-3.5 mt-0.5 text-slate-400 shrink-0" />
                                                                        <span>{noteData}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-slate-400 italic">No notes provided for approval.</div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ActivityTimeline({
    rows,
    emptyMessage,
    accent,
}: {
    rows: Array<{
        id: string;
        timestamp: string;
        actor: string;
        action: string;
        details: string;
    }>;
    emptyMessage: string;
    accent: 'processing' | 'workflow';
}) {
    if (rows.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="relative pl-1">
            <div className="absolute left-[15px] top-1 bottom-1 w-px bg-border/80" />
            <div className="space-y-3">
                {rows.map((row, idx) => (
                    <motion.div
                        key={row.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.04 }}
                        className="relative pl-10"
                    >
                        <div className="absolute left-0 top-1">
                            {accent === 'processing' ? (
                                <CheckCircle2 className="size-6 rounded-full bg-emerald-50 p-1 text-emerald-600" />
                            ) : (
                                <Circle className="size-6 rounded-full bg-blue-50 p-1 text-blue-600" />
                            )}
                        </div>
                        <div className="rounded-lg border border-border/70 bg-background/95 px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>{row.timestamp}</span>
                                <span className="font-medium text-foreground/80">{row.actor}</span>
                            </div>
                            <div className="mt-1 text-sm font-semibold">{row.action}</div>
                            <div className="mt-0.5 text-sm text-muted-foreground">{row.details}</div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function InfoItem({
    icon: Icon,
    label,
    value,
    sub,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value?: string;
    sub?: string;
}) {
    return (
        <div className="rounded-md border border-border/60 p-3">
            <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Icon className="size-3.5" />
                {label}
            </div>
            <div className="text-sm font-medium">{safe(value)}</div>
            {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
    );
}

function Empty({ message }: { message: string }) {
    return (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            <FileText className="size-4" />
            {message}
        </div>
    );
}

export function makeTabDefinitions(detail: TaskDetail, workflowCount = 0, workflowComments?: WorkflowApprovalComment[]) {
    const poFacts = detail.businessContext?.po as PurchaseOrderFactsheetData | undefined;
    const poFactsCount =
        (poFacts?.items?.length || 0) +
        (poFacts?.accountAssignments?.length || 0) +
        (poFacts?.scheduleLines?.length || 0);

    const mergedCommentsCount = mergeAndDeduplicateComments(detail.comments, workflowComments).length;

    return [
        {
            value: 'business',
            label: 'Information',
            icon: Tag,
            count: undefined,
        },
        {
            value: 'workflow',
            label: 'Workflow',
            icon: GitBranch,
            count: workflowCount,
        },
        { value: 'attachments', label: 'Attachments', icon: Paperclip, count: detail.attachments.length },
        { value: 'comments', label: 'Comments', icon: MessageSquare, count: mergedCommentsCount }
        // {
        //     value: 'activity',
        //     label: 'Activity',
        //     icon: Clock3,
        //     count: detail.processingLogs.length + detail.workflowLogs.length,
        // },
    ] as const;
}

function formatDate(value?: string): string {
    if (!value) return '-';
    const date = parseDate(value);
    if (Number.isNaN(date.getTime())) return value;
    return format(date, 'dd MMM yyyy, HH:mm');
}

function formatRelative(value?: string): string | undefined {
    if (!value) return undefined;
    const date = parseDate(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return formatDistanceToNow(date, { addSuffix: true });
}

function parseDate(value: string): Date {
    const sapMatch = value.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    if (sapMatch) {
        return new Date(Number(sapMatch[1]));
    }
    return new Date(value);
}

function prettifyFieldLabel(key: string): string {
    const withSpaces = key
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim();
    if (!withSpaces) return key;
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function safe(value?: string): string {
    return value && String(value).trim() ? value : '-';
}

function normalizeApprovalStatus(value?: string): string {
    if (!value) return 'UNKNOWN';
    return value.trim().toUpperCase();
}

function isPendingApprovalStatus(value?: string): boolean {
    const status = normalizeApprovalStatus(value);
    return status === 'PENDING' || status === 'IN_PROCESS' || status === 'CURRENT' || status === 'OPEN';
}

function formatApprovalStatus(value?: string): string {
    const status = normalizeApprovalStatus(value);
    if (status === 'UNKNOWN') return 'Unknown';
    return status
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function StatusHeaderBadges({ detail }: { detail: TaskDetail }) {
    const context = detail.businessContext;
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {context?.type && context.type !== 'UNKNOWN' && (
                <Badge variant="info" className="text-xs">
                    {context.type}
                    {context.documentId ? ` ${context.documentId}` : ''}
                </Badge>
            )}
            <Badge variant={detail.task.status === 'READY' ? 'success' : 'secondary'} className="text-xs">
                {detail.task.status}
            </Badge>
            {detail.task.priority && <Badge variant="warning" className="text-xs">{detail.task.priority}</Badge>}
        </div>
    );
}
