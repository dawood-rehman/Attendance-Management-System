'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { StatCard, Card } from '@/components/ui';
import { Users, GraduationCap, Clock, CheckCircle } from 'lucide-react';
import { apiCall } from '@/utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

interface Stats {
  totalTeachers: number;
  totalStudents: number;
  pendingApprovals: number;
  todayTeacherAttendance: number;
}

interface WeeklyEntry {
  _id: { date: string; status: string; role: string };
  count: number;
}

interface ChartPoint { date: string; present: number; absent: number; }

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall<{ stats: Stats; weeklyAttendance: WeeklyEntry[] }>('/api/admin/stats')
      .then(({ stats, weeklyAttendance }) => {
        setStats(stats);
        // Build chart
        const map: Record<string, ChartPoint> = {};
        weeklyAttendance.forEach((e) => {
          const d = e._id.date;
          if (!map[d]) map[d] = { date: format(new Date(d), 'MMM dd'), present: 0, absent: 0 };
          if (e._id.status === 'present') map[d].present += e.count;
          if (e._id.status === 'absent') map[d].absent += e.count;
        });
        setChartData(Object.values(map));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold text-white">
          Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'},{' '}
          <span className="text-gradient">{user?.name?.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-white/40 mt-1">Here&apos;s what&apos;s happening across your school today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up-delay-1">
        <StatCard
          title="Total Teachers"
          value={stats?.totalTeachers ?? '—'}
          icon={<Users size={20} />}
          color="blue"
          subtitle="Active accounts"
        />
        <StatCard
          title="Total Students"
          value={stats?.totalStudents ?? '—'}
          icon={<GraduationCap size={20} />}
          color="purple"
          subtitle="Across all teachers"
        />
        <StatCard
          title="Pending Approvals"
          value={stats?.pendingApprovals ?? '—'}
          icon={<Clock size={20} />}
          color="amber"
          subtitle="Requires your attention"
        />
        <StatCard
          title="Present Today"
          value={stats?.todayTeacherAttendance ?? '—'}
          icon={<CheckCircle size={20} />}
          color="green"
          subtitle="Teachers marked present"
        />
      </div>

      {/* Chart */}
      <div className="animate-fade-up-delay-2">
        <Card>
          <h2 className="font-display font-semibold text-white mb-6">Weekly Attendance Overview</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e2032', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f0f2f8' }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
                <Bar dataKey="present" fill="#2d6be4" radius={[4, 4, 0, 0]} name="Present" />
                <Bar dataKey="absent" fill="rgba(239,68,68,0.6)" radius={[4, 4, 0, 0]} name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-white/30 text-sm">
              No attendance data for this week
            </div>
          )}
        </Card>
      </div>

      {/* Quick actions */}
      <div className="animate-fade-up-delay-3">
        <h2 className="font-display font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/dashboard/admin/users', label: 'Manage Users', icon: '👥', desc: 'Approve / reject accounts' },
            { href: '/dashboard/admin/attendance', label: 'Mark Attendance', icon: '✅', desc: 'Record teacher attendance' },
            { href: '/dashboard/admin/ai-assistant', label: 'AI Assistant', icon: '🤖', desc: 'Use AI to manage attendance' },
          ].map((a) => (
            <a key={a.href} href={a.href}
              className="card p-4 hover:border-brand-500/30 hover:bg-brand-600/5 transition-all duration-150 group">
              <div className="text-2xl mb-2">{a.icon}</div>
              <div className="font-semibold text-sm text-white group-hover:text-brand-300 transition-colors">{a.label}</div>
              <div className="text-xs text-white/35 mt-0.5">{a.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
