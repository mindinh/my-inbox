import { useState, useCallback, useEffect, useMemo } from 'react';

interface UsePaginationOptions {
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

/**
 * Hook to manage pagination with infinite scroll support
 */
export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = {}
) {
  const pageSize = options.pageSize || 20;
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedItems = useMemo(() => {
    const end = currentPage * pageSize;
    return items.slice(0, end);
  }, [items, currentPage, pageSize]);

  const hasMore = paginatedItems.length < items.length;

  const loadMore = useCallback(() => {
    setCurrentPage(prev => prev + 1);
    options.onPageChange?.(currentPage + 1);
  }, [currentPage, options]);

  const reset = useCallback(() => {
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  return {
    paginatedItems,
    currentPage,
    pageSize,
    hasMore,
    loadMore,
    reset,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  };
}
