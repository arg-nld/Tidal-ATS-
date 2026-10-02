import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Briefcase, ShieldCheck, Eye, EyeOff, ArrowRight,
  Mail, Lock, User, AlertCircle,
  Sparkles, CheckCircle2, ChevronRight
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  { label: 'HR Demo', email: 'hr@tidalats.com', password: 'password123', role: 'hr' },
  { label: 'Applicant Demo', email: 'jordan.hayes@example.com', password: 'password123', role: 'applicant' },
];

export function AuthPage() {
  const { login, register, loading, authError, clearAuthError } = useAuth();

  const [mode, setMode] = useState('signin');
  const [selectedRole, setSelectedRole] = useState('applicant');
  const [showPass, setShowPass] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [signInForm, setSignInForm] = useState({ email: '', password: '' });
  const [signUpForm, setSignUpForm] = useState({
    name: '', email: '', password: '', confirm: ''
  });

  useEffect(() => { clearAuthError(); setLocalError(null); }, [mode]);

  const error = localError || authError;

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!signInForm.email || !signInForm.password) {
      setLocalError('Please enter your email and password.');
      return;
    }
    try {
      await login({ email: signInForm.email, password: signInForm.password });
    } catch { /* authError already set in context */ }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!signUpForm.name || !signUpForm.email || !signUpForm.password) {
      setLocalError('Name, email and password are required.');
      return;
    }
    if (signUpForm.password !== signUpForm.confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (signUpForm.password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    try {
      await register({
        name: signUpForm.name,
        email: signUpForm.email,
        password: signUpForm.password,
        role: selectedRole
      });
    } catch { /* authError already set in context */ }
  };

  const fillDemo = (demo) => {
    setMode('signin');
    setSignInForm({ email: demo.email, password: demo.password });
    setLocalError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-2xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />
      </div>

      <div className="relative w-full max-w-md z-10">

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 shadow-2xl shadow-indigo-500/30 mb-4">
            <Sparkles size={26} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Tidal Nexus</h1>
          <p className="text-slate-400 text-sm mt-1">Applicant Tracking System</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">

          {/* Tab Toggle */}
          <div className="flex border-b border-slate-800 bg-slate-950/40">
            {[
              { id: 'signin', label: 'Sign In' },
              { id: 'signup', label: 'Create Account' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
                  mode === tab.id
                    ? 'text-indigo-300 border-b-2 border-indigo-500 bg-indigo-500/5'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">

            {/* Error Banner */}
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* SIGN IN FORM */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={signInForm.email}
                      onChange={e => setSignInForm({ ...signInForm, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={signInForm.password}
                      onChange={e => setSignInForm({ ...signInForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <>Sign In <ArrowRight size={16} /></>
                  )}
                </button>

                {/* Demo Accounts */}
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-2.5">Quick Demo Access</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO_ACCOUNTS.map(demo => (
                      <button
                        key={demo.email}
                        type="button"
                        onClick={() => fillDemo(demo)}
                        className="group flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 hover:bg-indigo-950/20 transition-all text-left"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          demo.role === 'hr'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {demo.role === 'hr' ? <ShieldCheck size={14} /> : <Briefcase size={14} />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-slate-300 group-hover:text-indigo-300 transition-colors">{demo.label}</div>
                          <div className="text-[10px] text-slate-500 truncate">{demo.email}</div>
                        </div>
                        <ChevronRight size={12} className="ml-auto text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-center text-xs text-slate-500 pt-1">
                  Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => setMode('signup')} className="text-indigo-400 hover:text-indigo-300 font-semibold">
                    Create one
                  </button>
                </p>
              </form>
            )}

            {/* SIGN UP FORM */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">

                {/* Role Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">I am joining as...</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'applicant', label: 'Job Applicant', icon: Briefcase, desc: 'Browse & apply for roles', color: 'emerald' },
                      { id: 'hr', label: 'HR / Recruiter', icon: ShieldCheck, desc: 'Manage candidates & hiring', color: 'indigo' }
                    ].map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRole(r.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          selectedRole === r.id
                            ? r.color === 'indigo'
                              ? 'bg-indigo-600/10 border-indigo-500/60 shadow-md shadow-indigo-950/30'
                              : 'bg-emerald-600/10 border-emerald-500/60 shadow-md shadow-emerald-950/30'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <r.icon size={16} className={
                          selectedRole === r.id
                            ? (r.color === 'indigo' ? 'text-indigo-400 mb-1' : 'text-emerald-400 mb-1')
                            : 'text-slate-500 mb-1'
                        } />
                        <div className={`text-xs font-bold ${selectedRole === r.id ? 'text-slate-100' : 'text-slate-400'}`}>{r.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{r.desc}</div>
                        {selectedRole === r.id && (
                          <CheckCircle2 size={12} className={`mt-1 ${r.color === 'indigo' ? 'text-indigo-400' : 'text-emerald-400'}`} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={signUpForm.name}
                      onChange={e => setSignUpForm({ ...signUpForm, name: e.target.value })}
                      placeholder="Your full name"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={signUpForm.email}
                      onChange={e => setSignUpForm({ ...signUpForm, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    />
                  </div>
                </div>

                {/* Password row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        value={signUpForm.password}
                        onChange={e => setSignUpForm({ ...signUpForm, password: e.target.value })}
                        placeholder="Min. 6 chars"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        value={signUpForm.confirm}
                        onChange={e => setSignUpForm({ ...signUpForm, confirm: e.target.value })}
                        placeholder="Repeat password"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showPass ? 'Hide passwords' : 'Show passwords'}
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    <>Create {selectedRole === 'hr' ? 'HR' : 'Applicant'} Account <ArrowRight size={16} /></>
                  )}
                </button>

                <p className="text-center text-xs text-slate-500 pt-1">
                  Already have an account?{' '}
                  <button type="button" onClick={() => setMode('signin')} className="text-indigo-400 hover:text-indigo-300 font-semibold">
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          © 2026 Tidal Technologies · Secure ATS Platform
        </p>
      </div>
    </div>
  );
}
