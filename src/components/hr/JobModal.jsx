import { useMemo, useState } from 'react';
import {
  Briefcase, X, Settings2, Check, CheckCircle2, AlertCircle,
  MapPin, DollarSign, Sparkles, Plus, Trash2, ArrowRight,
  ArrowLeft, Eye, Globe, Laptop, Building2,
  FileText, Wand2, ShieldCheck, Award
} from 'lucide-react';
import { ConfirmationModal } from '../common/ConfirmationModal';

const COMMON_TITLES = [
  'Full Stack Engineer',
  'Senior Frontend Developer',
  'Backend Engineer (Node / Python)',
  'Lead Product Designer',
  'Data Analyst / Scientist',
  'DevOps & Cloud Engineer',
  'Product Manager',
  'Mobile Developer (Flutter / React Native)',
  'QA Automation Engineer'
];

// Top Philippine Tech & Commercial Hotspots
const PH_HOTSPOT_LOCATIONS = [
  'Bonifacio Global City (BGC), Taguig',
  'Makati City, Metro Manila',
  'Ortigas Center, Pasig',
  'Quezon City (Eastwood / Technohub)',
  'Cebu IT Park, Cebu City',
  'Clark Freeport Zone, Pampanga',
  'Davao City, Davao del Sur',
  'Iloilo Business Park, Iloilo City',
  'Alabang / Filinvest, Muntinlupa',
  'Mandaluyong City, Metro Manila',
  'Baguio City, Benguet',
  'Cagayan de Oro City',
  'Remote - Philippines (Nationwide)'
];

const WORKPLACE_TYPES = [
  { id: 'Remote', label: 'Remote', desc: 'Work anywhere in the Philippines', icon: Globe },
  { id: 'Hybrid', label: 'Hybrid', desc: 'Mix of office (BGC/Makati) & remote', icon: Laptop },
  { id: 'On-site', label: 'On-site', desc: 'Full-time at company office', icon: Building2 }
];

const EMPLOYMENT_TYPES = [
  'Full-time',
  'Part-time',
  'Contract',
  'Internship',
  'Temporary'
];

const EXPERIENCE_LEVELS = [
  'Entry level (0-2 years)',
  'Associate (2-4 years)',
  'Mid-Senior level (4-7 years)',
  'Director (7+ years)',
  'Executive (10+ years)'
];

const DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design & Creative',
  'Data & AI',
  'Operations',
  'Sales & Marketing',
  'People / HR'
];

const SKILL_SUGGESTIONS = [
  'React', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'SQL',
  'PostgreSQL', 'Docker', 'AWS', 'REST APIs', 'Git', 'TailwindCSS',
  'GraphQL', 'Next.js', 'Figma', 'System Design', 'CI/CD', 'Jest'
];

const PH_SALARY_PRESETS = [
  { label: '₱35k - ₱55k / mo (Junior)', min: '35,000', max: '55,000', period: '/ mo' },
  { label: '₱60k - ₱100k / mo (Mid-Level)', min: '60,000', max: '100,000', period: '/ mo' },
  { label: '₱110k - ₱175k / mo (Senior)', min: '110,000', max: '175,000', period: '/ mo' },
  { label: '₱180k - ₱260k+ / mo (Lead/Principal)', min: '180,000', max: '260,000', period: '/ mo' },
  { label: '₱720k - ₱1.2M / yr (Annual)', min: '720,000', max: '1,200,000', period: '/ yr' }
];

const DEFAULT_SCORECARD_CRITERIA = [
  { name: 'Technical Competency', description: 'Core domain skills, coding or technical ability, depth of experience' },
  { name: 'Communication & Collaboration', description: 'Articulates ideas clearly, listens actively, teamwork mindset' },
  { name: 'Problem Solving & Critical Thinking', description: 'Approaches complex problems methodically, debugging ability' },
  { name: 'Cultural Alignment & Values', description: 'Alignment with Tidal values, curiosity, ownership, integrity' },
  { name: 'Role-Specific Execution', description: 'Pace of delivery, quality standards, practical applicability to open duties' }
];

