/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown, Check, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { COURSE_FILTER_OPTIONS } from '../../lib/courseFilter';

interface CourseFilterButtonProps {
  value: string;
  onChange: (course: string) => void;
  align?: 'left' | 'right';
  id?: string;
}

export const CourseFilterButton: React.FC<CourseFilterButtonProps> = ({
  value,
  onChange,
  align = 'right',
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isActive = Boolean(value && value !== 'all');
  const activeOption = COURSE_FILTER_OPTIONS.find((opt) => opt.value === value) || COURSE_FILTER_OPTIONS[0];

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Filter by Course: ${activeOption.label}`}
        title={`Filter by Course: ${activeOption.label}`}
        className={`group flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap ${
          isActive
            ? 'bg-[#8B181B] hover:bg-[#721316] text-white border border-[#8B181B]'
            : 'bg-red-50/80 hover:bg-red-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-[#8B181B] dark:text-rose-300 border border-red-200 dark:border-rose-900/60'
        }`}
      >
        <Filter
          className={`w-3.5 h-3.5 stroke-[2.25] shrink-0 ${
            isActive ? 'text-white' : 'text-[#8B181B] dark:text-rose-400'
          }`}
        />
        <span className="font-semibold tracking-tight">
          {isActive ? activeOption.label : 'Course'}
        </span>
        {isActive ? (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0" />
        ) : (
          <ChevronDown
            className={`w-3 h-3 text-[#8B181B]/70 dark:text-rose-400/80 group-hover:text-[#8B181B] dark:group-hover:text-rose-300 transition-transform shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="listbox"
            aria-label="Course Filter Options"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#181615] border border-stone-200/90 dark:border-stone-800 shadow-[0_12px_36px_rgba(0,0,0,0.16)] py-1.5 z-50 overflow-hidden divide-y divide-stone-100 dark:divide-stone-800/80 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {/* Header */}
            <div className="px-3.5 py-2 bg-stone-50/80 dark:bg-stone-900/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#8B181B] dark:text-rose-400 stroke-[2]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-200">
                  Filter by Course
                </span>
              </div>
              {isActive && (
                <button
                  type="button"
                  onClick={() => handleSelect('all')}
                  className="text-[11px] font-bold text-[#8B181B] dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Course Options */}
            <div className="p-1.5 space-y-0.5 max-h-80 overflow-y-auto">
              {COURSE_FILTER_OPTIONS.map((option) => {
                const isSelected = (value || 'all') === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(option.value)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#8B181B]/10 dark:bg-rose-950/60 text-[#8B181B] dark:text-rose-300 font-bold'
                        : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/70 font-medium'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate leading-tight">{option.label}</div>
                      <div
                        className={`text-[10px] truncate mt-0.5 ${
                          isSelected
                            ? 'text-[#8B181B]/80 dark:text-rose-300/80 font-medium'
                            : 'text-stone-400 dark:text-stone-500 font-normal'
                        }`}
                      >
                        {option.description}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#8B181B] dark:text-rose-400 stroke-[2.5] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
