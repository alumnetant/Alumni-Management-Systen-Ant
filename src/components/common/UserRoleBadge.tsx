import React from 'react';
import {
  KeyRound,
  ShieldCheck,
  FileCheck2,
  MessageSquareWarning,
  Briefcase,
  GraduationCap
} from 'lucide-react';
import { UserRole } from '../../types';

interface UserRoleBadgeProps {
  role?: UserRole | string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showIcon?: boolean;
}

export const UserRoleBadge: React.FC<UserRoleBadgeProps> = ({
  role = 'alumni',
  size = 'xs',
  className = '',
  showIcon = true
}) => {
  const normalizedRole = (role || 'alumni').toLowerCase().trim();

  let label = 'Alumnus';
  let colorClasses = 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-semibold';
  let Icon = GraduationCap;

  switch (normalizedRole) {
    case 'superadmin':
      label = 'Super Admin';
      colorClasses = 'bg-purple-900/10 text-purple-900 dark:bg-purple-950/70 dark:text-purple-300 border-purple-300 dark:border-purple-800 font-bold';
      Icon = KeyRound;
      break;
    case 'admin':
    case 'administrator':
      label = 'Administrator';
      colorClasses = 'bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold';
      Icon = ShieldCheck;
      break;
    case 'staff':
    case 'registrar':
      label = 'Staff Officer';
      colorClasses = 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-semibold';
      Icon = FileCheck2;
      break;
    case 'moderator':
      label = 'Moderator';
      colorClasses = 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold';
      Icon = MessageSquareWarning;
      break;
    case 'employer':
      label = 'Employer';
      colorClasses = 'bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-bold';
      Icon = Briefcase;
      break;
    case 'alumni':
    default:
      label = 'Alumnus';
      colorClasses = 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-semibold';
      Icon = GraduationCap;
      break;
  }

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-xs gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-1.5'
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5'
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-md border tracking-wide select-none ${colorClasses} ${sizeClasses} ${className}`}
      title={`Verified role: ${label}`}
    >
      {showIcon && <Icon className={`${iconSizes} shrink-0`} />}
      <span className="truncate">{label}</span>
    </span>
  );
};
