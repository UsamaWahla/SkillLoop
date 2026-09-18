import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PageTransitionDirection } from '@/components/ui/animated-page-view';

const DEFAULT_PAGE_SIZE = 5;

export function usePagination<T>(
  items: T[],
  pageSize = DEFAULT_PAGE_SIZE,
  resetKey?: string
) {
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState<PageTransitionDirection>('next');

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / pageSize)),
    [items.length, pageSize]
  );

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(0);
    setDirection('next');
  }, [items.length, resetKey]);

  const safePage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(
    () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize]
  );

  const goNext = useCallback(() => {
    setDirection('next');
    setPage((p) => Math.min(p + 1, totalPages - 1));
  }, [totalPages]);

  const goPrev = useCallback(() => {
    setDirection('prev');
    setPage((p) => Math.max(p - 1, 0));
  }, []);

  return {
    page: safePage,
    totalPages,
    pageItems,
    direction,
    goNext,
    goPrev,
    hasNext: safePage < totalPages - 1,
    hasPrev: safePage > 0,
  };
}
