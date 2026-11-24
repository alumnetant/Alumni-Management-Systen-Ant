import React from 'react';
import { LogOut, Monitor, ShieldAlert } from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { normalizeSystemRole } from '../../types';
import { useIsMobileOrTablet } from '../../lib/platform';

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
   * The protected content to render when in a valid desktop web environment
   */
  children: React.ReactNode;
  /**
   * Optional sign-out callback (navigates back to mobile/tablet auth screen)
   */
  onSignOut?: () => void;
  /**
   * Legacy prop kept for backward compatibility
   */
  onReturnToDashboard?: () => void;
}

const getReadableRoleLabel = (role?: string): string => {
  switch (normalizeSystemRole(role)) {
    case 'superadmin':
      return 'Super Administrator';
    case 'admin':
      return 'Administrator';
    case 'moderator':
      return 'Moderator / Registrar';
    case 'employer':
      return 'Employer Partner';
    default:
      return 'Account';
  }
};

/**
 * PlatformRestrictedGuard:
 * Wraps non-alumni portal workspaces and blocks access on mobile phones, tablets,
 * viewports below 1024px, and native mobile builds with a clean Desktop-Only Gate
 * and Sign Out action.
 */
export const PlatformRestrictedGuard: React.FC<PlatformRestrictedGuardProps> = ({
  title = 'Desktop Browser Required',
  message = 'Mobile and tablet access is reserved for verified Alumni.',
  children,
  onSignOut
}) => {
  const { clientPlatform, currentUser, logout } = useAlumni();
  const isMobileOrTablet = useIsMobileOrTablet();

  const isRestrictedEnvironment = clientPlatform === 'mobile' || isMobileOrTablet;
  const canonicalRole = normalizeSystemRole(currentUser?.role);
  const isNonAlumniUser = Boolean(currentUser) && canonicalRole !== 'alumni';

  if (isRestrictedEnvironment && isNonAlumniUser && currentUser) {
    const handleSignOut = () => {
      logout();
      if (onSignOut) {
        onSignOut();
      }
    };

    const roleLabel = getReadableRoleLabel(currentUser.role);

    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#000000] flex items-center justify-center p-5 sm:p-8 pt-safe pb-safe">
        <div className="max-w-md w-full bg-white dark:bg-[#121212] rounded-2xl border border-[#EFEFEF] dark:border-[#262626] overflow-hidden">
          <div className="h-1 w-full bg-[#8B181B] dark:bg-[#E11D48]" />

          <div className="p-6 sm:p-7 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-full bg-[#F3F4F6] dark:bg-[#262626] flex items-center justify-center text-[#8B181B] dark:text-[#FB7185] shrink-0">
                <Monitor className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8B181B] dark:text-[#FB7185]">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                  <span>Alumni-Only Mobile Policy</span>
                </div>
                <h2 className="text-[20px] font-bold text-[#111827] dark:text-[#FAFAFA] tracking-tight mt-0.5 leading-snug">
                  {title}
                </h2>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F3F4F6] dark:bg-[#1C1C1E] space-y-1">
              <p className="text-[12px] text-[#737373] dark:text-[#A8A8A8]">
                Signed in as
              </p>
              <p className="text-[14px] font-semibold text-[#111827] dark:text-[#FAFAFA] truncate">
                {currentUser.name}
              </p>
              <p className="text-[12px] font-medium text-[#737373] dark:text-[#A8A8A8] truncate">
                {roleLabel} · {currentUser.email}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[14px] font-semibold text-[#111827] dark:text-[#FAFAFA] leading-snug">
                {message}
              </p>
              <p className="text-[14px] text-[#737373] dark:text-[#A8A8A8] leading-relaxed">
                Admin, Moderator, Staff, and Employer accounts can only be used on a desktop or laptop screen (1024px or wider). Sign out here to continue with an Alumni account.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#8B181B] dark:bg-[#E11D48] hover:bg-[#721316] active:opacity-85 text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-opacity cursor-pointer"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.85} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
