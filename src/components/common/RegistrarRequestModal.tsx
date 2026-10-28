/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  Download,
  X,
  Plus,
  Send,
  Building2,
  Award,
  AlertCircle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlumni } from '../../context/AlumniContext';
import { generateSecureNumericCode } from '../../lib/secureId';

interface DocumentRequest {
  id: string;
  documentType: 'Official Transcript of Records (TOR)' | 'Certificate of Graduation' | 'Diploma Re-issuance' | 'CAV / Red Ribbon Authentication';
  purpose: 'Employment' | 'Board Examination' | 'Graduate Studies' | 'Overseas Visa / Immigration' | 'Personal File';
  requestedAt: string;
  status: 'pending_review' | 'processing' | 'ready_for_pickup' | 'dispatched';
  copies: number;
  notes?: string;
  deliveryMethod: 'Campus Registrar Pickup' | 'Courier Delivery (J&T / LBC)' | 'Digital Certified PDF';
  trackingNumber: string;
}

const STORAGE_KEY_REGISTRAR_REQUESTS = 'scc_alumni_registrar_requests_v1';

export const RegistrarRequestModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { currentUser, showToast } = useAlumni();
  const [activeTab, setActiveTab] = useState<'requests' | 'new'>('requests');

  // Form State
  const [docType, setDocType] = useState<DocumentRequest['documentType']>('Official Transcript of Records (TOR)');
  const [purpose, setPurpose] = useState<DocumentRequest['purpose']>('Employment');
  const [deliveryMethod, setDeliveryMethod] = useState<DocumentRequest['deliveryMethod']>('Campus Registrar Pickup');
  const [copies, setCopies] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Saved Requests
  const [requests, setRequests] = useState<DocumentRequest[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REGISTRAR_REQUESTS);
      if (saved) return JSON.parse(saved);
      return [
        {
          id: 'REQ-2026-0812',
          documentType: 'Official Transcript of Records (TOR)',
          purpose: 'Employment',
          requestedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
          status: 'ready_for_pickup',
          copies: 2,
          deliveryMethod: 'Campus Registrar Pickup',
          trackingNumber: 'SCC-REG-TRK-88219',
          notes: 'Sealed with dry stamp for corporate onboarding'
        },
        {
          id: 'REQ-2026-0741',
          documentType: 'Certificate of Graduation',
          purpose: 'Personal File',
          requestedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
          status: 'dispatched',
          copies: 1,
          deliveryMethod: 'Digital Certified PDF',
          trackingNumber: 'SCC-REG-TRK-74102',
          notes: 'Digitally verified with registrar signature'
        }
      ];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REGISTRAR_REQUESTS, JSON.stringify(requests));
    } catch {}
  }, [requests]);

  if (!isOpen) return null;

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const randomSuffix = generateSecureNumericCode(10000, 99999);
    const newReq: DocumentRequest = {
      id: `REQ-2026-${randomSuffix}`,
      documentType: docType,
      purpose,
      deliveryMethod,
      copies,
      notes: notes.trim() || undefined,
      requestedAt: new Date().toISOString(),
      status: 'pending_review',
      trackingNumber: `SCC-REG-TRK-${randomSuffix}`
    };

    setTimeout(() => {
      setRequests((prev) => [newReq, ...prev]);
      setIsSubmitting(false);
      setActiveTab('requests');
      setNotes('');
      showToast('Document request filed with the Registrar Desk. Tracking ID generated.', 'success');
    }, 600);
  };

  const getStatusBadge = (status: DocumentRequest['status']) => {
    switch (status) {
      case 'ready_for_pickup':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Ready for Pickup
          </span>
        );
      case 'dispatched':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Released / Sent
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Under Evaluation
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
            <Clock className="w-3 h-3 text-stone-500" />
            Pending Verification
          </span>
        );
    }
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
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#8B181B] dark:text-rose-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="editorial-kicker block mb-0.5">OFFICE OF THE REGISTRAR</span>
              <h3 className="editorial-title text-base sm:text-lg font-normal">
                Academic Registrar <span className="editorial-accent italic">& Records Desk</span>
              </h3>
              <p className="editorial-sub text-[11px] sm:text-xs">
                Official Transcripts (TOR), Certifications & Academic Clearances
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

        {/* Tab Controls */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 px-6 pt-3 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'requests'
                ? 'border-[#8B181B] text-[#8B181B] dark:text-rose-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            My Document Requests ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'new'
                ? 'border-[#8B181B] text-[#8B181B] dark:text-rose-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>File New Request</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'requests' ? (
            <div className="space-y-3">
              {requests.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <FileText className="w-10 h-10 text-stone-300 dark:text-stone-600 mx-auto" />
                  <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">No document requests filed yet</p>
                  <p className="text-[11px] text-stone-500">Need your Official Transcript of Records or Graduation Certificate? Submit a request above.</p>
                </div>
              ) : (
                requests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">{req.documentType}</h4>
                          {getStatusBadge(req.status)}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                          Purpose: {req.purpose} • {req.copies} {req.copies === 1 ? 'copy' : 'copies'}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-stone-500 dark:text-stone-400">
                        {new Date(req.requestedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-stone-100 dark:border-stone-800 text-stone-600 dark:text-stone-400">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-stone-400">Tracking:</span>
                        <span className="font-bold text-stone-800 dark:text-stone-200">{req.trackingNumber}</span>
                      </div>
                      <span className="text-[11px]">{req.deliveryMethod}</span>
                    </div>

                    {req.notes && (
                      <p className="text-[11px] text-stone-500 italic bg-stone-50 dark:bg-stone-800/60 p-2 rounded-lg">
                        "{req.notes}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Academic records are processed directly by the Office of the Registrar, St. Cecilia’s College - Cebu, Inc. Standard processing turnaround is 3 to 5 working days.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Document Type *
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-medium text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#8B181B]"
                >
                  <option value="Official Transcript of Records (TOR)">Official Transcript of Records (TOR)</option>
                  <option value="Certificate of Graduation">Certificate of Graduation</option>
                  <option value="Diploma Re-issuance">Diploma Re-issuance / Official Duplicate</option>
                  <option value="CAV / Red Ribbon Authentication">CAV / Red Ribbon Authentication (CHED / DFA)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Purpose of Request *
                  </label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-medium text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#8B181B]"
                  >
                    <option value="Employment">Employment Onboarding</option>
                    <option value="Board Examination">PRC Board Examination</option>
                    <option value="Graduate Studies">Post-Graduate / Masteral Studies</option>
                    <option value="Overseas Visa / Immigration">Overseas Visa / Immigration</option>
                    <option value="Personal File">Personal Academic Archive</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Number of Copies
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={copies}
                    onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-medium text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#8B181B]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Delivery / Issuance Method *
                </label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-medium text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#8B181B]"
                >
                  <option value="Campus Registrar Pickup">Physical Pickup at Registrar Window, Minglanilla Campus</option>
                  <option value="Digital Certified PDF">Digitally Signed & QR-Secured PDF Copy</option>
                  <option value="Courier Delivery (J&T / LBC)">Courier Delivery to Registered Home Address</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Special Instructions or Target Institution (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please address envelope to Human Resources Department or include dry seal on all transcript pages."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs font-medium text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#8B181B] resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Filing Request...' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
