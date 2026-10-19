import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  UserCheck,
  CheckCircle2,
  Barcode,
  RotateCcw,
  Calendar,
  MapPin,
  Users,
  Check,
  Clock,
  Sparkles,
  AlertCircle,
  Volume2,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { AlumniEvent, EventAttendee } from '../../types';
import { getUserAvatar, handleUserAvatarError } from '../../lib/defaultImages';

interface EventCheckInModalProps {
  event: AlumniEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EventCheckInModal: React.FC<EventCheckInModalProps> = ({
  event,
  isOpen,
  onClose
}) => {
  const { manualCheckInAttendee, showToast, users, clientPlatform } = useAlumni();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'checked_in'>('all');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [recentlyCheckedIn, setRecentlyCheckedIn] = useState<EventAttendee | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const lastScannedTimeRef = useRef<number>(0);

  // Auto-focus barcode input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Synthesized Web Audio confirmation chime
  const playAudioBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {
      // AudioContext unavailable in silent context
    }
  }, []);

  // If modal is closed or no event, return null
  if (!isOpen || !event) return null;

  const attendees: EventAttendee[] = event.attendees || [];
  const totalAttendees = attendees.length;
  const checkedInCount = attendees.filter((a) => a.checkInStatus === 'checked_in').length;
  const pendingCount = Math.max(0, totalAttendees - checkedInCount);
  const attendanceRate = totalAttendees > 0 ? Math.round((checkedInCount / totalAttendees) * 100) : 0;

  // Process a scanned or typed code
  const processCheckInCode = (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;

    // Throttle repeated triggers within 1.5 seconds
    const now = Date.now();
    if (now - lastScannedTimeRef.current < 1500) {
      return;
    }

    const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Search attendee
    const matched = attendees.find((att) => {
      const matchUid = att.uid && att.uid.toLowerCase() === trimmed.toLowerCase();
      const matchId = att.id && att.id.toLowerCase() === trimmed.toLowerCase();
      const matchStudentId = att.studentId && att.studentId.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized;
      const matchEmail = att.email && att.email.toLowerCase() === trimmed.toLowerCase();

      // Check linked user profile if available
      const linkedUser = users.find((u) => u.uid === att.uid);
      const matchUserStudentId = linkedUser?.studentId && linkedUser.studentId.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized;
      const matchAlumniId = linkedUser?.alumniId && linkedUser.alumniId.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized;

      // Check registration code / Pass Code payload prefix (e.g., SCC-PASS-...)
      const cleanPassCode = trimmed.replace(/^scc-pass-/i, '').toLowerCase();
      const matchRegistration = att.registrationCode && att.registrationCode.toLowerCase() === cleanPassCode;

      return matchUid || matchId || matchStudentId || matchEmail || matchUserStudentId || matchAlumniId || matchRegistration;
    });

    if (matched) {
      lastScannedTimeRef.current = now;
      playAudioBeep();
      manualCheckInAttendee(event.id, matched.uid || matched.id, true);
      setRecentlyCheckedIn(matched);
      setBarcodeInput('');
      showToast(`Verified & Checked In: ${matched.name}`, 'success');

      setTimeout(() => {
        setRecentlyCheckedIn(null);
        barcodeInputRef.current?.focus();
      }, 3500);
    } else {
      showToast(`No registered attendee found for code "${trimmed}". Use roster search below.`, 'error');
    }
  };

  // Form submit for Barcode / ID Input
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCheckInCode(barcodeInput);
  };

  // Filter attendees by search term and status
  const filteredAttendees = useMemo(() => {
    return attendees.filter((att) => {
      const isCheckedIn = att.checkInStatus === 'checked_in';
      if (statusFilter === 'checked_in' && !isCheckedIn) return false;
      if (statusFilter === 'pending' && isCheckedIn) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const nameMatch = att.name.toLowerCase().includes(q);
      const emailMatch = att.email ? att.email.toLowerCase().includes(q) : false;
      const studentIdMatch = att.studentId ? att.studentId.toLowerCase().includes(q) : false;
      const courseMatch = att.course ? att.course.toLowerCase().includes(q) : false;
      const batchMatch = att.batch ? String(att.batch).toLowerCase().includes(q) : false;

      return nameMatch || emailMatch || studentIdMatch || courseMatch || batchMatch;
    });
  }, [attendees, searchQuery, statusFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/70 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850/60 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#8B181B]/10 text-[#8B181B] dark:bg-rose-950/60 dark:text-rose-300 border border-[#8B181B]/20 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[#8B181B] dark:text-rose-300" />
                Attendee Check-In Console
              </span>
              <span className="text-xs text-stone-400">•</span>
              <span className="text-[10px] font-mono font-bold text-stone-500 uppercase px-2 py-0.5 bg-stone-200/60 dark:bg-stone-800 rounded-md">
                Platform: {clientPlatform === 'mobile' ? 'Mobile App' : 'Web Portal'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white truncate">
              {event.title}
            </h2>
            <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                {event.startDate ? new Date(event.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-stone-400" />
                {event.location}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-xl hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Close Check-In Console"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Attendance Stats Strip */}
        <div className="p-4 bg-stone-100/60 dark:bg-stone-950/40 border-b border-stone-200 dark:border-stone-800">
          <div className="grid grid-cols-3 gap-3 mb-2.5">
            <div className="bg-white dark:bg-stone-850 p-2.5 rounded-xl border border-stone-200/80 dark:border-stone-750 text-center shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                Total RSVPs
              </span>
              <span className="text-base font-extrabold text-stone-900 dark:text-white">
                {totalAttendees}
              </span>
            </div>
            <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                Checked In
              </span>
              <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-200">
                {checkedInCount}
              </span>
            </div>
            <div className="bg-white dark:bg-stone-850 p-2.5 rounded-xl border border-stone-200/80 dark:border-stone-750 text-center shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                Pending
              </span>
              <span className="text-base font-extrabold text-stone-700 dark:text-stone-300">
                {pendingCount}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 font-mono">
              {attendanceRate}% Check-In Rate
            </span>
          </div>
        </div>

        {/* Handheld Barcode / Student ID / Pass Code Input Field */}
        <div className="px-4 py-3 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan barcode / swipe reader or enter Student ID, Pass Code, or Email..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/40 focus:border-[#8B181B] dark:text-white placeholder:text-stone-400 font-mono"
              />
              {barcodeInput && (
                <button
                  type="button"
                  onClick={() => setBarcodeInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Verify & Check In</span>
            </button>
          </form>

          {/* Quick-Verify Testing Chips */}
          {attendees.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center gap-1.5 overflow-x-auto text-[10px] text-stone-400 pb-0.5">
              <span className="font-bold uppercase tracking-wider text-stone-400 shrink-0">
                Quick Verify:
              </span>
              <div className="flex items-center gap-1">
                {attendees.slice(0, 5).map((att) => {
                  const isAttended = att.checkInStatus === 'checked_in';
                  return (
                    <button
                      key={att.uid || att.id}
                      type="button"
                      onClick={() => processCheckInCode(att.studentId || att.uid || att.id)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors cursor-pointer shrink-0 border ${
                        isAttended
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-200'
                      }`}
                      title={`Click to check in ${att.name}`}
                    >
                      {att.name.split(' ')[0]} {att.studentId ? `(${att.studentId})` : ''}
                      {isAttended && ' ✓'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Recently Verified Flash Card Banner */}
        {recentlyCheckedIn && (
          <div className="mx-4 mt-3 p-3 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>Verified & Successfully Checked In</span>
              </div>
              <div className="text-xs font-bold truncate mt-0.5">{recentlyCheckedIn.name}</div>
              <div className="text-[10px] text-emerald-100 font-mono">
                {recentlyCheckedIn.studentId ? `Student ID: ${recentlyCheckedIn.studentId}` : recentlyCheckedIn.email}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRecentlyCheckedIn(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-emerald-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Attendee Roster & Search View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search and Filters */}
          <div className="p-4 bg-stone-50/60 dark:bg-stone-850/60 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search attendee by name, student ID, program, or batch..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#8B181B] dark:text-white"
              />
            </div>

            <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-2xs'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                All ({attendees.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-white dark:bg-stone-700 text-amber-700 dark:text-amber-300 shadow-2xs'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('checked_in')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                  statusFilter === 'checked_in'
                    ? 'bg-white dark:bg-stone-700 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Checked In ({checkedInCount})
              </button>
            </div>
          </div>

          {/* Attendee Roster List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredAttendees.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200/80 dark:border-stone-800">
                <Users className="w-8 h-8 text-stone-300 dark:text-stone-600 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  No registered attendees found
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                  {searchQuery
                    ? `No attendees match "${searchQuery}". Try searching by name or student ID.`
                    : 'No attendees in this filter.'}
                </p>
              </div>
            ) : (
              filteredAttendees.map((att) => {
                const attId = att.uid || att.id;
                const isCheckedIn = att.checkInStatus === 'checked_in';

                return (
                  <div
                    key={attId}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isCheckedIn
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-850'
                        : 'bg-stone-50/70 dark:bg-stone-850/60 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={getUserAvatar(att.avatarUrl || att.avatar)}
                        alt={att.name}
                        onError={handleUserAvatarError}
                        className="w-10 h-10 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-stone-900 dark:text-white truncate">
                            {att.name}
                          </span>
                          {att.studentId && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-stone-200 dark:bg-stone-750 text-stone-700 dark:text-stone-300">
                              {att.studentId}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate flex items-center gap-1.5 mt-0.5">
                          {att.batch && <span>Batch {att.batch}</span>}
                          {att.batch && att.course && <span>•</span>}
                          {att.course && <span>{att.course}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isCheckedIn ? (
                        <div className="flex items-center gap-2">
                          <div className="text-right hidden sm:block">
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 justify-end">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Attended
                            </span>
                            {att.checkedInAt && (
                              <span className="text-[9px] text-stone-400 dark:text-stone-500 block font-mono">
                                {new Date(att.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => manualCheckInAttendee(event.id, attId, false)}
                            className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-600 dark:text-stone-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Undo check-in"
                          >
                            <RotateCcw className="w-3 h-3 text-stone-500" />
                            <span className="hidden sm:inline">Undo</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => manualCheckInAttendee(event.id, attId, true)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Check In</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-850/60 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Fast attendee roster lookup and barcode check-in enabled across all platforms.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-750 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl font-bold cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
