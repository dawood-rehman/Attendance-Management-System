'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import { Menu } from 'lucide-react';

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && user?.mustChangePassword) {
      router.push('/profile?forcePassword=1');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <p className="text-white/40 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/10 bg-surface-950/90 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/70 transition hover:bg-white/[0.06] hover:text-white"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <div className="font-display text-sm font-bold text-white">AttendanceIQ</div>
          <div className="truncate text-xs capitalize text-white/35">{user.role} dashboard</div>
        </div>
      </div>
      <main className="min-h-screen overflow-x-hidden lg:ml-64">
        <div
          className="min-h-screen bg-grid-pattern"
          style={{ backgroundSize: '40px 40px' }}
        >
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardInner>{children}</DashboardInner>
    </AuthProvider>
  );
}
