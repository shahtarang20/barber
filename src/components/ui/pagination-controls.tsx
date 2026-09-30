"use client";

import { Button } from "@/components/ui/button";

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export function PaginationControls({
  pagination,
  onPageChange,
  onLimitChange,
}: {
  pagination: PaginationInfo | null;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  if (!pagination) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <label htmlFor="pageSize">Show</label>
        <select
          id="pageSize"
          value={pagination.limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 h-11 text-sm"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
        </select>
        <span>per page &middot; {pagination.total} total</span>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-zinc-500 mr-2">
            Page {pagination.page} of {pagination.pages}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            disabled={pagination.page === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
            disabled={pagination.page === pagination.pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
