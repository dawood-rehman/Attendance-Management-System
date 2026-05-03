'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { StatCard, Card } from '@/components/ui';
import { CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { apiCall } from '@/utils/api';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays } from 'date-fns';

interface AttRecord { status: string; date: string; }

export default function StudentDashboard() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall<{ records: AttRecord[] }>(
      `/api/attendance?role=student&startDate=${format(subDays(new Date(), 29), 'yyyy-MM-dd')}&endDate=${format(new Date(), 'yyyy-MM-dd')}&limit=200`
    )
      .then((d) => setRecords(d.records))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const absent  = records.filter((r) => r.status === 'absent').length;
  const late    = records.filter((r) => r.status === 'late').length;
  const pct     = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  const pieData = [
    { name: 'Present', value: present, color: '#22c55e' },
    { name: 'Absent',  value: absent,  color: '#ef4444' },
    { name: 'Late',    value: late,    color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  const riskColor = pct >= 85 ? 'text-green-400' : pct >= 70 ? 'text-amber-400' : 'text-red-400';
  const riskLabel = pct >= 85 ? '🟢 Good Standing' : pct >= 70 ? '🟡 At Risk' : '🔴 Critical';

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold text-white">
          Hello, <span className="text-gradient">{user?.name?.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-white/40 mt-1">Here's your attendance overview for the last 30 days.</p>
      </div>

      {/* Attendance % hero */}
      <div className="card p-4 sm:p-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6 animate-fade-up-delay-1">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <circle cx="40" cy="40" r="34" fill="none"
              stroke={pct >= 85 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'}
              strokeWidth="8"
              strokeDasharray={`${(pct / 100) * 213.6} 213.6`}
              strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-bold font-display ${riskColor}`}>{pct}%</span>
          </div>
        </div>
        <div>
          <div className="font-display text-xl font-bold text-white mb-1">Overall Attendance</div>
          <div className={`text-sm font-medium mb-2 ${riskColor}`}>{riskLabel}</div>
          <p className="text-xs text-white/40">Based on last 30 days · {total} records</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up-delay-1">
        <StatCard title="Present" value={present} icon={<CheckCircle size={20} />} color="green" />
        <StatCard title="Absent"  value={absent}  icon={<XCircle size={20} />}    color="red" />
        <StatCard title="Late"    value={late}    icon={<Clock size={20} />}      color="amber" />
        <StatCard title="Rate"    value={`${pct}%`} icon={<TrendingUp size={20} />} color="blue" />
      </div>

      {pieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-up-delay-2">
          <Card>
            <h2 className="font-display font-semibold text-white mb-4">Distribution</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e2032', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h2 className="font-display font-semibold text-white mb-4">Recent Records</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {records.slice(0, 10).map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-sm text-white/60">{format(new Date(r.date), 'EEE, MMM dd')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    r.status === 'present' ? 'bg-green-500/15 text-green-400' :
                    r.status === 'absent'  ? 'bg-red-500/15 text-red-400' :
                    r.status === 'late'    ? 'bg-amber-500/15 text-amber-400' :
                    'bg-blue-500/15 text-blue-400'
                  }`}>{r.status}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
