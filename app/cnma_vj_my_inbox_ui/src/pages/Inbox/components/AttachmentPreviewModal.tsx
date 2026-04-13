import { Download, FileText, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { inboxApi } from '@/services/inbox/inbox.api';
import { useState, lazy, Suspense } from 'react';
import { toast } from 'sonner';

// Lazy-load react-doc-viewer to avoid bundling it upfront
const DocViewer = lazy(() => import('@cyntler/react-doc-viewer'));

// We need to import renderers separately
let DocViewerRenderers: unknown[] = [];
import('@cyntler/react-doc-viewer').then((mod) => {
    DocViewerRenderers = mod.DocViewerRenderers || [];
});

interface AttachmentPreviewCardProps {
    instanceId: string;
    attachmentId: string;
    fileName?: string;
    mimeType?: string;
    onClose: () => void;
}

/**
 * AttachmentPreviewCard — Inline card for the right side of the Attachments tab.
 *
 * Features:
 * - Native <img> for images with zoom/rotate controls
 * - Native <iframe> for PDF and plain text
 * - react-doc-viewer for Office documents (docx, xlsx, pptx)
 * - Fallback download prompt for unsupported types
 */
export function AttachmentPreviewCard({
    instanceId,
    attachmentId,
    fileName,
    mimeType,
    onClose,
}: AttachmentPreviewCardProps) {
    const previewUrl = inboxApi.getAttachmentContentUrl(instanceId, attachmentId, 'inline');
    const downloadUrl = inboxApi.getAttachmentContentUrl(instanceId, attachmentId, 'attachment');
    const displayName = fileName || attachmentId;

    const previewKind = getPreviewKind(mimeType);

    return (
        <Card className="gap-0 bg-card border-border/70 shadow-md overflow-hidden flex flex-col h-full relative">
            <Button
                variant="outline"
                size="icon"
                className="absolute top-3 right-5 z-10 size-8 rounded-full shadow-sm bg-white/80 backdrop-blur-md border-slate-200 text-slate-600 hover:text-red-500 hover:bg-white"
                onClick={onClose}
                title="Close preview"
            >
                <X className="size-4" />
            </Button>

            <CardContent className="flex-1 min-h-0 p-0 overflow-hidden bg-slate-100/60 relative">
                {previewKind === 'image' && (
                    <ImagePreview src={previewUrl} alt={displayName} downloadUrl={downloadUrl} />
                )}

                {previewKind === 'iframe' && (
                    <iframe
                        src={previewUrl}
                        title={displayName}
                        className="w-full h-full border-0 bg-white"
                    />
                )}

                {previewKind === 'docviewer' && (
                    <DocViewerPreview url={previewUrl} fileName={displayName} mimeType={mimeType} />
                )}

                {previewKind === 'none' && (
                    <FallbackPreview
                        displayName={displayName}
                        mimeType={mimeType}
                        downloadUrl={downloadUrl}
                        fileName={fileName}
                    />
                )}
            </CardContent>
        </Card>
    );
}

/* ─── Image Preview with zoom & rotate ─────────────────────────── */

function ImagePreview({ src, alt, downloadUrl }: { src: string; alt: string; downloadUrl: string }) {
    const [zoom, setZoom] = useState(100);
    const [rotation, setRotation] = useState(0);

    return (
        <div className="relative w-full h-full flex flex-col">
            {/* Toolbar */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-lg bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm px-1.5 py-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setZoom((z) => Math.max(25, z - 25))}
                    title="Zoom out"
                >
                    <ZoomOut className="size-3.5" />
                </Button>
                <span className="text-xs font-medium text-slate-600 min-w-[3ch] text-center tabular-nums">
                    {zoom}%
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setZoom((z) => Math.min(400, z + 25))}
                    title="Zoom in"
                >
                    <ZoomIn className="size-3.5" />
                </Button>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    title="Rotate"
                >
                    <RotateCw className="size-3.5" />
                </Button>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
                <a
                    href={downloadUrl}
                    download
                    onClick={() => {
                        const toastId = toast.loading('Preparing file for download...');
                        window.setTimeout(() => toast.dismiss(toastId), 1500);
                    }}
                >
                    <Button variant="ghost" size="icon" className="size-7" title="Download">
                        <Download className="size-3.5" />
                    </Button>
                </a>
            </div>

            {/* Image area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:20px_20px]">
                <img
                    src={src}
                    alt={alt}
                    className="transition-transform duration-200 ease-out shadow-sm rounded-md border border-slate-200"
                    style={{
                        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                        maxWidth: zoom <= 100 ? '100%' : 'none',
                        maxHeight: zoom <= 100 ? '100%' : 'none',
                        objectFit: 'contain',
                    }}
                    draggable={false}
                />
            </div>
        </div>
    );
}

/* ─── DocViewer for Office documents ───────────────────────────── */

function DocViewerPreview({
    url,
    fileName,
    mimeType,
}: {
    url: string;
    fileName: string;
    mimeType?: string;
}) {
    const docs = [
        {
            uri: url,
            fileName: fileName,
            fileType: mimeTypeToFileType(mimeType),
        },
    ];

    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Loading document viewer…
                </div>
            }
        >
            <DocViewer
                documents={docs}
                pluginRenderers={DocViewerRenderers as never}
                config={{
                    header: {
                        disableHeader: true,
                        disableFileName: true,
                    },
                }}
                style={{ width: '100%', height: '100%', background: 'white' }}
            />
        </Suspense>
    );
}

/* ─── Fallback for unsupported types ───────────────────────────── */

function FallbackPreview({
    displayName,
    mimeType,
    downloadUrl,
    fileName,
}: {
    displayName: string;
    mimeType?: string;
    downloadUrl: string;
    fileName?: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <div className="flex items-center justify-center size-16 rounded-xl bg-white border border-border/60 shadow-sm">
                <FileText className="size-8 text-muted-foreground/30" />
            </div>
            <div className="space-y-1">
                <h4 className="text-sm font-medium text-foreground">{displayName}</h4>
                <p className="text-xs text-muted-foreground">
                    Preview is not available for this file type.
                </p>
                {mimeType && (
                    <Badge variant="outline" className="text-[10px] mt-1.5">{mimeType}</Badge>
                )}
            </div>
            <a
                href={downloadUrl}
                download={fileName}
                onClick={() => {
                    const toastId = toast.loading('Preparing file for download...');
                    window.setTimeout(() => toast.dismiss(toastId), 1500);
                }}
            >
                <Button size="sm" className="gap-1.5 mt-1">
                    <Download className="size-3.5" />
                    Download File
                </Button>
            </a>
        </div>
    );
}

/* ─── Helpers ──────────────────────────────────────────────────── */

type PreviewKind = 'image' | 'iframe' | 'docviewer' | 'none';

/**
 * Determines which preview strategy to use for a given MIME type.
 */
function getPreviewKind(mimeType?: string): PreviewKind {
    if (!mimeType) return 'none';
    const mime = mimeType.toLowerCase();

    // Images → native <img>
    if (mime.startsWith('image/')) return 'image';

    // PDF and plain text → <iframe>
    if (mime === 'application/pdf') return 'iframe';
    if (mime.startsWith('text/')) return 'iframe';
    if (mime === 'application/xhtml+xml') return 'iframe';

    // Office documents → react-doc-viewer
    if (OFFICE_MIME_TYPES.has(mime)) return 'docviewer';

    return 'none';
}

const OFFICE_MIME_TYPES = new Set([
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'text/csv',
]);

/**
 * Returns true if the browser/react-doc-viewer can render this MIME type.
 * Used by the attachment list to show/hide the "View" button.
 */
export function isPreviewableType(mimeType?: string): boolean {
    if (!mimeType) return false;
    const kind = getPreviewKind(mimeType);
    return kind !== 'none';
}

/**
 * Maps a MIME type to a simple file extension for react-doc-viewer.
 */
function mimeTypeToFileType(mimeType?: string): string | undefined {
    if (!mimeType) return undefined;
    const map: Record<string, string> = {
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'application/vnd.oasis.opendocument.text': 'odt',
        'application/vnd.oasis.opendocument.spreadsheet': 'ods',
        'application/vnd.oasis.opendocument.presentation': 'odp',
        'text/csv': 'csv',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
    };
    return map[mimeType.toLowerCase()];
}
