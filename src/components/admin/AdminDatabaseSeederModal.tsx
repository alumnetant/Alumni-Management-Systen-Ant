/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Megaphone,
  Briefcase,
  Layers,
  ImageIcon,
  X,
  Trash2,
  Sparkles,
  CloudLightning,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  populateAllCoreFeaturesSampleData,
  purgeFirestoreSampleData,
  SeederProgress
} from '../../services/databaseSampleSeederService';
import { useAlumni } from '../../context/AlumniContext';

interface AdminDatabaseSeederModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDatabaseSeederModal: React.FC<AdminDatabaseSeederModalProps> = ({
  isOpen,
  onClose
}) => {
  const { showToast, triggerBackgroundSync } = useAlumni();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [progress, setProgress] = useState<SeederProgress | null>(null);
  const [completedSummary, setCompletedSummary] = useState<Record<string, number> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePopulate = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    setCompletedSummary(null);
    setProgress({
      featureName: 'Connecting to Cloud Firestore...',
      completed: 0,
      total: 250,
      percent: 5
    });

    try {
      const result = await populateAllCoreFeaturesSampleData((prog) => {
        setProgress(prog);
      });

      setCompletedSummary(result.summary);
      showToast('Successfully populated 250 records to Cloud Firestore across all core features.', 'success');

      // Trigger reactive background sync so the UI immediately pulls fresh Firestore docs
      await triggerBackgroundSync();
    } catch (err: any) {
      console.error('Seeder execution error:', err);
      setErrorMsg(err?.message || 'Failed to populate database sample data. Please check network connectivity.');
      showToast('Database write operation encountered an error.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurge = async () => {
    if (!window.confirm('Are you sure you want to purge all generated sample records from Firestore? Real user accounts and manual posts will not be affected.')) {
      return;
    }

    setIsPurging(true);
    setErrorMsg(null);
    try {
      const res = await purgeFirestoreSampleData();
      showToast(`Purged ${res.totalPurged} sample documents from Cloud Firestore.`, 'info');
      setCompletedSummary(null);
      setProgress(null);
      await triggerBackgroundSync();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to purge sample records.');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-[#8B181B] dark:text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 tracking-tight">
                Firestore Database Sample Data Manager
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                St. Cecilia’s College Cloud Database • 50 Authentic Records per Core Feature
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing || isPurging}
            className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Information Notice */}
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/60">
            <div className="flex items-start gap-3">
              <CloudLightning className="w-4 h-4 text-[#8B181B] dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                <span className="font-semibold text-stone-900 dark:text-stone-100">Direct Database Insertion: </span>
                This action writes 250 realistic documents directly into your live Firestore collections using chunked batch writes.
                No mock data is hardcoded into the client codebase. The portal reactively streams updates in real time.
              </div>
            </div>
          </div>

          {/* Core Feature Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-stone-200/70 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100">Alumni Events</h4>
                  <p className="text-[11px] text-stone-500">Reunions, summits & galas</p>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-stone-700 dark:text-stone-300">50 items</span>
            </div>

            <div className="p-3.5 rounded-xl border border-stone-200/70 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100">Announcements</h4>
                  <p className="text-[11px] text-stone-500">Accreditations & bulletins</p>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-stone-700 dark:text-stone-300">50 items</span>
            </div>

            <div className="p-3.5 rounded-xl border border-stone-200/70 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100">Career Opportunities</h4>
                  <p className="text-[11px] text-stone-500">Tech, business & education jobs</p>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-stone-700 dark:text-stone-300">50 items</span>
            </div>

            <div className="p-3.5 rounded-xl border border-stone-200/70 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100">Institutional Feed</h4>
                  <p className="text-[11px] text-stone-500">Milestones & community posts</p>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-stone-700 dark:text-stone-300">50 items</span>
            </div>

            <div className="p-3.5 rounded-xl border border-stone-200/70 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between sm:col-span-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-[#8B181B] dark:text-rose-400 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100">Campus & Archival Gallery</h4>
                  <p className="text-[11px] text-stone-500">Campus landmarks, commencement, and alumni achievements</p>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-stone-700 dark:text-stone-300">50 items</span>
            </div>
          </div>

          {/* Progress Bar Display */}
          {(isProcessing || progress) && (
            <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-stone-700 dark:text-stone-300 flex items-center gap-2">
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8B181B]" />}
                  {progress?.featureName || 'Processing Firestore batch...'}
                </span>
                <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                  {progress?.percent || 0}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                <motion.div
                  className="h-full bg-[#8B181B] dark:bg-amber-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress?.percent || 0}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-stone-500">
                <span>Completed: {progress?.completed || 0} / {progress?.total || 250} docs</span>
                <span>Firestore Batch Commit</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Summary */}
          {completedSummary && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                  250 Sample Records Live in Cloud Firestore
                </h4>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  All 5 core features now have 50 live documents each. The portal interface has synchronized the changes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/30">
          <button
            onClick={handlePurge}
            disabled={isProcessing || isPurging}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-600 hover:text-red-600 dark:text-stone-400 dark:hover:text-red-400 transition-colors disabled:opacity-50"
            title="Reset generated sample records"
          >
            {isPurging ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>Reset Sample Data</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePopulate}
              disabled={isProcessing || isPurging}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#8B181B] hover:bg-[#721316] active:scale-[0.98] rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Writing to Firestore...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Populate Live Database (250 Records)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
