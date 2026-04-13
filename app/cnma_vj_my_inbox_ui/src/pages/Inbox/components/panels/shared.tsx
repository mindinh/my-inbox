/**
 * Shared micro-components for task detail panels.
 *
 * These are tiny presentational helpers used across multiple panel files.
 * Keeping them in one place avoids duplication.
 */
import { FileText, CheckCircle2, Circle } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Empty State ───────────────────────────────────────────

export function Empty({ message }: { message: string }) {
    return (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            <FileText className="size-4" />
            {message}
        </div>
    );
}

// ─── Info Item ─────────────────────────────────────────────

export function InfoItem({
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
            <div className="text-sm font-medium">{value ?? '—'}</div>
            {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
    );
}

// ─── Activity Timeline ─────────────────────────────────────

export interface ActivityRow {
    id: string;
    timestamp: string;
    actor: string;
    action: string;
    details: string;
}

export function ActivityTimeline({
    rows,
    emptyMessage,
    accent,
}: {
    rows: ActivityRow[];
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

// ─── Attachment Filename Helpers ───────────────────────────

/** Remove duplicate extensions: "report.xlsx.xlsx" → "report.xlsx" */
export function cleanFileName(name?: string): string | undefined {
    if (!name) return undefined;
    const match = name.match(/^(.+)\.([^.]+)\.([^.]+)$/);
    if (match && match[2].toLowerCase() === match[3].toLowerCase()) {
        return `${match[1]}.${match[3]}`;
    }
    return name;
}

/** Map a MIME type to a short, human-readable label */
export function friendlyFileType(mimeType?: string): string {
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
