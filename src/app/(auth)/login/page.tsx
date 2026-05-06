'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';
import { Chrome, Sparkles, Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleError = params.get('googleError');
    if (params.get('registered') === '1') {
      toast.success('Registration submitted. Awaiting admin approval.');
    }
    if (googleError) {
      const messages: Record<string, string> = {
        missing_config: 'Google sign-in is not configured yet',
        not_registered: 'No account found for that Google email',
        pending: 'Your account is pending admin approval',
        rejected: 'Your account has been rejected',
        email_not_verified: 'Google email is not verified',
        oauth_failed: 'Google sign-in failed',
        invalid_state: 'Google sign-in session expired',
      };
      toast.error(messages[googleError] || 'Google sign-in failed');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill in all fields');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-500/30 mb-4">
          <Sparkles size={24} className="text-brand-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-1">Welcome back</h1>
        <p className="text-white/40 text-sm">Sign in to AttendanceIQ</p>
      </div>

      {/* Card */}
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none z-10" style={{marginTop: '12px'}} />
            <Input
              label="Email address"
              type="email"
              placeholder="you@school.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              autoComplete="email"
              required
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none z-10" style={{marginTop: '12px'}} />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
            Sign In
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-xs text-white/30">or</span>
          <div className="h-px flex-1 bg-white/5" />
        </div>

        <Button
          type="button"
          variant="outline"
          fullWidth
          onClick={() => { window.location.href = '/api/auth/google/start?mode=login'; }}
        >
          <Chrome size={16} /> Continue with Google
        </Button>

        <div className="mt-4 pt-4 border-t border-white/5 text-center space-y-2">
          <Link href="/forgot-password" className="text-sm text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Forgot password?
          </Link>
          <p className="text-sm text-white/40">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
