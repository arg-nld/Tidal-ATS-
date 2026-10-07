import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Briefcase, ShieldCheck, Eye, EyeOff, ArrowRight,
  Mail, Lock, User, AlertCircle, Sparkles, CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { api } from '../../services/api';

const DEMO_ACCOUNTS = [
  { label: 'HR Demo', email: 'hr@tidalats.com', password: 'password123', role: 'hr' },
  { label: 'Applicant Demo', email: 'jordan.hayes@example.com', password: 'password123', role: 'applicant' },
];

export function AuthPage() {
  const { login, register, loading, authError, clearAuthError } = useAuth();
  const [mode, setMode] = useState(window.location.pathname === '/verify-email' ? 'verify' : 'signin');
  const [selectedRole, setSelectedRole] = useState('applicant');
  const [showPass, setShowPass] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [verificationMessage, setVerificationMessage] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [signInForm, setSignInForm] = useState({ email: '', password: '' });
  const [signUpForm, setSignUpForm] = useState({
    firstName: '', lastName: '', middleInitial: '', suffix: '',
    email: '', password: '', confirm: ''
  });

  useEffect(() => { clearAuthError(); setLocalError(null); }, [mode, clearAuthError]);

  const error = localError || authError;
  const verificationToken = useMemo(() => new URLSearchParams(window.location.search).get('token'), []);

  useEffect(() => {
    if (mode !== 'verify' || !verificationToken) return;
    setVerificationLoading(true);
    api.auth.verifyEmail(verificationToken)
      .then(res => setVerificationMessage(res.message || 'Email verified successfully.'))
      .catch(err => setLocalError(err.message || 'Verification failed.'))
      .finally(() => setVerificationLoading(false));
  }, [mode, verificationToken]);

  const handleSignIn = async e => {
    e.preventDefault();
    setLocalError(null);
    if (!signInForm.email || !signInForm.password) {
      setLocalError('Please enter your email and password.');
      return;
    }
    try { await login(signInForm); } catch { /* handled in context */ }
  };

  const handleSignUp = async e => {
    e.preventDefault();
    setLocalError(null);
    if (!signUpForm.firstName.trim() || !signUpForm.lastName.trim() || !signUpForm.email.trim() || !signUpForm.password) {
      setLocalError('First name, last name, email, and password are required.');
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
      const result = await register({ ...signUpForm, role: selectedRole });
      setMode('verificationSent');
      setLocalError(null);
      setVerificationMessage(result.message || `Verification email sent to ${signUpForm.email}.`);
    } catch { /* handled in context */ }
  };

  const fillDemo = demo => {
    setMode('signin');
    setSignInForm({ email: demo.email, password: demo.password });
    setLocalError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-2xl" />
      </div>

      <div className="relative w-full max-w-lg z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 shadow-2xl shadow-indigo-500/30 mb-4">
            <Sparkles size={26} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Tidal Nexus</h1>
          <p className="text-slate-400 text-sm mt-1">Applicant Tracking System</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">
          {mode !== 'verify' && mode !== 'verificationSent' && (
            <div className="flex border-b border-slate-800 bg-slate-950/40">
              {[{ id: 'signin', label: 'Sign In' }, { id: 'signup', label: 'Create Account' }].map(tab => (
                <button key={tab.id} onClick={() => setMode(tab.id)} className={`flex-1 py-3.5 text-sm font-semibold ${mode === tab.id ? 'text-indigo-300 border-b-2 border-indigo-500 bg-indigo-500/5' : 'text-slate-500 hover:text-slate-300'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="p-6 sm:p-8">
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="email" required autoComplete="email" value={signInForm.email} onChange={e => setSignInForm({ ...signInForm, email: e.target.value })} placeholder="you@example.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type={showPass ? 'text' : 'password'} required autoComplete="current-password" value={signInForm.password} onChange={e => setSignInForm({ ...signInForm, password: e.target.value })} placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{showPass ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm flex items-center justify-center gap-2">
                  {loading ? 'Signing in...' : <>Sign In <ArrowRight size={16} /></>}
                </button>
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mb-2.5">Quick Demo Access</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO_ACCOUNTS.map(demo => (
                      <button key={demo.email} type="button" onClick={() => fillDemo(demo)} className="group flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 text-left">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${demo.role === 'hr' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {demo.role === 'hr' ? <ShieldCheck size={14} /> : <Briefcase size={14} />}
                        </div>
                        <div className="min-w-0"><div className="text-[11px] font-semibold text-slate-300">{demo.label}</div><div className="text-[10px] text-slate-500 truncate">{demo.email}</div></div>
                        <ChevronRight size={12} className="ml-auto text-slate-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-center text-xs text-slate-500">Don&apos;t have an account? <button type="button" onClick={() => setMode('signup')} className="text-indigo-400 font-semibold">Create one</button></p>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">I am joining as...</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ id: 'applicant', label: 'Job Applicant', icon: Briefcase }, { id: 'hr', label: 'HR / Recruiter', icon: ShieldCheck }].map(r => (
                      <button key={r.id} type="button" onClick={() => setSelectedRole(r.id)} className={`p-3 rounded-xl border text-left ${selectedRole === r.id ? 'bg-indigo-600/10 border-indigo-500/60' : 'bg-slate-950 border-slate-800'}`}>
                        <r.icon size={16} className={selectedRole === r.id ? 'text-indigo-400 mb-1' : 'text-slate-500 mb-1'} />
                        <div className="text-xs font-bold text-slate-100">{r.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-slate-400 mb-1.5">First Name *</label><input required value={signUpForm.firstName} onChange={e => setSignUpForm({ ...signUpForm, firstName: e.target.value })} placeholder="First name" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100" /></div>
                  <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Last Name *</label><input required value={signUpForm.lastName} onChange={e => setSignUpForm({ ...signUpForm, lastName: e.target.value })} placeholder="Last name" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100" /></div>
                  <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Middle Initial</label><input maxLength={1} value={signUpForm.middleInitial} onChange={e => setSignUpForm({ ...signUpForm, middleInitial: e.target.value.slice(0,1) })} placeholder="M" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100" /></div>
                  <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Suffix</label><input value={signUpForm.suffix} onChange={e => setSignUpForm({ ...signUpForm, suffix: e.target.value })} placeholder="Jr., III" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100" /></div>
                </div>

                <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address *</label><div className="relative"><Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" /><input type="email" required autoComplete="email" value={signUpForm.email} onChange={e => setSignUpForm({ ...signUpForm, email: e.target.value })} placeholder="you@example.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100" /></div></div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Password *</label><input type={showPass ? 'text' : 'password'} required value={signUpForm.password} onChange={e => setSignUpForm({ ...signUpForm, password: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100" /></div>
                  <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password *</label><input type={showPass ? 'text' : 'password'} required value={signUpForm.confirm} onChange={e => setSignUpForm({ ...signUpForm, confirm: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100" /></div>
                </div>
                <button type="button" onClick={() => setShowPass(!showPass)} className="text-[11px] text-slate-500">{showPass ? 'Hide passwords' : 'Show passwords'}</button>
                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm flex items-center justify-center gap-2">
                  {loading ? 'Creating account...' : <>Create {selectedRole === 'hr' ? 'HR' : 'Applicant'} Account <ArrowRight size={16} /></>}
                </button>
                <p className="text-[11px] text-slate-500 text-center">You will need to verify your email before you can sign in.</p>
                <p className="text-center text-xs text-slate-500">Already have an account? <button type="button" onClick={() => setMode('signin')} className="text-indigo-400 font-semibold">Sign in</button></p>
              </form>
            )}

            {mode === 'verificationSent' && (
              <div className="text-center space-y-4 py-5">
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto"><Mail size={28} /></div>
                <h3 className="text-xl font-bold text-slate-100">Verify your email</h3>
                <p className="text-sm text-slate-300">{verificationMessage}</p>
                <p className="text-xs text-slate-500">Open the verification link in your email, then return here and sign in.</p>
                <button onClick={() => setMode('signin')} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold">Back to Sign In</button>
              </div>
            )}

            {mode === 'verify' && (
              <div className="text-center space-y-4 py-5">
                {verificationLoading ? <><div className="w-10 h-10 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin mx-auto" /><p className="text-sm text-slate-300">Verifying your email...</p></> : verificationMessage ? <><div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto"><CheckCircle2 size={30} /></div><h3 className="text-xl font-bold text-slate-100">Email verified</h3><p className="text-sm text-slate-300">{verificationMessage}</p><button onClick={() => setMode('signin')} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold">Continue to Sign In</button></> : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
