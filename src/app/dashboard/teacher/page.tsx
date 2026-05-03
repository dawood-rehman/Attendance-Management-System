'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { StatCard, Card } from '@/components/ui';
import { GraduationCap, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { apiCall } from '@/utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, presentToday: 0, absentToday: 0, avgAttendance: 0 });
  const [chartData, setChartData] = useState<{date: string; present: number; absent: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [studentsRes, attendanceRes] = await Promise.all([
          apiCall<{ total: number }>('/api/teacher/students'),
          apiCall<{ records: {status: string; date: string}[] }>(
            `/api/attendance?role=student&startDate=${format(subDays(new Date(), 6), 'yyyy-MM-dd')}&endDate=${format(new Date(), 'yyyy-MM-dd')}`
          ),
        ]);

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todayRecords = attendanceRes.records.filter((r) =>
          format(new Date(r.date), 'yyyy-MM-dd') === todayStr
        );

        const presentToday = todayRecords.filter((r) => r.status === 'present').length;
        const absentToday = todayRecords.filter((r) => r.status === 'absent').length;

        // Build weekly chart
        const dayMap: Record<string, { present: number; absent: number }> = {};
        for (let i = 6; i >= 0; i--) {
          const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
          dayMap[d] = { present: 0, absent: 0 };
        }
        attendanceRes.records.forEach((r) => {
          const d = format(new Date(r.date), 'yyyy-MM-dd');
          if (dayMap[d]) {
            if (r.status === 'present' || r.status === 'late') dayMap[d].present++;
            else if (r.status === 'absent') dayMap[d].absent++;
          }
        });

        setStats({
          total: (studentsRes as {total: number}).total,
          presentToday,
          absentToday,
          avgAttendance: attendanceRes.records.length > 0
            ? Math.round((attendanceRes.records.filter((r) => r.status === 'present').length / attendanceRes.records.length) * 100)
            : 0,
        });
        setChartData(Object.entries(dayMap).map(([date, v]) => ({
          date: format(new Date(date), 'EEE'), ...v
        })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold text-white">
          Hello, <span className="text-gradient">{user?.name?.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-white/40 mt-1">Manage your students and track attendance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up-delay-1">
        <StatCard title="My Students" value={stats.total} icon={<GraduationCap size={20} />} color="blue" />
        <StatCard title="Present Today" value={stats.presentToday} icon={<CheckCircle size={20} />} color="green" />
        <StatCard title="Absent Today" value={stats.absentToday} icon={<XCircle size={20} />} color="red" />
        <StatCard title="Avg Attendance" value={`${stats.avgAttendance}%`} icon={<AlertCircle size={20} />} color="amber" />
      </div>

      <div className="animate-fade-up-delay-2">
        <Card>
          <h2 className="font-display font-semibold text-white mb-6">7-Day Attendance Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1e2032', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }} />
              <Bar dataKey="present" fill="#2d6be4" radius={[4,4,0,0]} name="Present" />
              <Bar dataKey="absent" fill="rgba(239,68,68,0.6)" radius={[4,4,0,0]} name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-up-delay-3">
        {[
          { href: '/dashboard/teacher/students', icon: '👥', label: 'Manage Students', desc: 'Add, edit, upload via Excel' },
          { href: '/dashboard/teacher/attendance', icon: '✅', label: 'Mark Attendance', desc: 'Record today\'s attendance' },
          { href: '/dashboard/teacher/ai-chart', icon: '📊', label: 'AI Analytics', desc: 'AI-powered attendance insights' },
        ].map((a) => (
          <a key={a.href} href={a.href} className="card p-4 hover:border-brand-500/30 hover:bg-brand-600/5 transition-all group">
            <div className="text-2xl mb-2">{a.icon}</div>
            <div className="font-semibold text-sm text-white group-hover:text-brand-300 transition-colors">{a.label}</div>
            <div className="text-xs text-white/35 mt-0.5">{a.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
