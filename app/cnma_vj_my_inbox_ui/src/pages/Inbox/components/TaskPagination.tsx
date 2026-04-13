/**
 * TaskPagination — simple prev/next pagination footer for the task list.
 *
 * Pure presentational component — receives all state via props.
 */
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TaskPaginationProps {
    currentPage: number;
    totalPages: number;
    isLoading: boolean;
    onPageChange: (page: number) => void;
}

export function TaskPagination({
    currentPage,
    totalPages,
    isLoading,
    onPageChange,
}: TaskPaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between border-t border-border/60 bg-background/95 px-3 py-2">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                disabled={currentPage <= 0 || isLoading}
                className="h-7 px-2 text-xs"
            >
                <ChevronLeft className="mr-1 size-3.5" />
                Prev
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
                Page {currentPage + 1} of {totalPages}
                {isLoading && <span className="ml-1.5">- Loading...</span>}
            </span>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1 || isLoading}
                className="h-7 px-2 text-xs"
            >
                Next
                <ChevronRight className="ml-1 size-3.5" />
            </Button>
        </div>
    );
}
