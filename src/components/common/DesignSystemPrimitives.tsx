import React from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';

interface EmptyStateCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}) => (
  <div
    className={`bg-white dark:bg-[#1c1917] rounded-2xl border border-stone-200/80 dark:border-stone-800 px-6 py-12 text-center flex flex-col items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${className}`}
  >
    <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800/80 text-stone-500 dark:text-stone-400 flex items-center justify-center mb-4 border border-stone-200/70 dark:border-stone-700/70">
      {icon}
    </div>
    <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 tracking-tight">
      {title}
    </h3>
    <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1.5 max-w-md leading-relaxed">
      {description}
    </p>
    {(actionLabel || secondaryActionLabel) && (
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="ds-btn-secondary px-4 py-2 text-xs font-semibold rounded-xl min-h-[40px] cursor-pointer"
          >
            <span>{actionLabel}</span>
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="ds-btn-ghost px-3.5 py-2 text-xs font-medium rounded-xl min-h-[40px] cursor-pointer"
          >
            <span>{secondaryActionLabel}</span>
          </button>
        )}
      </div>
    )}
  </div>
);

interface StepProgressHeaderProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
  className?: string;
}

export const StepProgressHeader: React.FC<StepProgressHeaderProps> = ({
  currentStep,
  totalSteps,
  stepLabels,
  className = '',
}) => {
  const safeTotal = Math.max(1, totalSteps);
  const clampedStep = Math.min(safeTotal, Math.max(1, currentStep));
  const percent = Math.round((clampedStep / safeTotal) * 100);
  const currentLabel = stepLabels?.[clampedStep - 1];

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-stone-800 dark:text-stone-200 tabular-nums">
          Step {clampedStep} of {safeTotal}
          {currentLabel ? ` · ${currentLabel}` : ''}
        </span>
        <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 tabular-nums">
          {percent}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#8B181B] transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      {stepLabels && stepLabels.length > 1 && (
        <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto scrollbar-none">
          {stepLabels.map((label, index) => {
            const stepNum = index + 1;
            const isComplete = stepNum < clampedStep;
            const isActive = stepNum === clampedStep;
            return (
              <div
                key={label}
                className={`flex items-center gap-1.5 text-[11px] whitespace-nowrap ${
                  isActive
                    ? 'font-semibold text-[#8B181B] dark:text-rose-400'
                    : isComplete
                      ? 'font-medium text-emerald-700 dark:text-emerald-400'
                      : 'text-stone-400 dark:text-stone-500'
                }`}
              >
                {index > 0 && (
                  <span className="text-stone-300 dark:text-stone-700" aria-hidden="true">
                    /
                  </span>
                )}
                {isComplete && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface CompletionProgressBannerProps {
  title: string;
  subtitle: string;
  completedCount: number;
  totalCount: number;
  actionLabel: string;
  onAction: () => void;
  missingItems?: string[];
  className?: string;
}

export const CompletionProgressBanner: React.FC<CompletionProgressBannerProps> = ({
  title,
  subtitle,
  completedCount,
  totalCount,
  actionLabel,
  onAction,
  missingItems = [],
  className = '',
}) => {
  const safeTotal = Math.max(1, totalCount);
  const percent = Math.min(100, Math.max(15, Math.round((completedCount / safeTotal) * 100)));

  return (
    <div
      className={`bg-white dark:bg-[#1c1917] rounded-2xl border border-stone-200/80 dark:border-stone-800 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</h3>
            <span className="text-xs font-semibold text-[#8B181B] dark:text-rose-400 tabular-nums">
              {completedCount}/{safeTotal} completed ({percent}%)
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{subtitle}</p>
          {missingItems.length > 0 && (
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Remaining: <span className="font-medium text-stone-700 dark:text-stone-300">{missingItems.join(' · ')}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onAction}
          className="ds-btn-secondary px-4 py-2 text-xs font-semibold rounded-xl min-h-[40px] shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#8B181B] transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

interface InlineErrorBannerProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const InlineErrorBanner: React.FC<InlineErrorBannerProps> = ({
  message,
  onRetry,
  retryLabel = 'Retry',
  className = '',
}) => (
  <div
    role="alert"
    className={`rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 px-4 py-3 flex items-center justify-between gap-3 ${className}`}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      <AlertCircle className="w-4 h-4 text-[#8B181B] dark:text-rose-400 shrink-0" />
      <p className="text-xs font-medium text-stone-800 dark:text-stone-200">{message}</p>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="ds-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg min-h-[36px] shrink-0 cursor-pointer flex items-center gap-1.5"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>{retryLabel}</span>
      </button>
    )}
  </div>
);
