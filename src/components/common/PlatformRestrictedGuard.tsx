import React from 'react';
import { ShieldAlert, Globe, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { isAdministrativeOrStaffRole } from '../../types';

interface PlatformRestrictedGuardProps {
  /**
   * Optional custom title for the restriction banner
   */
  title?: string;
  /**
   * Optional custom message
   */
  message?: string;
  /**
   * The protected content to render when in a valid web environment
   */
  children: React.ReactNode;
  /**
   * Optional custom redirect/fallback action handler
   */
  onReturnToDashboard?: () => void;
}

/**
 * PlatformRestrictedGuard:
 * Wraps administrative and privileged institutional dashboard components.
 * Programmatically detects native APK / mobile runtime environments and displays
 * a dignified 'Web-Only Access' notice, reinforcing the cross-platform access policy.
 */
export const PlatformRestrictedGuard: React.FC<PlatformRestrictedGuardProps> = ({
  title = 'Web-Only Administrative Access',
  message = 'Administrative access is restricted to the web portal.',
  children,
  onReturnToDashboard
}) => {
  const { clientPlatform, currentUser, setActiveTab } = useAlumni();

  // Detect whether runtime environment is native mobile APK
  const isCapacitorNative =
    typeof window !== 'undefined' &&
    typeof (window as any).Capacitor !== 'undefined' &&
    typeof (window as any).Capacitor.isNativePlatform === 'function' &&
    (window as any).Capacitor.isNativePlatform();

  const isRestrictedEnvironment = clientPlatform === 'mobile' || isCapacitorNative;
  const isPrivilegedUser = isAdministrativeOrStaffRole(currentUser?.role);

  // If running within mobile APK environment and attempting to view admin panel/tools
  if (isRestrictedEnvironment && isPrivilegedUser) {
    const handleReturn = () => {
      if (onReturnToDashboard) {
        onReturnToDashboard();
      } else {
        setActiveTab('dashboard');
      }
    };

    const webPortalUrl = typeof window !== 'undefined' ? window.location.origin : 'https://stcecilia.edu.ph';

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
        <div className="max-w-xl w-full bg-white dark:bg-stone-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* Header Accent Bar */}
          <div className="h-1.5 w-full bg-[#8B181B]" />

          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
                <ShieldAlert className="w-6 h-6 stroke-[1.75]" />
              </div>
              <div className="flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                  Institutional Security Policy
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight mt-0.5">
                  {title}
                </h2>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 space-y-3">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                {message}
              </p>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                Management desks, registrar record matching, credential verification queues, and role administration controls are exclusively authorized for secure desktop and mobile web browsers. Mobile APK binaries are reserved for Cecilian Alumni networking.
              </p>
            </div>

            {/* Portal Action Buttons */}
            <div className="mt-6 pt-5 border-t border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row items-center gap-3">
              <a
                href={webPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Globe className="w-4 h-4 stroke-[1.75]" />
                <span>Launch Web Portal</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
              </a>

              <button
                type="button"
                onClick={handleReturn}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Return to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
