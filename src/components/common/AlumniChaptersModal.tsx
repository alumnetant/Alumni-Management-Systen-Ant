/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Globe,
  MapPin,
  Users,
  Building2,
  Mail,
  ChevronRight,
  X,
  Compass,
  CheckCircle2,
  ShieldCheck,
  Send
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAlumni } from '../../context/AlumniContext';

interface ChapterInfo {
  id: string;
  name: string;
  region: string;
  leadName: string;
  leadEmail: string;
  memberCount: number;
  establishedYear: string;
  description: string;
}

const CHAPTERS_LIST: ChapterInfo[] = [
  {
    id: 'chap_cebu_metro',
    name: 'Cebu Metropolitan & South Hub Chapter',
    region: 'Minglanilla, Talisay & Cebu City, Philippines',
    leadName: 'Engr. Julian Marc Villareal',
    leadEmail: 'cebumetro.chapter@alumni.stcecilia.edu.ph',
    memberCount: 420,
    establishedYear: '2012',
    description: 'The founding regional chapter coordinating annual homecomings, community service, and campus mentorship.'
  },
  {
    id: 'chap_ncr',
    name: 'National Capital Region (Metro Manila) Chapter',
    region: 'BGC, Makati & Ortigas, Metro Manila',
    leadName: 'Atty. Celeste Marie Mendoza',
    leadEmail: 'ncr.chapter@alumni.stcecilia.edu.ph',
    memberCount: 165,
    establishedYear: '2016',
    description: 'Connecting Cecilian corporate leaders, legal professionals, and software engineers working across Metro Manila.'
  },
  {
    id: 'chap_singapore',
    name: 'Singapore & Southeast Asia Chapter',
    region: 'Singapore & ASEAN Regional Tech Hubs',
    leadName: 'Arch. Kevin D. Tan',
    leadEmail: 'singapore.chapter@alumni.stcecilia.edu.ph',
    memberCount: 88,
    establishedYear: '2019',
    description: 'Overseas network supporting Cecilian software architects, financial analysts, and healthcare specialists in Singapore.'
  },
  {
    id: 'chap_gcc',
    name: 'Middle East & GCC Cecilians Chapter',
    region: 'Dubai, UAE & Riyadh, Kingdom of Saudi Arabia',
    leadName: 'Dr. Maria Elena Santos, RN',
    leadEmail: 'gcc.chapter@alumni.stcecilia.edu.ph',
    memberCount: 114,
    establishedYear: '2017',
    description: 'A vibrant diaspora community organizing medical missions, overseas fellowships, and disaster relief drives.'
  },
  {
    id: 'chap_na',
    name: 'North America & Canadian Chapter',
    region: 'California, Texas, and Ontario, Canada',
    leadName: 'Mr. Ronald P. Garcia',
    leadEmail: 'na.chapter@alumni.stcecilia.edu.ph',
    memberCount: 72,
    establishedYear: '2021',
    description: 'Fostering lifelong Cecilian camaraderie across North America and supporting the Centennial Scholar Endowment Fund.'
  }
];

export const AlumniChaptersModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { showToast } = useAlumni();
  const [selectedChapter, setSelectedChapter] = useState<ChapterInfo>(CHAPTERS_LIST[0]);
  const [hasJoined, setHasJoined] = useState<Record<string, boolean>>({ chap_cebu_metro: true });

  if (!isOpen) return null;

  const handleToggleJoin = (id: string, name: string) => {
    setHasJoined((prev) => {
      const next = !prev[id];
      showToast(next ? `Affiliated with ${name}.` : `Affiliation updated.`, 'info');
      return { ...prev, [id]: next };
    });
  };

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
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-[#8B181B] dark:text-amber-400 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                Alumni Chapters & Regional Diaspora
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                St. Cecilia's College Global Network • 5 Official Regional Chapters
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
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/60 text-xs text-stone-600 dark:text-stone-300 flex items-start gap-2.5">
            <Compass className="w-4 h-4 text-[#8B181B] dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Connect with fellow Cecilians in your geographical area. Regional chapters organize local networking socials, professional symposiums, and scholarship drives for your alma mater.
            </p>
          </div>

          <div className="space-y-3">
            {CHAPTERS_LIST.map((chap) => {
              const joined = Boolean(hasJoined[chap.id]);
              return (
                <div
                  key={chap.id}
                  className="p-4 rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">{chap.name}</h4>
                        {joined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            My Chapter
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-stone-400" />
                        <span>{chap.region}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleJoin(chap.id, chap.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        joined
                          ? 'border border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800'
                          : 'bg-[#8B181B] hover:bg-[#721316] text-white shadow-2xs'
                      }`}
                    >
                      {joined ? 'Affiliated' : 'Join Chapter'}
                    </button>
                  </div>

                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    {chap.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400 gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 font-mono">
                        <Users className="w-3.5 h-3.5 text-stone-400" />
                        <span>{chap.memberCount} Cecilians</span>
                      </span>
                      <span>Est. {chap.establishedYear}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-stone-600 dark:text-stone-300">
                      <span>Lead: <strong>{chap.leadName}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
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