const TEMPLATES = {
  engineering: `### Role Overview
We are looking for an exceptional engineer to join our Philippine-based technology team. You will lead architecture on scalable web applications, collaborate with cross-functional product and design teams, and build resilient services.

### Key Responsibilities
- Architect, build, and deploy reliable web features and microservices.
- Write clean, maintainable, and well-tested code across our stack.
- Collaborate with product managers and UI designers to refine technical specifications.
- Participate in code reviews and mentor high-potential engineers.

### Qualifications & Requirements
- Proven experience shipping production-grade software applications.
- Strong proficiency in modern frameworks (React, Node.js, TypeScript), relational databases, and version control.
- Clear communication skills and enthusiasm for high-standards engineering.

### Benefits & Philippine Perks
- Competitive compensation in PHP Peso with 13th-month pay and annual performance review.
- Comprehensive HMO health coverage (with dependent options).
- Hybrid / remote work setup with modern home-office equipment stipend.
- Government-mandated benefits (SSS, PhilHealth, Pag-IBIG) fully covered.`,

  design: `### Role Overview
We are looking for a creative, detail-oriented Product Designer based in the Philippines to craft intuitive, delightful user experiences across web and mobile platforms.

### Key Responsibilities
- Lead end-to-end user experience and interface design for core product flows.
- Create wireframes, interactive prototypes, and production-ready design assets.
- Maintain and scale our design system and component libraries in Figma.
- Partner with user research and engineering to validate hypotheses.

### Qualifications & Requirements
- Portfolio showcasing deep product thinking and polished visual design.
- Proficiency in modern design tools (Figma, design tokens, responsive prototyping).
- Strong empathy for user needs and business metrics.

### Benefits & Perks
- Competitive salary in PHP Peso + HMO coverage from Day 1.
- Flexible work hours and home-office equipment support.
- Continuous learning & development budget.`,

  general: `### Role Overview
Join our rapidly expanding Philippine team to help drive impact across our organization. This role offers strong career progression, high autonomy, and collaborative culture.

### Key Responsibilities
- Own key deliverables from conception through execution and post-launch review.
- Collaborate across departments to remove roadblocks and optimize workflows.
- Communicate progress, metrics, and insights with team leaders.

### Qualifications & Requirements
- Strong problem-solving skills and structured analytical thinking.
- Excellent written and verbal communication abilities.
- Growth mindset and enthusiasm for working in a fast-paced environment.`
};

const STEPS = [
  { id: 'basics', label: '1. Role Basics', icon: Briefcase },
  { id: 'details', label: '2. Details & Pay', icon: FileText },
  { id: 'weights', label: '3. Skills & ATS Weights', icon: Settings2 },
  { id: 'preview', label: '4. Review & Publish', icon: Eye }
];

