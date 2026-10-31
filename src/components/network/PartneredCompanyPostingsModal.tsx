import React, { useState, useMemo } from 'react';
import {
  X,
  Building2,
  Briefcase,
  MapPin,
  Globe,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  Search,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  Send,
  ChevronDown,
  ChevronUp,
  Mail,
  User,
  DollarSign
} from 'lucide-react';
import { Opportunity, UserProfile } from '../../types';
import { useAlumni } from '../../context/AlumniContext';
import { computePreciseJobMatch } from '../../services/jobMatchingService';

interface PartneredCompanyPostingsModalProps {
  company: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onApply: (opportunity: Opportunity) => void;
}

export const PartneredCompanyPostingsModal: React.FC<PartneredCompanyPostingsModalProps> = ({
  company,
  isOpen,
  onClose,
  onApply
}) => {
  const { opportunities, jobApplications, currentUser } = useAlumni();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedJobIds, setExpandedJobIds] = useState<Record<string, boolean>>({});

  const compName = company.companyName || company.company || company.name || 'Partner Company';
  const compKey = compName.toLowerCase().trim();

  // Find all active opportunities posted by or belonging to this company
  const companyOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      // Must be approved and not closed
      if (opp.status === 'closed') return false;
      if (opp.approvalStatus && opp.approvalStatus !== 'approved') return false;

      // Check match by company name or postedBy UID
      const oppComp = (opp.company || '').toLowerCase().trim();
      const oppPoster = opp.postedBy;

      const isNameMatch = oppComp === compKey || (oppComp && (oppComp.includes(compKey) || compKey.includes(oppComp)));
      const isUidMatch = Boolean(oppPoster && oppPoster === company.uid);

      return isNameMatch || isUidMatch;
    });
  }, [opportunities, compKey, company.uid]);

  // Filtered list based on modal search and job type
  const filteredOpportunities = useMemo(() => {
    return companyOpportunities.filter((job) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        job.title.toLowerCase().includes(q) ||
        (job.description || '').toLowerCase().includes(q) ||
        (job.requiredCourse || '').toLowerCase().includes(q) ||
        (job.skills || []).some((s) => s.toLowerCase().includes(q));

      const matchesType =
        selectedType === 'all' ||
        (job.type || '').toLowerCase() === selectedType.toLowerCase();

      return matchesSearch && matchesType;
    });
  }, [companyOpportunities, searchQuery, selectedType]);

  const toggleExpand = (id: string) => {
    setExpandedJobIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe animate-in fade-in">
      <div
        className="bg-white dark:bg-stone-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-3xl max-h-[90dvh] overflow-hidden flex flex-col animate-in zoom-in-95 transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="partnered-company-modal-title"
      >
        {/* Header: Company Identity & Badges */}
        <div className="p-5 sm:p-6 bg-gradient-to-br from-stone-50 via-white to-red-50/40 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-b border-stone-200/90 dark:border-stone-800 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pr-8">
            <div className="w-14 h-14 rounded-2xl bg-[#8B181B] text-white flex items-center justify-center shadow-md shrink-0 border border-[#721316]">
              <Building2 className="w-7 h-7 stroke-[1.75]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Verified Corporate Partner</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                  <ShieldCheck className="w-3 h-3 text-[#8B181B]" />
                  <span>Accredited Employer</span>
                </span>
              </div>

              <h2
                id="partnered-company-modal-title"
                className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white tracking-tight leading-snug truncate"
              >
                {compName}
              </h2>

              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-0.5">
                {company.companyIndustry || company.industry || 'Corporate Placement & Recruitment Partner'}
              </p>
            </div>
          </div>

          {/* Quick Meta Ribbon */}
          <div className="mt-4 pt-3 border-t border-stone-200/70 dark:border-stone-800 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-stone-600 dark:text-stone-400">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>{company.companyAddress || company.location || 'Cebu City, Philippines'}</span>
            </div>

            {company.companyWebsite && (
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <a
                  href={company.companyWebsite.startsWith('http') ? company.companyWebsite : `https://${company.companyWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#8B181B] dark:text-red-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>{company.companyWebsite.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {company.contactPerson && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>Contact: {company.contactPerson}</span>
              </div>
            )}

            {company.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>{company.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 bg-stone-50/70 dark:bg-stone-850 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${compName}'s postings by role, skills...`}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-700 dark:text-stone-300 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] cursor-pointer"
            >
              <option value="all">All Employment Types</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Internship">Internship</option>
              <option value="Contract">Contract</option>
            </select>

            <span className="px-2.5 py-1.5 text-xs font-bold bg-stone-200/70 dark:bg-stone-750 text-stone-700 dark:text-stone-300 rounded-xl">
              {filteredOpportunities.length} Available
            </span>
          </div>
        </div>

        {/* Postings Content Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredOpportunities.length === 0 ? (
            <div className="p-10 text-center bg-stone-50/50 dark:bg-stone-850/50 rounded-2xl border border-stone-200/80 dark:border-stone-800">
              <Briefcase className="w-10 h-10 text-stone-300 dark:text-stone-600 mx-auto mb-2 stroke-[1.5]" />
              <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
                {companyOpportunities.length === 0
                  ? `No Active Vacancies Currently Listed`
                  : `No Postings Match Your Search`}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-md mx-auto leading-relaxed">
                {companyOpportunities.length === 0
                  ? `${compName} is accredited with St. Cecilia's College and accepts general talent pool inquiries. You may also contact their representative or visit their corporate portal.`
                  : `Try adjusting your search query or employment type filter to view other openings.`}
              </p>
              {company.companyWebsite && (
                <a
                  href={company.companyWebsite.startsWith('http') ? company.companyWebsite : `https://${company.companyWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-[#8B181B] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <span>Visit {compName} Careers</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ) : (
            filteredOpportunities.map((job) => {
              const matchResult = computePreciseJobMatch(currentUser, job);
              const isMatchRecommended = matchResult.score >= 65;

              // Check if currently logged in alumnus has already submitted an application
              const existingApplication = currentUser
                ? jobApplications.find(
                    (app) => (app.jobId === job.id || (app as any).opportunityId === job.id) && (app.applicantUid === currentUser.uid || app.applicantEmail === currentUser.email)
                  )
                : null;

              const isExpanded = Boolean(expandedJobIds[job.id]);
              const extraBadge = (job as any).workplaceType || job.experienceLevel;

              return (
                <div
                  key={job.id}
                  className="bg-white dark:bg-stone-850 rounded-2xl border border-stone-200/90 dark:border-stone-750 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] transition-all hover:border-stone-300 dark:hover:border-stone-700"
                >
                  {/* Top Bar: Title, Type, and Match Score */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-stone-100 dark:border-stone-800">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                          {job.type || 'Full-time'}
                        </span>
                        {extraBadge && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                            {extraBadge}
                          </span>
                        )}
                        {isMatchRecommended && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>{matchResult.score}% Profile Match</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white tracking-tight">
                        {job.title}
                      </h3>
                    </div>

                    {/* Salary / Stipend */}
                    {(job.salaryOrStipend || (job as any).salary) && (
                      <div className="sm:text-right shrink-0">
                        <span className="text-[10px] font-semibold text-stone-400 block uppercase tracking-wider">
                          Compensation
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          {job.salaryOrStipend || (job as any).salary}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Metadata: Location, Target Course, Deadline */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{job.location || company.companyAddress || 'Cebu City, Philippines'}</span>
                    </div>

                    {job.requiredCourse && (
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="font-medium text-stone-800 dark:text-stone-200">
                          Target: {job.requiredCourse}
                        </span>
                      </div>
                    )}

                    {job.deadline && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>Deadline: {new Date(job.deadline).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Skills Tag Chips */}
                  {job.skills && job.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1">
                        Skills:
                      </span>
                      {job.skills.map((skill) => {
                        const isUserSkill = (currentUser?.skills || []).some(
                          (s) => s.toLowerCase() === skill.toLowerCase()
                        );
                        return (
                          <span
                            key={skill}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                              isUserSkill
                                ? 'bg-red-50 dark:bg-red-950/40 text-[#8B181B] dark:text-red-300 border border-red-200 dark:border-red-900/60 font-semibold'
                                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                            }`}
                          >
                            {skill}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Expandable Description */}
                  <div className="mt-3 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    <p className={isExpanded ? '' : 'line-clamp-2'}>
                      {job.description}
                    </p>
                    {job.description && job.description.length > 120 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(job.id)}
                        className="mt-1 text-[11px] font-bold text-[#8B181B] dark:text-red-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isExpanded ? 'Show less' : 'Read full role description'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {/* Footer Actions: Apply or Applied Status */}
                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-stone-400">
                      Posted by {compName} Recruitment Team
                    </span>

                    <div>
                      {existingApplication ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Applied · Status: {existingApplication.status || 'Under Review'}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onApply(job)}
                          className="px-4 py-2 bg-[#8B181B] hover:bg-[#721316] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <Send className="w-3 h-3 stroke-[2]" />
                          <span>Apply for Position</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 dark:bg-stone-850 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <span>St. Cecilia's College • Alumni Placement & Industry Partnerships</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-semibold hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
