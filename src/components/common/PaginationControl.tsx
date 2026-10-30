/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standard Pagination Control Component
 * Replaces "Show More" buttons across Cecilian Alumnet modules.
 * Default: 10 items per page with compact numbered navigation.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationControlProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
}

export const PaginationControl: React.FC<PaginationControlProps> = ({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
  className = '',
  itemLabel = 'records'
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize && totalPages <= 1) {
    return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate numbered pages with smart truncation
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxButtons = 5;

    if (totalPages <= maxButtons + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 pb-2 border-t border-stone-200/80 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-400 select-none ${className}`}
      aria-label="Pagination Navigation"
    >
      {/* Information text */}
      <div className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
        Showing <span className="font-semibold text-stone-800 dark:text-stone-200">{startItem}</span> to{' '}
        <span className="font-semibold text-stone-800 dark:text-stone-200">{endItem}</span> of{' '}
        <span className="font-semibold text-stone-800 dark:text-stone-200">{totalItems}</span> {itemLabel}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="p-1.5 rounded-lg border border-stone-200/90 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="First Page"
          aria-label="First Page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded-lg border border-stone-200/90 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-stone-400 text-xs tracking-widest"
                >
                  …
                </span>
              );
            }

            const pageNum = p as number;
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#8B181B] text-white shadow-2xs'
                    : 'bg-white dark:bg-stone-800 border border-stone-200/90 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded-lg border border-stone-200/90 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="p-1.5 rounded-lg border border-stone-200/90 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Last Page"
          aria-label="Last Page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