export function JobModal({ job, onClose, onSave, onDelete }) {
  const [currentStep, setCurrentStep] = useState('basics');

  // Confirmation Modals State
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Parse initial state from job
  const initialWorkplace = job?.location?.toLowerCase().includes('hybrid')
    ? 'Hybrid'
    : job?.location?.toLowerCase().includes('remote')
    ? 'Remote'
    : 'On-site';

  const [formData, setFormData] = useState(() => ({
    title: job?.title || '',
    department: job?.department || 'Engineering',
    workplaceType: initialWorkplace,
    location: job?.location || 'Bonifacio Global City (BGC), Taguig',
    type: job?.type || 'Full-time',
    experienceLevel: job?.experienceLevel || 'Mid-Senior level (4-7 years)',
    salaryRange: job?.salaryRange || '₱60,000 - ₱100,000 / mo',
    status: job?.status || 'open',
    description: job?.description || '',
    scoringWeights: job?.scoringWeights || { requiredSkills: 70, nonRequiredSkills: 20, experience: 10 },
    scorecardCriteria: Array.isArray(job?.scorecardCriteria) && job.scorecardCriteria.length > 0
      ? job.scorecardCriteria
      : DEFAULT_SCORECARD_CRITERIA,
    ratingScale: Number(job?.ratingScale) || 5,
    sourcingCost: job?.sourcingCost != null ? String(job.sourcingCost) : ''
  }));

  // Scorecard criteria add/edit state
  const [newCritName, setNewCritName] = useState('');
  const [newCritDesc, setNewCritDesc] = useState('');

  const addCriterion = () => {
    if (!newCritName.trim()) return;
    setFormData(prev => ({
      ...prev,
      scorecardCriteria: [
        ...(prev.scorecardCriteria || []),
        { name: newCritName.trim(), description: newCritDesc.trim() || 'Role evaluation dimension' }
      ]
    }));
    setNewCritName('');
    setNewCritDesc('');
  };

  const removeCriterion = (idx) => {
    setFormData(prev => ({
      ...prev,
      scorecardCriteria: (prev.scorecardCriteria || []).filter((_, i) => i !== idx)
    }));
  };

  const resetCriteria = () => {
    setFormData(prev => ({
      ...prev,
      scorecardCriteria: DEFAULT_SCORECARD_CRITERIA
    }));
  };

  // Skills chips state
  const [requiredSkills, setRequiredSkills] = useState(
    Array.isArray(job?.requiredSkills) ? job.requiredSkills : []
  );
  const [nonRequiredSkills, setNonRequiredSkills] = useState(
    Array.isArray(job?.nonRequiredSkills) ? job.nonRequiredSkills : []
  );

  const [reqSkillInput, setReqSkillInput] = useState('');
  const [nonReqSkillInput, setNonReqSkillInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Compensation helpers - default PHP Peso (₱)
  const [salaryCurrency, setSalaryCurrency] = useState('₱');
  const [salaryMin, setSalaryMin] = useState('60,000');
  const [salaryMax, setSalaryMax] = useState('100,000');
  const [salaryPeriod, setSalaryPeriod] = useState('/ mo');
  const [isCustomSalary, setIsCustomSalary] = useState(false);

  // Total ATS weight calculation
  const totalWeight = useMemo(() => {
    const { requiredSkills: r, nonRequiredSkills: n, experience: e } = formData.scoringWeights || {};
    return Number(r || 0) + Number(n || 0) + Number(e || 0);
  }, [formData.scoringWeights]);

  const setWeight = (key, value) => {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    setFormData(prev => ({
      ...prev,
      scoringWeights: { ...prev.scoringWeights, [key]: num }
    }));
  };

  const applyWeightPreset = (r, n, e) => {
    setFormData(prev => ({
      ...prev,
      scoringWeights: { requiredSkills: r, nonRequiredSkills: n, experience: e }
    }));
  };

  const autoBalanceWeights = () => {
    const currentTotal = totalWeight || 1;
    const r = Math.round((Number(formData.scoringWeights.requiredSkills || 0) / currentTotal) * 100);
    const n = Math.round((Number(formData.scoringWeights.nonRequiredSkills || 0) / currentTotal) * 100);
    const e = 100 - r - n;
    setFormData(prev => ({
      ...prev,
      scoringWeights: {
        requiredSkills: Math.max(0, r),
        nonRequiredSkills: Math.max(0, n),
        experience: Math.max(0, e)
      }
    }));
  };

  // Add / Remove Skills
  const addRequiredSkill = (name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    if (!requiredSkills.some(s => s.toLowerCase() === clean.toLowerCase())) {
      setRequiredSkills(prev => [...prev, clean]);
    }
    setReqSkillInput('');
  };

  const removeRequiredSkill = (idx) => {
    setRequiredSkills(prev => prev.filter((_, i) => i !== idx));
  };

  const addNonRequiredSkill = (name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    if (!nonRequiredSkills.some(s => s.toLowerCase() === clean.toLowerCase())) {
      setNonRequiredSkills(prev => [...prev, clean]);
    }
    setNonReqSkillInput('');
  };

  const removeNonRequiredSkill = (idx) => {
    setNonRequiredSkills(prev => prev.filter((_, i) => i !== idx));
  };

  // Workplace selection updates location intelligently with Philippine defaults
  const handleWorkplaceSelect = (wp) => {
    setFormData(prev => {
      let newLocation = prev.location;
      if (wp === 'Remote' && (!prev.location || prev.location.includes('BGC') || prev.location.includes('Makati'))) {
        newLocation = 'Remote - Philippines (Nationwide)';
      } else if (wp === 'Hybrid' && (prev.location.includes('Remote') || !prev.location)) {
        newLocation = 'Bonifacio Global City (BGC), Taguig (Hybrid)';
      } else if (wp === 'On-site' && prev.location.includes('Remote')) {
        newLocation = 'Makati City, Metro Manila';
      }
      return { ...prev, workplaceType: wp, location: newLocation };
    });
  };

  // Salary string composer
  const updateFormattedSalary = (min, max, curr, period) => {
    if (isCustomSalary) return;
    const formatted = `${curr}${min || '0'} - ${curr}${max || '0'} ${period}`;
    setFormData(prev => ({ ...prev, salaryRange: formatted }));
  };

  const handleApplySalaryPreset = (preset) => {
    setSalaryMin(preset.min);
    setSalaryMax(preset.max);
    setSalaryPeriod(preset.period);
    updateFormattedSalary(preset.min, preset.max, salaryCurrency, preset.period);
  };

  const validateCurrentStep = (step) => {
    const errs = {};
    if (step === 'basics') {
      if (!formData.title.trim()) errs.title = 'Job title is required';
      if (!formData.location.trim()) errs.location = 'Job location is required';
    } else if (step === 'details') {
      if (!formData.description.trim()) errs.description = 'Job description is required';
    } else if (step === 'weights') {
      if (totalWeight !== 100) errs.weights = `Scoring weights must equal 100% (currently ${totalWeight}%)`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (!validateCurrentStep(currentStep)) return;
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  // Trigger Confirmation Modal before actual POST / PUT
  const handleReviewAndSubmit = (e) => {
    if (e) e.preventDefault();

    if (!formData.title.trim()) {
      setCurrentStep('basics');
      setErrors({ title: 'Job title is required' });
      return;
    }

    if (!formData.description.trim()) {
      setCurrentStep('details');
      setErrors({ description: 'Job description is required' });
      return;
    }

    if (totalWeight !== 100) {
      setCurrentStep('weights');
      setErrors({ weights: `Scoring weights must equal 100% (currently ${totalWeight}%)` });
      return;
    }

    // Open confirmation popup
    setShowSaveConfirmation(true);
  };

  // Confirmed final submit
  const handleExecuteSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave({
        ...(job?.id ? { id: job.id } : {}),
        title: formData.title.trim(),
        department: formData.department,
        location: formData.location.trim(),
        type: formData.type,
        experienceLevel: formData.experienceLevel,
        salaryRange: formData.salaryRange.trim(),
        status: formData.status,
        description: formData.description.trim(),
        requiredSkills,
        nonRequiredSkills,
        scoringWeights: {
          requiredSkills: Number(formData.scoringWeights.requiredSkills),
          nonRequiredSkills: Number(formData.scoringWeights.nonRequiredSkills),
          experience: Number(formData.scoringWeights.experience)
        },
        scorecardCriteria: formData.scorecardCriteria,
        ratingScale: Number(formData.ratingScale) || 5,
        sourcingCost: formData.sourcingCost !== '' && !isNaN(Number(formData.sourcingCost)) ? Number(formData.sourcingCost) : 0
      });
      setShowSaveConfirmation(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
          
          {/* Header - LinkedIn Style */}
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
                <Briefcase size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-100">
                    {job ? 'Edit Job Posting' : 'Create a Job Opportunity'}
                  </h2>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    Philippine ATS Ready
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Configure role specifications, Philippine workplace locations, and ATS screening weights.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stepper Navigation */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-800 bg-slate-950/40 text-xs shrink-0">
            {STEPS.map((step, idx) => {
              const isActive = currentStep === step.id;
              const isPassed = STEPS.findIndex(s => s.id === currentStep) > idx;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (validateCurrentStep(currentStep) || isPassed) {
                      setCurrentStep(step.id);
                    }
                  }}
                  className={`py-3.5 px-3 flex items-center justify-center gap-2 border-b-2 font-medium transition-all ${
                    isActive
                      ? 'border-indigo-500 text-indigo-300 bg-indigo-500/5'
                      : isPassed
                      ? 'border-emerald-500/50 text-emerald-400 hover:bg-slate-800/40'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : isPassed
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isPassed ? <Check size={11} /> : idx + 1}
                  </div>
                  <span className="truncate">{step.label.replace(/^\d+\.\s*/, '')}</span>
                </button>
              );
            })}
          </div>

          {/* Modal Body - Tabbed Steps */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            
            {/* STEP 1: ROLE BASICS */}
            {currentStep === 'basics' && (
              <div className="space-y-6">
                {/* Job Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Job Title *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Senior Full Stack Engineer"
                    value={formData.title}
                    onChange={e => {
                      setFormData({ ...formData, title: e.target.value });
                      if (errors.title) setErrors({ ...errors, title: null });
                    }}
                    className={`w-full bg-slate-950 border rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                      errors.title ? 'border-rose-500 bg-rose-500/5' : 'border-slate-800 focus:border-indigo-500'
                    }`}
                  />
                  {errors.title && (
                    <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle size={13} /> {errors.title}
                    </p>
                  )}

                  {/* Popular Job Title Chips */}
                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500 mr-1 flex items-center gap-1">
                      <Sparkles size={11} className="text-indigo-400" /> Suggestions:
                    </span>
                    {COMMON_TITLES.slice(0, 4).map(title => (
                      <button
                        key={title}
                        type="button"
                        onClick={() => setFormData({ ...formData, title })}
                        className="text-[11px] bg-slate-800/80 hover:bg-indigo-600/20 hover:text-indigo-300 text-slate-400 border border-slate-700/60 hover:border-indigo-500/30 px-2.5 py-1 rounded-lg transition-all"
                      >
                        + {title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Workplace Policy */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Workplace Policy *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {WORKPLACE_TYPES.map(wp => {
                      const Icon = wp.icon;
                      const isSelected = formData.workplaceType === wp.id;
                      return (
                        <button
                          key={wp.id}
                          type="button"
                          onClick={() => handleWorkplaceSelect(wp.id)}
                          className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                            isSelected
                              ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-600/10 ring-1 ring-indigo-500'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                          }`}
                        >
                          <div className={`p-2 rounded-xl shrink-0 ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <div className={`text-xs font-bold ${isSelected ? 'text-slate-100' : 'text-slate-300'}`}>
                              {wp.label}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{wp.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Location & Philippine Hotspots */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Job Location (Philippine Hubs) *</span>
                    </label>
                    <div className="relative">
                      <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        required
                        type="text"
                        placeholder="e.g. Bonifacio Global City (BGC), Taguig"
                        value={formData.location}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Philippine Hotspot Location Chips */}
                    <div className="mt-2 space-y-1">
                      <span className="text-[10px] text-slate-500 font-medium">Common Philippine Tech Hotspots:</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {PH_HOTSPOT_LOCATIONS.map(loc => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => setFormData({ ...formData, location: loc })}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                              formData.location === loc
                                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                                : 'text-slate-400 hover:text-slate-200 bg-slate-950/80 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Department / Team
                    </label>
                    <select
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      {DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>

                    <div className="mt-4">
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Posting Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="open">Active & Accepting Candidates</option>
                        <option value="closed">Closed / Archived</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Employment Type & Seniority */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Employment Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      {EMPLOYMENT_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Experience Level
                    </label>
                    <select
                      value={formData.experienceLevel}
                      onChange={e => setFormData({ ...formData, experienceLevel: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      {EXPERIENCE_LEVELS.map(lvl => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: DETAILS & COMPENSATION */}
            {currentStep === 'details' && (
              <div className="space-y-6">
                {/* Compensation Builder - PHP Base Currency */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-emerald-400" />
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Compensation & Pay Range (Base: PHP Peso ₱)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCustomSalary(!isCustomSalary)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      {isCustomSalary ? 'Use Range Builder' : 'Enter Custom Text'}
                    </button>
                  </div>

                  {isCustomSalary ? (
                    <div>
                      <input
                        type="text"
                        placeholder="e.g. Competitive with HMO & 14th Month, or ₱80k - ₱120k / mo"
                        value={formData.salaryRange}
                        onChange={e => setFormData({ ...formData, salaryRange: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Currency</label>
                          <select
                            value={salaryCurrency}
                            onChange={e => {
                              setSalaryCurrency(e.target.value);
                              updateFormattedSalary(salaryMin, salaryMax, e.target.value, salaryPeriod);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-semibold"
                          >
                            <option value="₱">₱ PHP (Philippine Peso)</option>
                            <option value="$">$ USD (US Dollar)</option>
                            <option value="€">€ EUR (Euro)</option>
                            <option value="S$">S$ SGD (Singapore Dollar)</option>
                            <option value="A$">A$ AUD (Australian Dollar)</option>
                            <option value="£">£ GBP (British Pound)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Minimum</label>
                          <input
                            type="text"
                            placeholder="60,000"
                            value={salaryMin}
                            onChange={e => {
                              setSalaryMin(e.target.value);
                              updateFormattedSalary(e.target.value, salaryMax, salaryCurrency, salaryPeriod);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Maximum</label>
                          <input
                            type="text"
                            placeholder="100,000"
                            value={salaryMax}
                            onChange={e => {
                              setSalaryMax(e.target.value);
                              updateFormattedSalary(salaryMin, e.target.value, salaryCurrency, salaryPeriod);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">Period</label>
                          <select
                            value={salaryPeriod}
                            onChange={e => {
                              setSalaryPeriod(e.target.value);
                              updateFormattedSalary(salaryMin, salaryMax, salaryCurrency, e.target.value);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                          >
                            <option value="/ mo">Per Month (/ mo)</option>
                            <option value="/ yr">Per Year (/ yr)</option>
                            <option value="/ hr">Per Hour (/ hr)</option>
                          </select>
                        </div>
                      </div>

                      {/* Common Philippine Salary Benchmarks */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-500 mr-1">Philippine Benchmarks:</span>
                        {PH_SALARY_PRESETS.map(preset => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => handleApplySalaryPreset(preset)}
                            className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-300 border border-slate-800 px-2 py-0.5 rounded transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-900 text-slate-400">
                    <span>Display compensation:</span>
                    <span className="font-bold text-emerald-400">{formData.salaryRange || 'Not specified'}</span>
                  </div>
                </div>

                {/* Job Description with Quick Templates */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Job Description & Expectations *
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Wand2 size={12} className="text-indigo-400" /> Insert template:
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, description: TEMPLATES.engineering })}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/20"
                      >
                        Engineering (PH)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, description: TEMPLATES.design })}
                        className="text-[11px] text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/20"
                      >
                        Design
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, description: TEMPLATES.general })}
                        className="text-[11px] text-slate-400 hover:text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700"
                      >
                        General
                      </button>
                    </div>
                  </div>

                  <textarea
                    required
                    rows={10}
                    placeholder="Provide a comprehensive job description, day-to-day responsibilities, qualifications, and company perks..."
                    value={formData.description}
                    onChange={e => {
                      setFormData({ ...formData, description: e.target.value });
                      if (errors.description) setErrors({ ...errors, description: null });
                    }}
                    className={`w-full bg-slate-950 border rounded-2xl p-4 text-xs font-sans text-slate-200 leading-relaxed placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                      errors.description ? 'border-rose-500 bg-rose-500/5' : 'border-slate-800 focus:border-indigo-500'
                    }`}
                  />
                  {errors.description && (
                    <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle size={13} /> {errors.description}
                    </p>
                  )}
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>Markdown formatting supported (headings, bullet points)</span>
                    <span>{formData.description.length} characters</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SKILLS & ATS SCREENING WEIGHTS */}
            {currentStep === 'weights' && (
              <div className="space-y-6">
                
                {/* ATS Screening Weights Section */}
                <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Settings2 size={16} className="text-indigo-400" /> ATS Screening Match Weights
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Our scoring engine computes each applicant's ranking deterministically using these exact percentage weights.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold px-3 py-1 rounded-xl border flex items-center gap-1.5 ${
                        totalWeight === 100
                          ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                          : 'text-rose-300 border-rose-500/30 bg-rose-500/10'
                      }`}>
                        {totalWeight === 100 ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                        Total {totalWeight}%
                      </span>

                      {totalWeight !== 100 && (
                        <button
                          type="button"
                          onClick={autoBalanceWeights}
                          className="text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-2.5 py-1 rounded-xl transition-all shadow-sm"
                        >
                          Auto-Balance
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visual Segmented Percentage Distribution Bar */}
                  <div className="space-y-1.5">
                    <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden flex border border-slate-800">
                      <div
                        style={{ width: `${Math.min(100, formData.scoringWeights.requiredSkills || 0)}%` }}
                        className="bg-indigo-500 transition-all duration-300"
                        title={`Required Skills: ${formData.scoringWeights.requiredSkills}%`}
                      />
                      <div
                        style={{ width: `${Math.min(100, formData.scoringWeights.nonRequiredSkills || 0)}%` }}
                        className="bg-purple-500 transition-all duration-300"
                        title={`Preferred Skills: ${formData.scoringWeights.nonRequiredSkills}%`}
                      />
                      <div
                        style={{ width: `${Math.min(100, formData.scoringWeights.experience || 0)}%` }}
                        className="bg-amber-500 transition-all duration-300"
                        title={`Experience: ${formData.scoringWeights.experience}%`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 px-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Required Skills ({formData.scoringWeights.requiredSkills}%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Preferred Skills ({formData.scoringWeights.nonRequiredSkills}%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Experience ({formData.scoringWeights.experience}%)
                      </span>
                    </div>
                  </div>

                  {/* Weight Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] text-slate-500 mr-1">Presets:</span>
                    <button
                      type="button"
                      onClick={() => applyWeightPreset(70, 20, 10)}
                      className="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      ATS Standard (70 / 20 / 10)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyWeightPreset(80, 10, 10)}
                      className="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Technical Specialist (80 / 10 / 10)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyWeightPreset(50, 25, 25)}
                      className="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Balanced Match (50 / 25 / 25)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyWeightPreset(30, 20, 50)}
                      className="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Seniority Focus (30 / 20 / 50)
                    </button>
                  </div>

                  {/* Precision Sliders and Inputs */}
                  <div className="grid sm:grid-cols-3 gap-4 pt-2">
                    {[
                      { key: 'requiredSkills', label: 'Required Skills Weight', color: 'accent-indigo-500', bar: 'border-l-indigo-500' },
                      { key: 'nonRequiredSkills', label: 'Non-required Skills Weight', color: 'accent-purple-500', bar: 'border-l-purple-500' },
                      { key: 'experience', label: 'Experience Weight', color: 'accent-amber-500', bar: 'border-l-amber-500' }
                    ].map(({ key, label, color, bar }) => (
                      <div key={key} className={`bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 border-l-4 ${bar} space-y-2`}>
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-semibold text-slate-300">{label}</label>
                          <div className="relative w-16">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={formData.scoringWeights[key]}
                              onChange={e => setWeight(key, e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 pr-6 text-xs text-slate-200 font-mono text-right"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={formData.scoringWeights[key]}
                          onChange={e => setWeight(key, e.target.value)}
                          className={`w-full ${color} cursor-pointer`}
                        />
                      </div>
                    ))}
                  </div>

                  {errors.weights && (
                    <p className="text-xs text-rose-400 flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                      <AlertCircle size={14} className="shrink-0" /> {errors.weights}
                    </p>
                  )}
                </div>

                {/* Skills Tags Area - Required & Non-Required */}
                <div className="grid md:grid-cols-2 gap-5">
                  
                  {/* Required Skills (Must-Have) */}
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck size={14} className="text-indigo-400" /> Must-Have Skills ({requiredSkills.length})
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          Essential competencies required for this role.
                        </p>
                      </div>
                    </div>

                    {/* Add Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type skill & press Enter..."
                        value={reqSkillInput}
                        onChange={e => setReqSkillInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addRequiredSkill(reqSkillInput);
                          }
                        }}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => addRequiredSkill(reqSkillInput)}
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus size={13} /> Add
                      </button>
                    </div>

                    {/* Chips Display */}
                    <div className="flex flex-wrap gap-1.5 min-h-[50px] p-2 bg-slate-900/50 rounded-xl border border-slate-800/80">
                      {requiredSkills.length === 0 ? (
                        <span className="text-[11px] text-slate-600 self-center mx-auto">
                          No required skills added yet.
                        </span>
                      ) : (
                        requiredSkills.map((skill, idx) => (
                          <span
                            key={skill + idx}
                            className="inline-flex items-center gap-1.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs px-2.5 py-1 rounded-lg"
                          >
                            {skill}
                            <button
                              type="button"
                              onClick={() => removeRequiredSkill(idx)}
                              className="hover:text-rose-400 text-indigo-400"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Quick Suggestions */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500">Popular suggestions:</span>
                      <div className="flex flex-wrap gap-1">
                        {SKILL_SUGGESTIONS.slice(0, 6).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => addRequiredSkill(s)}
                            disabled={requiredSkills.includes(s)}
                            className="text-[10px] bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-400 border border-slate-800 px-2 py-0.5 rounded"
                          >
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Non-Required / Preferred Skills (Nice-to-Have) */}
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles size={14} className="text-purple-400" /> Preferred Skills ({nonRequiredSkills.length})
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          Bonus qualifications that boost match score.
                        </p>
                      </div>
                    </div>

                    {/* Add Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type skill & press Enter..."
                        value={nonReqSkillInput}
                        onChange={e => setNonReqSkillInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addNonRequiredSkill(nonReqSkillInput);
                          }
                        }}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => addNonRequiredSkill(nonReqSkillInput)}
                        className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus size={13} /> Add
                      </button>
                    </div>

                    {/* Chips Display */}
                    <div className="flex flex-wrap gap-1.5 min-h-[50px] p-2 bg-slate-900/50 rounded-xl border border-slate-800/80">
                      {nonRequiredSkills.length === 0 ? (
                        <span className="text-[11px] text-slate-600 self-center mx-auto">
                          No preferred skills added yet.
                        </span>
                      ) : (
                        nonRequiredSkills.map((skill, idx) => (
                          <span
                            key={skill + idx}
                            className="inline-flex items-center gap-1.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs px-2.5 py-1 rounded-lg"
                          >
                            {skill}
                            <button
                              type="button"
                              onClick={() => removeNonRequiredSkill(idx)}
                              className="hover:text-rose-400 text-purple-400"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Quick Suggestions */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500">Popular suggestions:</span>
                      <div className="flex flex-wrap gap-1">
                        {SKILL_SUGGESTIONS.slice(6, 12).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => addNonRequiredSkill(s)}
                            disabled={nonRequiredSkills.includes(s)}
                            className="text-[10px] bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-400 border border-slate-800 px-2 py-0.5 rounded"
                          >
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Interview Scorecard Rubric & Sourcing Economics Section */}
                <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Award size={16} className="text-indigo-400" /> Interview Scorecard Rubric & Evaluation Criteria
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Custom evaluation criteria & rating scales for interviewers when reviewing candidates for this role.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">Rating Scale</label>
                        <select
                          value={formData.ratingScale}
                          onChange={e => setFormData(p => ({ ...p, ratingScale: Number(e.target.value) }))}
                          className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-semibold"
                        >
                          <option value={5}>1 - 5 Stars (Standard)</option>
                          <option value={10}>1 - 10 Scale (Detailed)</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={resetCriteria}
                        className="text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-1.5 rounded-lg mt-3 self-end transition-colors"
                      >
                        Reset Defaults
                      </button>
                    </div>
                  </div>

                  {/* Criteria List */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-slate-400">
                      Configured Criteria ({formData.scorecardCriteria.length})
                    </label>
                    <div className="space-y-2">
                      {formData.scorecardCriteria.map((crit, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-3 p-3 bg-slate-900/70 border border-slate-800 rounded-xl text-xs">
                          <div>
                            <p className="font-semibold text-slate-200">{crit.name}</p>
                            {crit.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{crit.description}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCriterion(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 shrink-0"
                            title="Remove criterion"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add Criterion Form */}
                  <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-2.5">
                    <p className="text-[11px] font-semibold text-slate-300">Add Custom Evaluation Criterion</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Criterion name (e.g. System Architecture)"
                        value={newCritName}
                        onChange={e => setNewCritName(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="Description / guidance for interviewers"
                        value={newCritDesc}
                        onChange={e => setNewCritDesc(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={addCriterion}
                        disabled={!newCritName.trim()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                      >
                        <Plus size={13} /> Add Criterion
                      </button>
                    </div>
                  </div>

                  {/* Sourcing Cost Section */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <DollarSign size={14} className="text-emerald-400" /> Recruiting & Sourcing Budget
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Total allocated cost for job boards, recruiters, or promotions. Used to calculate Cost Per Hire in HR Analytics.
                        </p>
                      </div>
                      <div className="relative w-48 shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">₱ / $</span>
                        <input
                          type="number"
                          placeholder="e.g. 50000"
                          value={formData.sourcingCost}
                          onChange={e => setFormData(p => ({ ...p, sourcingCost: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-11 pr-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* STEP 4: REVIEW & LINKEDIN-STYLE PREVIEW */}
            {currentStep === 'preview' && (
              <div className="space-y-6">
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Eye size={15} className="text-indigo-400" /> Applicant Perspective Preview
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      This is how qualified job seekers in the Philippines will see your posting.
                    </p>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                    <CheckCircle2 size={12} /> Ready for publishing
                  </span>
                </div>

                {/* LinkedIn Job Card Preview */}
                <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                  {/* Banner / Card Header */}
                  <div className="p-6 border-b border-slate-800/80 bg-gradient-to-r from-slate-900 to-indigo-950/40">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
                          {formData.title?.charAt(0).toUpperCase() || 'J'}
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold text-slate-100">
                            {formData.title || 'Untitled Role'}
                          </h3>
                          <p className="text-xs text-indigo-300 font-medium">
                            {formData.department} Team • Tidal ATS (Philippines)
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1">
                            <span className="flex items-center gap-1">
                              <MapPin size={13} className="text-slate-500" /> {formData.location || 'BGC, Taguig'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Briefcase size={13} className="text-slate-500" /> {formData.type}
                            </span>
                            <span>•</span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] text-slate-300">
                              {formData.workplaceType}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right sm:self-center">
                        <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl block sm:inline-block">
                          {formData.salaryRange || 'Competitive (PHP)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Role Highlights Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-800 text-center divide-x divide-slate-800 bg-slate-950/60 text-xs py-3">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Seniority</span>
                      <span className="font-semibold text-slate-200 mt-0.5 block">{formData.experienceLevel}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Must-Have Skills</span>
                      <span className="font-semibold text-indigo-400 mt-0.5 block">{requiredSkills.length} defined</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Preferred Skills</span>
                      <span className="font-semibold text-purple-400 mt-0.5 block">{nonRequiredSkills.length} defined</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">Screening Math</span>
                      <span className="font-semibold text-emerald-400 mt-0.5 block">{totalWeight}% Configured</span>
                    </div>
                  </div>

                  {/* Job Content Body */}
                  <div className="p-6 space-y-6">
                    {/* Skills Section */}
                    {(requiredSkills.length > 0 || nonRequiredSkills.length > 0) && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Candidate Skill Profiling
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {requiredSkills.map(s => (
                            <span key={s} className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <ShieldCheck size={12} /> {s} (Required)
                            </span>
                          ))}
                          {nonRequiredSkills.map(s => (
                            <span key={s} className="bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <Sparkles size={12} /> {s} (Bonus)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ATS Scoring Breakdown Card */}
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200 flex items-center gap-1.5">
                          <Settings2 size={13} className="text-indigo-400" /> ATS Automatic Match Rubric
                        </span>
                        <span className="text-[11px] text-slate-400">Total weight: {totalWeight}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Must-have Skills</span>
                          <span className="font-bold text-indigo-400">{formData.scoringWeights.requiredSkills}%</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Nice-to-have Skills</span>
                          <span className="font-bold text-purple-400">{formData.scoringWeights.nonRequiredSkills}%</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Work Experience</span>
                          <span className="font-bold text-amber-400">{formData.scoringWeights.experience}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Description Render */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        About the Role & Requirements
                      </h4>
                      <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-900/60 p-4 rounded-2xl border border-slate-800 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {formData.description || 'No description provided.'}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Modal Footer Controls */}
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
            <div>
              {job && onDelete ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmation(true)}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                >
                  <Trash2 size={13} /> Delete Posting
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2.5">
              {currentStep !== 'basics' ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
              )}

              {currentStep !== 'preview' ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
                >
                  Next Step <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReviewAndSubmit}
                  disabled={isSubmitting || totalWeight !== 100}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <CheckCircle2 size={15} />
                  {job ? 'Save & Update Job' : 'Publish Job Opening'}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Confirmation Modal for Job Save / Update (POST & PUT) */}
      <ConfirmationModal
        isOpen={showSaveConfirmation}
        onClose={() => setShowSaveConfirmation(false)}
        onConfirm={handleExecuteSave}
        isLoading={isSubmitting}
        title={job ? 'Confirm Job Updates' : 'Confirm Publishing Job Opening'}
        message={
          job
            ? `Are you sure you want to save changes to "${formData.title}"? Existing and incoming candidate screening will use these updated requirements and weights.`
            : `Are you sure you want to publish "${formData.title}" to the board? Qualified applicants will be able to discover and apply for this opening.`
        }
        details={{
          'Role Title': formData.title,
          'Location': formData.location,
          'Workplace Policy': formData.workplaceType,
          'Compensation': formData.salaryRange || 'Competitive (PHP)',
          'Must-Have Skills': `${requiredSkills.length} skills defined`,
          'Scoring Weights': `Required: ${formData.scoringWeights.requiredSkills}%, Preferred: ${formData.scoringWeights.nonRequiredSkills}%, Experience: ${formData.scoringWeights.experience}%`
        }}
        confirmText={job ? 'Save Changes' : 'Confirm & Publish'}
        variant="primary"
      />

      {/* Confirmation Modal for Job Deletion (DELETE) */}
      {job && onDelete && (
        <ConfirmationModal
          isOpen={showDeleteConfirmation}
          onClose={() => setShowDeleteConfirmation(false)}
          onConfirm={() => {
            setShowDeleteConfirmation(false);
            onDelete(job);
          }}
          title="Delete Job Opening"
          message={`Are you sure you want to delete the job opening "${job.title}"? This will permanently remove the posting.`}
          confirmText="Yes, Delete Job"
          variant="danger"
          icon={Trash2}
        />
      )}
    </>
  );
}
