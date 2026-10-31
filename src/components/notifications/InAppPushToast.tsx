/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * In-App Push Notification Toast
 * Renders incoming foreground notifications with deep-link navigation
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ArrowRight, ShieldCheck, Calendar, Megaphone, CheckCircle2 } from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { triggerHaptic } from '../../services/hapticsService';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  route?: string;
  tag?: string;
  data?: Record<string, any>;
}

export const InAppPushToast: React.FC = () => {
  const { setActiveTab } = useAlumni();
  const [notification, setNotification] = useState<PushNotificationPayload | null>(null);

  useEffect(() => {
    const handlePushReceived = (event: CustomEvent<PushNotificationPayload>) => {
      triggerHaptic('medium');
      setNotification(event.detail);
    };

    window.addEventListener('applet:fcm-push-received', handlePushReceived as EventListener);
    return () => {
      window.removeEventListener('applet:fcm-push-received', handlePushReceived as EventListener);
    };
  }, []);

  // Auto-dismiss after 7 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [notification]);

  if (!notification) return null;

  const handleNavigate = () => {
    triggerHaptic('light');
    const targetRoute = notification.route || notification.data?.route;

    if (targetRoute) {
      if (targetRoute === 'announcements' || targetRoute === 'events' || targetRoute === 'opportunities' || targetRoute === 'network' || targetRoute === 'profile') {
        setActiveTab(targetRoute as any);
      } else if (targetRoute.includes('announcement')) {
        setActiveTab('announcements');
      } else if (targetRoute.includes('event')) {
        setActiveTab('events');
      } else if (targetRoute.includes('employer') || targetRoute.includes('accreditation')) {
        setActiveTab('profile');
      }
    } else {
      setActiveTab('dashboard');
    }

    setNotification(null);
  };

  const getNotificationIcon = () => {
    const tag = (notification.tag || notification.data?.type || '').toLowerCase();
    if (tag.includes('event')) return <Calendar className="w-5 h-5 text-amber-600" />;
    if (tag.includes('announcement') || tag.includes('circular')) return <Megaphone className="w-5 h-5 text-rose-600" />;
    if (tag.includes('accreditation') || tag.includes('approved')) return <ShieldCheck className="w-5 h-5 text-emerald-600" />;
    return <Bell className="w-5 h-5 text-[#8B181B]" />;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 pointer-events-auto select-none"
      >
        <div
          onClick={handleNavigate}
          className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-4 shadow-xl hover:shadow-2xl transition-all cursor-pointer flex items-start gap-3.5 group relative overflow-hidden"
        >
          {/* Accent top stripe */}
          <div className="h-1 bg-gradient-to-r from-[#8B181B] to-amber-600 absolute top-0 left-0 right-0" />

          {/* Icon Badge */}
          <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0 mt-0.5">
            {getNotificationIcon()}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pr-6 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#8B181B] dark:text-rose-400 uppercase tracking-wider">
              <span>{notification.tag || 'St. Cecilia Notification'}</span>
            </div>

            <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white leading-snug line-clamp-1 group-hover:text-[#8B181B] transition-colors">
              {notification.title}
            </h4>

            <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2 leading-relaxed">
              {notification.body}
            </p>

            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#8B181B] dark:text-rose-400 pt-1 group-hover:underline">
              <span>Tap to view details</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setNotification(null);
            }}
            className="absolute top-2.5 right-2.5 p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
