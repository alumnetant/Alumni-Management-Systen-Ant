import React from 'react';
import { useAlumni } from '../../context/AlumniContext';
import { PlatformType } from '../../types';

interface PlatformOnlyProps {
  client: PlatformType;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * PlatformOnly Guard Component:
 * Conditionally renders children only when the current runtime/session client matches
 * the specified platform ('mobile' | 'web'). If not matching, renders optional fallback.
 */
export const PlatformOnly: React.FC<PlatformOnlyProps> = ({
  client,
  fallback = null,
  children
}) => {
  const { clientPlatform } = useAlumni();

  if (clientPlatform === client) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

/**
 * Custom hook to access current platform state
 */
export function usePlatform() {
  const { clientPlatform } = useAlumni();
  return {
    clientPlatform,
    isMobile: clientPlatform === 'mobile',
    isWeb: clientPlatform === 'web'
  };
}
