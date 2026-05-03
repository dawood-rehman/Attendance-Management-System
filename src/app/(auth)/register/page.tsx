'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { Chrome, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const googleError = new URLSearchParams(window.location.search).get('googleError');
    if (googleError) {
      const messages: Record<string, string> = {
        missing_config: 'Google sign-up is not configured yet',
        email_not_verified: 'Google email is not verified',
        oauth_failed: 'Google sign-up failed',
        invalid_state: 'Google sign-up session expired',
      };
      toast.error(messages[googleError] || 'Google sign-up failed');
    }
  }, []);

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('Please fill in all fields');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Registration submitted! Awaiting admin approval.');
      router.push('/login');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-500/30 mb-4">
          <Sparkles size={24} className="text-brand-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-1">Create account</h1>
        <p className="text-white/40 text-sm">Join AttendanceIQ today</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Full Name" placeholder="John Smith" value={form.name} onChange={update('name')} required />
          <Input label="Email" type="email" placeholder="you@school.com" value={form.email} onChange={update('email')} required />
          <Input label="Password" type="password" placeholder="••••••••" value={form.password} onChange={update('password')} hint="Minimum 6 characters" required />
          <Select
            label="Role"
            value={form.role}
            onChange={update('role')}
            options={[
              { value: 'student', label: '🎓 Student' },
              { value: 'teacher', label: '🏫 Teacher' },
            ]}
          />

          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-300/80">
              ℹ️ New accounts require admin approval before you can log in.
            </p>
          </div>

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Create Account
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
          onClick={() => { window.location.href = `/api/auth/google/start?mode=register&role=${form.role}`; }}
        >
          <Chrome size={16} /> Continue with Google
        </Button>

        <div className="mt-4 pt-4 border-t border-white/5 text-center">
          <p className="text-sm text-white/40">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
