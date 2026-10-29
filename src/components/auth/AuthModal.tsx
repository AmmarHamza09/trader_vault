import React, { useState } from 'react';
import { X, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuthActions } from '@convex-dev/auth/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>(initialMode);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const switchMode = (next: 'login' | 'signup' | 'forgot' | 'reset') => {
    setMode(next);
    setError('');
    setNotice('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        // Always move on, so the page never reveals whether an email has an account.
        try {
          await signIn('password', { email: email.trim().toLowerCase(), flow: 'reset' });
        } catch (err: any) {
          if (/isn't set up|Couldn't send/i.test(err?.message || '')) throw err;
        }
        setMode('reset');
        setNotice('If that email has an account, we sent an 8-digit code. It works for 15 minutes.');
        return;
      }
      if (mode === 'reset') {
        await signIn('password', { email: email.trim().toLowerCase(), code: code.trim(), newPassword: password, flow: 'reset-verification' });
        return;
      }
      await signIn('password', {
        email: email.trim().toLowerCase(),
        password,
        flow: mode === 'login' ? 'signIn' : 'signUp',
        ...(mode === 'signup' ? { name: name.trim() } : {}),
      });
    } catch (err: any) {
      const message: string = err?.message || '';
      if (mode === 'forgot') {
        setError("We couldn't send the email right now. Please try again in a little while.");
      } else if (mode === 'reset') {
        setError(/Invalid password/i.test(message) ? 'Choose a password with at least 8 characters.' : 'That code is wrong or has expired. Check it, or request a new one.');
      } else if (message.includes('InvalidAccountId') || message.includes('InvalidSecret')) {
        setError('Incorrect email or password.');
      } else if (message.toLowerCase().includes('already')) {
        setError('An account with this email already exists — try signing in instead.');
      } else if (message) {
        setError((message.match(/Uncaught Error:\s*([^\n]*)/)?.[1] ?? message.split('\n')[0]).trim());
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-800/25 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto animate-modalIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="TraderVault" className="h-9 w-auto object-contain" />
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 whitespace-nowrap">
                {mode === 'login' ? '👋 Sign In' : mode === 'signup' ? '✨ Create Account' : '🔑 Reset password'}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'login' ? 'Access your trading journal' : mode === 'signup' ? 'Start your trading journey' : mode === 'forgot' ? 'We’ll email you a code' : 'Enter the code and a new password'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {(mode === 'login' || mode === 'signup') && (
        <div className="flex border-b border-slate-100 bg-slate-50 p-1.5 gap-1">
          <button
            onClick={() => switchMode('login')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => switchMode('signup')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign Up
          </button>
        </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {notice && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{notice}</div>
          )}

          {mode === 'reset' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">8-digit code from your email</label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="12345678"
                className="w-full px-3 py-2 text-sm tracking-[0.3em] rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          {mode !== 'forgot' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{mode === 'reset' ? 'New password' : 'Password'}</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {mode === 'login' && (
              <button type="button" onClick={() => switchMode('forgot')} className="mt-1.5 text-xs font-medium text-emerald-700 hover:underline">
                Forgot password?
              </button>
            )}
          </div>
          )}

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Email me a code' : 'Set new password'}
          </button>
          {(mode === 'forgot' || mode === 'reset') && (
            <button type="button" onClick={() => switchMode('login')} className="w-full text-xs text-slate-500 hover:text-slate-700">
              ← Back to sign in
            </button>
          )}
        </form>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure • Private • Isolated</span>
          </div>
        </div>
      </div>
    </div>
  );
};
