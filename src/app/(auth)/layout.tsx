'use client';
import { AuthProvider } from '@/hooks/useAuth';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-pattern opacity-50" style={{ backgroundSize: '40px 40px' }} />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 w-full max-w-sm">{children}</div>
      </div>
    </AuthProvider>
  );
}
