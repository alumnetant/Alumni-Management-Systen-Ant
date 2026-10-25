/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ShieldCheck,
  Award,
  BookOpen,
  FileText,
  X,
  ExternalLink,
  GraduationCap,
  Heart,
  Landmark,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';

export const InstitutionalGovernanceModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#8B181B] dark:text-rose-400 flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <span className="editorial-kicker block mb-0.5">ACCREDITATION & CHARTER</span>
              <h3 className="editorial-title text-base sm:text-lg font-normal">
                Institutional Governance <span className="editorial-accent italic">& Standards</span>
              </h3>
              <p className="editorial-sub text-[11px] sm:text-xs">
                St. Cecilia's College - Cebu, Inc. · Accreditations & Association Charter
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Card 1: Accreditation */}
          <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 space-y-2.5">
            <div className="flex items-center gap-2 text-[#8B181B] dark:text-rose-400">
              <Award className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Quality Accreditations & Standards</h4>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              St. Cecilia's College programs are accredited by PACUCOA (Philippine Association of Colleges and Universities Commission on Accreditation) Level III and recognized by the Commission on Higher Education (CHED) as a Center of Development in Information Technology.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>BSIT: PACUCOA Level III</span>
              </div>
              <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>BSED: PACUCOA Level II</span>
              </div>
              <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>BSBA: Level II Reaccredited</span>
              </div>
              <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>BS Criminology: PRC Topnotcher Tier</span>
              </div>
            </div>
          </div>

          {/* Card 2: Constitution & Bylaws */}
          <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-2.5">
            <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100">
              <BookOpen className="w-4 h-4 text-stone-600 dark:text-stone-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Alumni Association Charter</h4>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              The St. Cecilia's College Global Alumni Association operates under an independent SEC-registered charter dedicated to fostering academic excellence, fellowship, and student scholarship endowments.
            </p>
            <div className="flex items-center gap-3 text-xs text-[#8B181B] dark:text-rose-400 font-semibold pt-1">
              <span>Ratified: General Assembly 2024</span>
              <span>•</span>
              <span>Term of Directorate: 2 Years</span>
            </div>
          </div>

          {/* Card 3: Centennial Endowment */}
          <div className="p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 space-y-2">
            <div className="flex items-center gap-2 text-[#8B181B] dark:text-rose-400">
              <Heart className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Centennial Scholar Endowment Fund</h4>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Alumni donations directly sponsor tuition grants, laboratory equipment, and emergency student stipends. Over 120 deserving undergraduate Cecilian scholars are funded annually.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
