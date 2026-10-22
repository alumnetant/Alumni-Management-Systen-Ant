import React, { useState } from 'react';
import { Star, Sparkles, X, CheckCircle2, MessageSquare, Heart, Send } from 'lucide-react';
import { useAlumni } from '../../context/AlumniContext';

interface UserSatisfactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSatisfactionModal: React.FC<UserSatisfactionModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, showToast } = useAlumni();

  const [overallRating, setOverallRating] = useState<number>(5);
  const [directoryRating, setDirectoryRating] = useState<number>(5);
  const [networkingRating, setNetworkingRating] = useState<number>(5);
  const [careerRating, setCareerRating] = useState<number>(5);
  const [npsScore, setNpsScore] = useState<number>(9);
  const [feedbackNotes, setFeedbackNotes] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const surveyResponse = {
      id: `survey_${Date.now()}`,
      userId: currentUser?.uid || 'anonymous',
      userName: currentUser?.name || 'Cecilian Alumnus',
      userRole: currentUser?.role || 'alumni',
      overallRating,
      directoryRating,
      networkingRating,
      careerRating,
      npsScore,
      feedbackNotes: feedbackNotes.trim(),
      submittedAt: new Date().toISOString()
    };

    try {
      const existing = localStorage.getItem('scc_user_surveys');
      const list = existing ? JSON.parse(existing) : [];
      list.push(surveyResponse);
      localStorage.setItem('scc_user_surveys', JSON.stringify(list));
      localStorage.setItem('scc_survey_completed_v1', 'true');
    } catch {}

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      showToast('Thank you! Your feedback has been recorded by Alumni Affairs.', 'success');
    }, 400);
  };

  const StarRating: React.FC<{
    value: number;
    onChange: (val: number) => void;
    label: string;
  }> = ({ value, onChange, label }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60">
      <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 text-stone-300 dark:text-stone-600 hover:text-amber-400 dark:hover:text-amber-400 transition-colors cursor-pointer"
            title={`${star} Star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={`w-5 h-5 ${
                star <= value
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-stone-300 dark:text-stone-600'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.06)] overflow-hidden max-h-[92vh] flex flex-col">
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-[#8B181B]" />

        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                Institutional Quality & Experience
              </span>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                User Satisfaction Survey
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {isSubmitted ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                Feedback Received!
              </h4>
              <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mx-auto leading-relaxed">
                Thank you for helping us elevate the St. Cecilia's College Alumni Network. Your insights guide our platform updates and student-alumni services.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Close Survey
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                Please take a moment to evaluate your experience with our features. Your honest feedback ensures our network remains vibrant and impactful.
              </p>

              {/* 4 Feature Ratings */}
              <div className="space-y-2.5">
                <StarRating
                  label="Overall Portal Experience"
                  value={overallRating}
                  onChange={setOverallRating}
                />
                <StarRating
                  label="Directory & Company Matching"
                  value={directoryRating}
                  onChange={setDirectoryRating}
                />
                <StarRating
                  label="Messaging & Peer Networking"
                  value={networkingRating}
                  onChange={setNetworkingRating}
                />
                <StarRating
                  label="Career & Opportunity Relevance"
                  value={careerRating}
                  onChange={setCareerRating}
                />
              </div>

              {/* Net Promoter Score (0-10) */}
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                  <span>How likely are you to recommend Cecilian Alumnet?</span>
                  <span className="font-mono text-[#8B181B] dark:text-red-400 font-bold">{npsScore} / 10</span>
                </div>
                <div className="grid grid-cols-11 gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setNpsScore(score)}
                      className={`h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        npsScore === score
                          ? 'bg-[#8B181B] text-white shadow-2xs scale-105'
                          : 'bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] text-stone-400">
                  <span>0 - Not Likely</span>
                  <span>10 - Extremely Likely</span>
                </div>
              </div>

              {/* Qualitative Feedback Textarea */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-1.5">
                  Suggestions or Recommended Features <span className="text-stone-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder="Tell us what you love or what we can enhance for upcoming releases..."
                  className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-[#8B181B]/20 focus:border-[#8B181B] transition-all resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#8B181B] hover:bg-[#721316] text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Evaluation'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
