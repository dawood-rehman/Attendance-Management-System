'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, Users, BookOpen, CheckSquare, BarChart3,
  Brain, Mail, Settings, LogOut, ChevronRight, Sparkles, GraduationCap,
  Building2, School,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const adminNav: NavItem[] = [
  { href: '/dashboard/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/dashboard/admin/departments', label: 'Departments', icon: <Building2 size={18} /> },
  { href: '/dashboard/admin/teachers', label: 'Teachers', icon: <GraduationCap size={18} /> },
  { href: '/dashboard/admin/students', label: 'Students', icon: <School size={18} /> },
  { href: '/dashboard/admin/lectures', label: 'Lectures', icon: <BookOpen size={18} /> },
  { href: '/dashboard/admin/messages', label: 'Messages', icon: <Mail size={18} /> },
  { href: '/dashboard/admin/users', label: 'User Management', icon: <Users size={18} /> },
  { href: '/dashboard/admin/attendance', label: 'Teacher Attendance', icon: <CheckSquare size={18} /> },
  { href: '/dashboard/admin/reports', label: 'Reports', icon: <BarChart3 size={18} /> },
  { href: '/dashboard/admin/ai-assistant', label: 'AI Assistant', icon: <Brain size={18} />, badge: 'AI' },
];

const teacherNav: NavItem[] = [
  { href: '/dashboard/teacher', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/dashboard/teacher/classes', label: 'Classes', icon: <School size={18} /> },
  { href: '/dashboard/teacher/lectures', label: 'My Lectures', icon: <BookOpen size={18} /> },
  { href: '/dashboard/teacher/students', label: 'My Students', icon: <GraduationCap size={18} /> },
  { href: '/dashboard/teacher/messages', label: 'Messages', icon: <Mail size={18} /> },
  { href: '/dashboard/teacher/attendance', label: 'Mark Attendance', icon: <CheckSquare size={18} /> },
  { href: '/dashboard/teacher/reports', label: 'Reports', icon: <BarChart3 size={18} /> },
  { href: '/dashboard/teacher/ai-chart', label: 'AI Chart', icon: <Brain size={18} />, badge: 'AI' },
  { href: '/dashboard/teacher/ai-email', label: 'AI Email', icon: <Mail size={18} />, badge: 'AI' },
];

const studentNav: NavItem[] = [
  { href: '/dashboard/student', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/dashboard/student/lectures', label: 'Lectures', icon: <BookOpen size={18} /> },
  { href: '/dashboard/student/messages', label: 'Messages', icon: <Mail size={18} /> },
  { href: '/dashboard/student/attendance', label: 'My Attendance', icon: <CheckSquare size={18} /> },
];

const navByRole: Record<string, NavItem[]> = {
  admin: adminNav,
  teacher: teacherNav,
  student: studentNav,
};

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;
  const nav = navByRole[user.role] || [];

  return (
    <>
    {open && (
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
      />
    )}
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-200 lg:z-30 lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
      style={{ background: '#0f111a', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
        <div className="p-2 rounded-xl bg-brand-600/20 border border-brand-500/30">
          <Sparkles size={18} className="text-brand-400" />
        </div>
        <div>
          <div className="font-display font-bold text-white text-sm leading-none">AttendanceIQ</div>
          <div className="text-xs text-white/35 mt-0.5">Smart Management</div>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-3 mx-3 mt-3 rounded-xl bg-white/[0.03] border border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{user.name}</div>
            <div className="text-xs text-white/40 capitalize">{user.role}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="text-xs font-semibold text-white/25 px-3 mb-2 uppercase tracking-wider">Menu</div>
        {nav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard/admin' && item.href !== '/dashboard/teacher' && item.href !== '/dashboard/student' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group relative',
                isActive
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-500/25'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              )}
            >
              <span className={clsx('shrink-0 transition-colors', isActive ? 'text-brand-400' : 'group-hover:text-white/70')}>
                {item.icon}
              </span>
              <span className="flex-1 font-medium">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  {item.badge}
                </span>
              )}
              {isActive && <ChevronRight size={14} className="text-brand-400 shrink-0" />}
            </Link>
          );
        })}

        <div className="pt-3 mt-3 border-t border-white/5">
          <Link
            href="/profile"
            onClick={onClose}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
              pathname === '/profile'
                ? 'bg-brand-600/20 text-brand-300 border border-brand-500/25'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            )}
          >
            <Settings size={18} className="shrink-0" />
            <span className="font-medium">Profile</span>
          </Link>
        </div>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={() => {
            onClose?.();
            logout();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-red-400 hover:bg-red-500/5 transition-all duration-150"
        >
          <LogOut size={18} className="shrink-0" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
    </>
  );
}
