'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { KeyRound, Mail, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 'email' | 'pin' | 'password';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devPin, setDevPin] = useState('');
  const [loading, setLoading] = useState(false);

  const requestPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDevPin(data.devPin || '');
      setStep('pin');
      toast.success('Reset PIN sent');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const verifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep('password');
      toast.success('PIN verified');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Password reset successfully');
      router.push('/login');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-500/30 mb-4">
          {step === 'email' ? <Mail size={24} className="text-brand-400" /> : <KeyRound size={24} className="text-brand-400" />}
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-1">Reset password</h1>
        <p className="text-white/40 text-sm">Recover access with your email PIN</p>
      </div>

      <div className="card p-6">
        {step === 'email' && (
          <form onSubmit={requestPin} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.com"
              required
            />
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Send PIN
            </Button>
          </form>
        )}

        {step === 'pin' && (
          <form onSubmit={verifyPin} className="space-y-4">
            <Input
              label="Reset PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              required
            />
            {devPin && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Development PIN: <span className="font-semibold tracking-widest">{devPin}</span>
              </div>
            )}
            <Button type="submit" fullWidth size="lg" loading={loading}>
              <ShieldCheck size={16} /> Verify PIN
            </Button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={resetPassword} className="space-y-4">
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Minimum 6 characters"
              required
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Reset Password
            </Button>
          </form>
        )}

        <div className="mt-4 pt-4 border-t border-white/5 text-center">
          <Link href="/login" className="text-sm text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
