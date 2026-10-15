/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Search,
  Trash2,
  Copy,
  Check,
  Upload,
  Download,
  UserPlus,
  FileSpreadsheet,
  FileDown,
  X,
  Plus
} from 'lucide-react';
import { StudentVerificationRecord } from '../../types';
import {
  getRegistrarRecords,
  deleteRegistrarRecord,
  syncRegistrarRecordsWithFirestore,
  exportRegistryRecordsToCsv,
  addRegistrarRecords,
  downloadSampleCsvTemplate,
  isValidStudentIdPattern,
  normalizeStudentId
} from '../../services/studentVerificationService';
import { CsvStudentBulkImporter } from './CsvStudentBulkImporter';
import { useAlumni } from '../../context/AlumniContext';

export const RegistrarRegistryMatcher: React.FC = () => {
  const { users, currentUser, showToast, addAuditLog, setSelectedUserIdForModal } = useAlumni();

  const [records, setRecords] = useState<StudentVerificationRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'registered' | 'pending' | 'honors'>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'batch_desc' | 'batch_asc' | 'name_asc' | 'id_asc'>('batch_desc');
  const [recordsVisibleCount, setRecordsVisibleCount] = useState<number>(25);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');

  // Modals for CSV Import and Manual Accreditation
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAccreditModalOpen, setIsAccreditModalOpen] = useState(false);
  const [accreditForm, setAccreditForm] = useState({
    studentId: '',
    fullName: '',
    batchYear: new Date().getFullYear().toString(),
    course: 'B.S. Information Technology',
    email: '',
    honors: ''
  });

  // Load records on mount & sync registration status with registered users
  const refreshRecords = () => {
    setIsRefreshing(true);
    const loaded = getRegistrarRecords();

    // Map against currently registered users to reflect real-time auto-registration links
    const synced = loaded.map((rec) => {
      const matchedUser = users.find(
        (u) =>
          (u.studentId && rec.studentId && u.studentId.toUpperCase() === rec.studentId.toUpperCase()) ||
          (rec.email && u.email && u.email.toLowerCase() === rec.email.toLowerCase())
      );

      if (matchedUser) {
        return {
          ...rec,
          isRegistered: true,
          matchedUid: matchedUser.uid,
          registeredAt: rec.registeredAt || matchedUser.createdAt
        };
      }
      return rec;
    });

    setRecords(synced);
    setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setTimeout(() => setIsRefreshing(false), 300);
  };

  useEffect(() => {
    syncRegistrarRecordsWithFirestore().then(() => {
      refreshRecords();
    });
  }, [users]);

  // Delete individual record
  const handleDelete = (id: string, name: string) => {
    if (confirm(`Remove ${name} (${id}) from the official graduate registry?`)) {
      deleteRegistrarRecord(id);
      refreshRecords();

      addAuditLog({
        action: 'REGISTRY_RECORD_DELETED',
        actorId: currentUser?.uid || 'registrar',
        actorName: currentUser?.name || 'Registrar Staff',
        actorRole: currentUser?.role || 'registrar',
        category: 'registry_masterlist',
        details: `Deleted student record ${id} (${name}) from the official graduate masterlist.`,
        severity: 'warning'
      });

      showToast(`Record ${id} removed from official registry.`, 'info');
    }
  };



  // Export current records to CSV
  const handleExportCsv = () => {
    const recordsToExport = filteredRecords.length > 0 ? filteredRecords : records;
    if (recordsToExport.length === 0) {
      showToast('No student records available to export.', 'warning');
      return;
    }
    exportRegistryRecordsToCsv(recordsToExport);
    showToast(`Exported ${recordsToExport.length} student records to CSV!`, 'success');
    addAuditLog({
      action: 'REGISTRY_ROSTER_EXPORTED',
      actorId: currentUser?.uid || 'registrar',
      actorName: currentUser?.name || 'Registrar Staff',
      actorRole: currentUser?.role || 'registrar',
      category: 'registry_masterlist',
      details: `Exported ${recordsToExport.length} official student records to CSV spreadsheet.`,
      severity: 'info'
    });
  };

  // Add individual student record
  const handleAccreditStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const normId = normalizeStudentId(accreditForm.studentId).toUpperCase();
    if (!normId) {
      showToast('Please enter a valid Student ID.', 'error');
      return;
    }
    if (!accreditForm.fullName.trim()) {
      showToast('Student Full Name is required.', 'error');
      return;
    }

    addRegistrarRecords(
      [
        {
          studentId: normId,
          fullName: accreditForm.fullName.trim(),
          batchYear: accreditForm.batchYear.trim() || '2024',
          course: accreditForm.course.trim(),
          email: accreditForm.email.trim() || undefined,
          honors: accreditForm.honors.trim() || undefined,
          status: 'Graduated',
          isRegistered: false
        }
      ],
      currentUser?.name || 'Registrar Staff',
      'manual_accreditation'
    );

    refreshRecords();
    setIsAccreditModalOpen(false);
    setAccreditForm({
      studentId: '',
      fullName: '',
      batchYear: new Date().getFullYear().toString(),
      course: 'B.S. Information Technology',
      email: '',
      honors: ''
    });

    addAuditLog({
      action: 'STUDENT_MANUALLY_ACCREDITED',
      actorId: currentUser?.uid || 'registrar',
      actorName: currentUser?.name || 'Registrar Staff',
      actorRole: currentUser?.role || 'registrar',
      category: 'registry_masterlist',
      details: `Accredited student ${normId} (${accreditForm.fullName}) into the official registry.`,
      severity: 'info'
    });

    showToast(`Successfully accredited ${accreditForm.fullName} (${normId})!`, 'success');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1800);
    showToast(`Copied Student ID ${text}`);
  };

  // Unique batches for filter dropdown & cohort matrix
  const batches: string[] = useMemo(() => {
    return Array.from<string>(
      new Set<string>(records.map((r) => r.batchYear).filter((b): b is string => Boolean(b)))
    ).sort((a: string, b: string) => parseInt(b, 10) - parseInt(a, 10));
  }, [records]);

  // Unique courses for filter dropdown
  const courses: string[] = useMemo(() => {
    return Array.from<string>(
      new Set<string>(records.map((r) => r.course).filter((c): c is string => Boolean(c)))
    ).sort();
  }, [records]);



  // Filtered and sorted records
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          (r.studentId && r.studentId.toLowerCase().includes(q)) ||
          (r.fullName && r.fullName.toLowerCase().includes(q)) ||
          (r.batchYear && r.batchYear.toLowerCase().includes(q)) ||
          (r.course && r.course.toLowerCase().includes(q)) ||
          (r.email && r.email.toLowerCase().includes(q));

        const matchesBatch = selectedBatch === 'all' || r.batchYear === selectedBatch;
        const matchesStatus =
          selectedStatus === 'all' ||
          (selectedStatus === 'registered' && r.isRegistered) ||
          (selectedStatus === 'pending' && !r.isRegistered) ||
          (selectedStatus === 'honors' && Boolean(r.honors));
        const matchesCourse = selectedCourse === 'all' || r.course === selectedCourse;

        return matchesSearch && matchesBatch && matchesStatus && matchesCourse;
      })
      .sort((a, b) => {
        if (sortBy === 'batch_desc') {
          return parseInt(b.batchYear || '0', 10) - parseInt(a.batchYear || '0', 10);
        }
        if (sortBy === 'batch_asc') {
          return parseInt(a.batchYear || '0', 10) - parseInt(b.batchYear || '0', 10);
        }
        if (sortBy === 'name_asc') {
          return (a.fullName || '').localeCompare(b.fullName || '');
        }
        if (sortBy === 'id_asc') {
          return (a.studentId || '').localeCompare(b.studentId || '');
        }
        return 0;
      });
  }, [records, searchQuery, selectedBatch, selectedStatus, selectedCourse, sortBy]);



  return (
    <div className="w-full space-y-6 antialiased">
      {/* ========================================================
          1. TOP ARCHIVAL HEADER & CSV ACTION
          ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight font-sans">
            Registrar Registry
          </h1>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            St. Cecilia's College • Masterlist & Instant Matching Engine
          </p>
        </div>

        {/* Action Toolbar with Upload CSV */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="registrar-upload-csv-btn"
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            title="Upload and bulk-import student records from CSV or Excel file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload / Import CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export accredited roster to CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          2. MASTER ROSTER DATA LEDGER
          ======================================================== */}
      <div className="bg-white rounded-[32px] border border-stone-200/90 shadow-2xs overflow-hidden">
        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200 text-[11px] tracking-wide">
              <tr>
                <th className="py-3 px-4 pl-6">Student ID</th>
                <th className="py-3 px-4">Graduate Full Name</th>
                <th className="py-3 px-4">Degree & Academic Program</th>
                <th className="py-3 px-4">Cohort</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-stone-500">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-[#8B181B] mx-auto mb-3 shadow-2xs">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <p className="text-base font-bold text-stone-900">No Student Records Found</p>
                    <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto mb-5 leading-relaxed">
                      {records.length === 0
                        ? 'The official graduate registry is currently empty. Upload your student masterlist CSV or Excel spreadsheet to begin automated registration matching.'
                        : 'No records matched your search query or cohort filters. Try resetting filters or uploading a new spreadsheet batch.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsImportModalOpen(true)}
                        className="px-4 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Student CSV / Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={downloadSampleCsvTemplate}
                        className="px-3.5 py-2 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileDown className="w-3.5 h-3.5 text-stone-500" />
                        <span>Download Sample CSV</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.slice(0, recordsVisibleCount).map((record) => {
                  const isReg = record.isRegistered;

                  return (
                    <tr key={record.studentId} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 pl-6">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200/80">
                            {record.studentId}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(record.studentId)}
                            title="Copy Student ID"
                            className="text-stone-400 hover:text-stone-700 p-1 rounded transition-colors cursor-pointer"
                          >
                            {copiedId === record.studentId ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900">{record.fullName}</div>
                        {record.email && (
                          <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                            {record.email}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-stone-700">{record.course}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono tabular-nums font-semibold text-stone-800">
                          {record.batchYear}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {isReg ? (
                          <div className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Verified Alumni</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-stone-500 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>Pre-Accredited</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isReg && record.matchedUid && (
                            <button
                              type="button"
                              onClick={() => setSelectedUserIdForModal(record.matchedUid!)}
                              className="px-2.5 py-1 text-[11px] font-bold text-[#8B181B] hover:text-[#721316] bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                              title="Inspect Active Alumni Profile"
                            >
                              Profile
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(record.studentId, record.fullName)}
                            className="p-1 text-stone-400 hover:text-red-600 rounded hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Remove Record from Masterlist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Progressive Pagination Bar */}
        {filteredRecords.length > recordsVisibleCount && (
          <div className="p-4 bg-stone-50/80 border-t border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-stone-600">
              Showing <strong className="font-mono tabular-nums text-stone-900">{Math.min(recordsVisibleCount, filteredRecords.length)}</strong> of <strong className="font-mono tabular-nums text-stone-900">{filteredRecords.length}</strong> accredited records
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRecordsVisibleCount((prev) => prev + 25)}
                className="px-3.5 py-1.5 bg-[#8B181B] hover:bg-[#721316] text-white rounded-lg font-bold shadow-2xs transition-all cursor-pointer text-xs"
              >
                Load Next 25 Records
              </button>
              <button
                type="button"
                onClick={() => setRecordsVisibleCount(filteredRecords.length)}
                className="px-3.5 py-1.5 bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 rounded-lg font-semibold transition-colors cursor-pointer text-xs"
              >
                Show All ({filteredRecords.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          3. BULK CSV / EXCEL IMPORTER MODAL
          ======================================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-4xl my-auto animate-in fade-in zoom-in-95 duration-150 relative">
            <CsvStudentBulkImporter
              onImportComplete={() => {
                refreshRecords();
                setIsImportModalOpen(false);
                showToast('Student registry records successfully imported and synchronized!', 'success');
              }}
              onClose={() => setIsImportModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ========================================================
          4. ACCREDIT STUDENT MODAL (MANUAL REGISTRY ENTRY)
          ======================================================== */}
      {isAccreditModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-stone-200 shadow-xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#8B181B] flex items-center justify-center border border-red-100">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">Accredit Graduate Student</h3>
                  <p className="text-xs text-stone-500">Manually add an accredited graduate to the official masterlist</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccreditModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAccreditStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Student ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accreditForm.studentId}
                  onChange={(e) => setAccreditForm({ ...accreditForm, studentId: e.target.value.toUpperCase() })}
                  placeholder="e.g. SCC-2024-0428"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:bg-white transition-all"
                />
                <p className="text-[11px] text-stone-400 mt-1">Format: SCC-YYYY-XXXX (Centennial formula)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accreditForm.fullName}
                  onChange={(e) => setAccreditForm({ ...accreditForm, fullName: e.target.value })}
                  placeholder="e.g. Maria Clara Santos"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Graduating Batch <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accreditForm.batchYear}
                    onChange={(e) => setAccreditForm({ ...accreditForm, batchYear: e.target.value })}
                    placeholder="e.g. 2024"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Honors (Optional)
                  </label>
                  <input
                    type="text"
                    value={accreditForm.honors}
                    onChange={(e) => setAccreditForm({ ...accreditForm, honors: e.target.value })}
                    placeholder="e.g. Cum Laude"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Degree Program / Course <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accreditForm.course}
                  onChange={(e) => setAccreditForm({ ...accreditForm, course: e.target.value })}
                  placeholder="e.g. B.S. Information Technology"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Institutional Email (Optional)
                </label>
                <input
                  type="email"
                  value={accreditForm.email}
                  onChange={(e) => setAccreditForm({ ...accreditForm, email: e.target.value })}
                  placeholder="e.g. student@stcecilia.edu.ph"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:bg-white transition-all"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAccreditModalOpen(false)}
                  className="px-4 py-2 border border-stone-200 hover:bg-stone-50 text-stone-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Accredit & Save to Roster</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
