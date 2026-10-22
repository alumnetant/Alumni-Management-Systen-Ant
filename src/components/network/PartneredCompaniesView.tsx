import React, { useState, useMemo } from 'react';
import {
  Building2,
  Briefcase,
  Globe,
  MapPin,
  ExternalLink,
  Search,
  CheckCircle2,
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building
} from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';
import { UserProfile, Opportunity } from '../../types';

interface PartneredCompaniesViewProps {
  onSelectCompanyJobs?: (companyName: string) => void;
}

export const PartneredCompaniesView: React.FC<PartneredCompaniesViewProps> = ({
  onSelectCompanyJobs
}) => {
  const { users, opportunities, setActiveTab } = useAlumni();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');

  // Filter approved & active partner companies
  // Strict rule (Requirement 7 & 10):
  // - Unapproved employers (pending verification) must NEVER appear
  // - Declined/rejected companies must be automatically removed
  const partneredCompanies = useMemo(() => {
    return users.filter((u) => {
      if (u.role !== 'employer') return false;

      // Status check: Must be ACTIVE
      const accountStatus = (u.accountStatus || u.status || 'ACTIVE').toUpperCase().trim();
      if (accountStatus === 'PENDING_VERIFICATION' || accountStatus === 'SUSPENDED') {
        return false;
      }

      // Verification check: Must be verified and active
      const isApproved =
        u.isVerified === true &&
        u.employerVerificationStatus === 'verified';

      return isApproved;
    });
  }, [users]);

  // Aggregate available slots and active opportunities per company
  const companyOpportunityMap = useMemo(() => {
    const map: Record<string, Opportunity[]> = {};
    const activeOpportunities = opportunities.filter(
      (o) => o.status !== 'closed' && (o.approvalStatus === 'approved' || !o.approvalStatus)
    );

    activeOpportunities.forEach((opp) => {
      const companyKey = (opp.company || '').toLowerCase().trim();
      if (companyKey) {
        if (!map[companyKey]) map[companyKey] = [];
        map[companyKey].push(opp);
      }
    });

    return map;
  }, [opportunities]);

  // Distinct industries for filtering
  const allIndustries = useMemo(() => {
    const industries = Array.from(
      new Set(
        partneredCompanies
          .map((c) => c.companyIndustry || c.industry)
          .filter(Boolean) as string[]
      )
    );
    return ['all', ...industries.sort()];
  }, [partneredCompanies]);

  // Filtered companies based on search and industry
  const filteredCompanies = useMemo(() => {
    return partneredCompanies.filter((company) => {
      const q = searchQuery.toLowerCase().trim();
      const compName = (company.companyName || company.company || company.name || '').toLowerCase();
      const industry = (company.companyIndustry || company.industry || '').toLowerCase();
      const location = (company.companyAddress || company.location || '').toLowerCase();

      const matchesSearch =
        !q ||
        compName.includes(q) ||
        industry.includes(q) ||
        location.includes(q);

      const matchesIndustry =
        selectedIndustry === 'all' ||
        (company.companyIndustry || company.industry) === selectedIndustry;

      return matchesSearch && matchesIndustry;
    });
  }, [partneredCompanies, searchQuery, selectedIndustry]);

  const handleViewJobs = (companyName: string) => {
    if (onSelectCompanyJobs) {
      onSelectCompanyJobs(companyName);
    } else {
      setActiveTab('opportunities');
      window.dispatchEvent(
        new CustomEvent('applet:filter-jobs-company', { detail: { company: companyName } })
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search partnered companies, industries, or location..."
            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B]"
          />
        </div>

        {/* Industry Filter Dropdown */}
        <div className="shrink-0">
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs sm:text-sm text-stone-700 dark:text-stone-300 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] cursor-pointer"
          >
            <option value="all">All Industries ({partneredCompanies.length})</option>
            {allIndustries
              .filter((ind) => ind !== 'all')
              .map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Companies Grid */}
      {filteredCompanies.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
          <Building2 className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3 stroke-[1.5]" />
          <h3 className="text-sm sm:text-base font-bold text-stone-800 dark:text-stone-200">
            No Partnered Companies Found
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedIndustry !== 'all'
              ? 'Try adjusting your search criteria or industry filter.'
              : 'Corporate recruitment partners will appear here once approved by the Alumni & Placement Office.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredCompanies.map((company) => {
            const compName = company.companyName || company.company || company.name || 'Partner Company';
            const compKey = compName.toLowerCase().trim();
            const companyJobs = companyOpportunityMap[compKey] || [];
            const openJobsCount = companyJobs.length;

            return (
              <div
                key={company.uid}
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/90 dark:border-stone-800 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Icon & Verified Badge */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200/80 dark:border-red-900/60 flex items-center justify-center text-[#8B181B] dark:text-red-400 shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      <Building2 className="w-6 h-6 stroke-[1.75]" />
                    </div>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Accredited Partner</span>
                    </span>
                  </div>

                  {/* Company Name & Industry */}
                  <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-snug">
                    {compName}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-1">
                    {company.companyIndustry || company.industry || 'Information Technology & Services'}
                  </p>

                  {/* Details: Location & Website */}
                  <div className="mt-3.5 pt-3 border-t border-stone-100 dark:border-stone-800 space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{company.companyAddress || company.location || 'Cebu, Philippines'}</span>
                    </div>

                    {company.companyWebsite && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <a
                          href={company.companyWebsite.startsWith('http') ? company.companyWebsite : `https://${company.companyWebsite}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#8B181B] dark:text-red-400 hover:underline truncate inline-flex items-center gap-1"
                        >
                          <span className="truncate">{company.companyWebsite.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Available Opportunities & Slots Section (Requirement 9) */}
                  <div className="mt-4 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-[#8B181B] dark:text-red-400" />
                        <span>Available Slots</span>
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        openJobsCount > 0
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                          : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-400'
                      }`}>
                        {openJobsCount} Active Opening{openJobsCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {openJobsCount > 0 ? (
                      <ul className="space-y-1 mt-2 text-[11px] text-stone-600 dark:text-stone-400">
                        {companyJobs.slice(0, 2).map((job) => (
                          <li key={job.id} className="flex items-center justify-between gap-2 truncate">
                            <span className="truncate font-medium text-stone-800 dark:text-stone-200">• {job.title}</span>
                            <span className="text-[10px] text-stone-500 uppercase tracking-wide shrink-0">({job.type})</span>
                          </li>
                        ))}
                        {openJobsCount > 2 && (
                          <li className="text-[10px] text-stone-500 dark:text-stone-400 italic pt-0.5">
                            +{openJobsCount - 2} more active positions
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                        Currently accepting general talent pool applications.
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => handleViewJobs(compName)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-[#8B181B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer group-hover:bg-[#8B181B]"
                  >
                    <span>View Career Opportunities</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
