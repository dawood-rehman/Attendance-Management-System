'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Card } from '@/components/ui';
import { User, Lock, Save, Shield } from 'lucide-react';
import { apiCall } from '@/utils/api';
import { AuthProvider } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import Sidebar from '@/components/layout/Sidebar';

function ProfileContent() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcePassword = searchParams.get('forcePassword') === '1' || Boolean(user?.mustChangePassword);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiCall('/api/settings', { method: 'PATCH', body: JSON.stringify({ name, email }) });
      await refreshUser();
      toast.success('Profile updated');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) return toast.error('Passwords do not match');
    if (newPw.length < 6) return toast.error('Password must be at least 6 characters');
    setSavingPw(true);
    try {
      await apiCall('/api/settings', { method: 'PATCH', body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) });
      toast.success('Password updated');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      await refreshUser();
      if (forcePassword && user) router.push(`/dashboard/${user.role}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-xl space-y-6 animate-fade-up">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Profile</h1>
            <p className="text-white/40 text-sm mt-0.5">Manage your account details and password</p>
          </div>

          {forcePassword && (
            <Card className="border-amber-500/20 bg-amber-500/10">
              <div className="font-display font-semibold text-amber-200">Password change required</div>
              <p className="mt-1 text-sm text-amber-100/70">
                Update your default password before using the rest of the system.
              </p>
            </Card>
          )}

          <Card className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl font-display">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-display font-semibold text-white">{user?.name}</div>
              <div className="text-sm text-white/40">{user?.email}</div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full border capitalize font-medium ${
                  user?.role === 'admin' ? 'bg-purple-500/15 text-purple-300 border-purple-500/25' :
                  user?.role === 'teacher' ? 'bg-brand-500/15 text-brand-300 border-brand-500/25' :
                  'bg-cyan-500/15 text-cyan-300 border-cyan-500/25'
                }`}>{user?.role}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25 capitalize">{user?.status}</span>
              </div>
            </div>
            <div className="ml-auto">
              <Shield size={20} className="text-white/20" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-5">
              <User size={18} className="text-brand-400" />
              <h2 className="font-display font-semibold text-white">Personal Information</h2>
            </div>
            <form onSubmit={saveProfile} className="space-y-4">
              <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" loading={savingProfile}>
                <Save size={14} /> Save Profile
              </Button>
            </form>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-5">
              <Lock size={18} className="text-brand-400" />
              <h2 className="font-display font-semibold text-white">Change Password</h2>
            </div>
            <form onSubmit={changePassword} className="space-y-4">
              <Input label="Current Password" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
              <Input label="New Password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} hint="At least 6 characters" required />
              <Input label="Confirm Password" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
              <Button type="submit" loading={savingPw}>
                <Lock size={14} /> Update Password
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <ProfileContent />
      </Suspense>
    </AuthProvider>
  );
}
