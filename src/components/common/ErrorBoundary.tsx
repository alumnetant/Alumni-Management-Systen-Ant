/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, RotateCcw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Institutional Shield] Uncaught React exception caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleClearAndReset = () => {
    try {
      if (typeof window !== 'undefined') {
        // Clear transient keys that might cause corrupt state while preserving core auth credentials
        sessionStorage.clear();
        localStorage.removeItem('alumni_active_tab_v2');
        localStorage.removeItem('alumni_active_view_v1');
        window.location.href = '/';
      }
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#FAF9F6] dark:bg-[#121316] flex items-center justify-center p-4 sm:p-6 text-stone-900 dark:text-stone-100 antialiased font-sans">
          <div className="max-w-lg w-full bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] space-y-6 text-center">
            
            {/* Header Icon */}
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-center mx-auto text-[#8B181B] dark:text-rose-400">
              <ShieldAlert className="w-8 h-8" strokeWidth={1.75} />
            </div>

            {/* Title & Copy */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-stone-500 dark:text-stone-400">
                <span>St. Cecilia's College</span>
                <span>·</span>
                <span>Session Recovery Shield</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Unable to Load Interface
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-md mx-auto">
                An unexpected interface exception occurred. Your local credentials and security session remain intact.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" strokeWidth={2} />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearAndReset}
                className="w-full sm:w-auto px-4 py-2.5 bg-stone-100 hover:bg-stone-200/80 dark:bg-stone-800 dark:hover:bg-stone-700/80 text-stone-700 dark:text-stone-200 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border border-stone-200/80 dark:border-stone-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" strokeWidth={2} />
                <span>Reset View</span>
              </button>
            </div>

            {/* Collapsible Diagnostic Note */}
            {this.state.error && (
              <details className="text-left text-xs bg-stone-50 dark:bg-stone-950 p-3 rounded-xl border border-stone-200/60 dark:border-stone-800/80 text-stone-500 dark:text-stone-400">
                <summary className="cursor-pointer font-medium hover:text-stone-800 dark:hover:text-stone-200 transition-colors flex items-center gap-1.5 select-none">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Technical Diagnostics</span>
                </summary>
                <p className="font-mono mt-2 text-[11px] break-all leading-normal text-rose-700 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30 p-2 rounded-lg">
                  {this.state.error.toString()}
                </p>
              </details>
            )}

            <div className="text-[11px] text-stone-400 dark:text-stone-500 pt-2 border-t border-stone-100 dark:border-stone-800">
              Cecilian Alumnet · Institutional Resilience Engine
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
