'use client';
import { useEffect, useState, useCallback } from 'react';
import { Button, Card, Badge, EmptyState, Skeleton } from '@/components/ui';
import { CheckSquare, Download } from 'lucide-react';
import { apiCall } from '@/utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Teacher { _id: string; name: string; email: string; }
type AttStatus = 'present' | 'absent' | 'late' | 'excused';
const STATUS_OPTIONS: AttStatus[] = ['present', 'absent', 'late', 'excused'];
const STATUS_COLORS: Record<AttStatus, string> = {
  present: 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30',
  absent:  'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30',
  late:    'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30',
  excused: 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30',
};

export default function AdminAttendancePage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttStatus>>({});
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<Record<string, AttStatus>>({});

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall<{ users: Teacher[] }>('/api/admin/users?role=teacher&status=approved&limit=100');
      setTeachers(data.users);
      const init: Record<string, AttStatus> = {};
      data.users.forEach((t) => { init[t._id] = 'present'; });
      setAttendance(init);
    } catch { toast.error('Failed to load teachers'); }
    finally { setLoading(false); }
  }, []);

  const loadExisting = useCallback(async () => {
    if (!teachers.length) return;
    try {
      const data = await apiCall<{ records: { userId: { _id: string }; status: AttStatus }[] }>(
        `/api/attendance?role=teacher&startDate=${date}&endDate=${date}`
      );
      const map: Record<string, AttStatus> = {};
      data.records.forEach((r) => { if (r.userId) map[r.userId._id] = r.status; });
      setExisting(map);
      setAttendance((prev) => {
        const u = { ...prev };
        Object.entries(map).forEach(([id, s]) => { u[id] = s; });
        return u;
      });
    } catch { /* no existing */ }
  }, [teachers, date]);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);
  useEffect(() => { loadExisting(); }, [loadExisting]);

  const markAll = (status: AttStatus) => {
    const u: Record<string, AttStatus> = {};
    teachers.forEach((t) => { u[t._id] = status; });
    setAttendance(u);
  };

  const save = async () => {
    setSaving(true);
    try {
      const records = teachers.map((t) => ({
        userId: t._id,
        role: 'teacher',
        date,
        status: attendance[t._id] || 'absent',
      }));
      await apiCall('/api/attendance', { method: 'POST', body: JSON.stringify({ records }) });
      toast.success(`Teacher attendance saved for ${format(new Date(date), 'MMM dd, yyyy')}`);
      loadExisting();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const summary = {
    present: Object.values(attendance).filter((s) => s === 'present').length,
    absent:  Object.values(attendance).filter((s) => s === 'absent').length,
    late:    Object.values(attendance).filter((s) => s === 'late').length,
    excused: Object.values(attendance).filter((s) => s === 'excused').length,
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Teacher Attendance</h1>
          <p className="text-white/40 text-sm mt-0.5">Mark daily attendance for all teachers</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="outline" size="sm"
            onClick={() => window.open(`/api/attendance/export?type=teacher&startDate=${date}&endDate=${date}`, '_blank')}>
            <Download size={14} /> Export
          </Button>
          <Button size="sm" onClick={save} loading={saving}>
            <CheckSquare size={14} /> Save
          </Button>
        </div>
      </div>

      <Card className="flex flex-wrap gap-4 items-center">
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <label className="text-sm text-white/50">Date:</label>
          <input type="date" value={date} max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => setDate(e.target.value)} className="px-3 py-2 text-sm rounded-lg" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-white/30 self-center">Mark all:</span>
          {STATUS_OPTIONS.map((s) => (
            <button key={s} onClick={() => markAll(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border capitalize font-medium transition-all ${STATUS_COLORS[s]}`}>
              {s}
            </button>
          ))}
        </div>
      </Card>

      {teachers.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.entries(summary) as [AttStatus, number][]).map(([s, n]) => (
            <div key={s} className={`p-3 rounded-xl border text-center ${STATUS_COLORS[s]}`}>
              <div className="text-xl font-bold font-display">{n}</div>
              <div className="text-xs capitalize mt-0.5">{s}</div>
            </div>
          ))}
        </div>
      )}

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : teachers.length === 0 ? (
          <EmptyState icon={<CheckSquare size={32} />} title="No teachers found" description="Approve teacher accounts first" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['#','Teacher','Email','Status','Prev. Record'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachers.map((t, i) => (
                <tr key={t._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-white/25 text-xs font-mono">{i + 1}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500/40 to-purple-600/40 flex items-center justify-center text-white/70 font-bold text-xs">
                        {t.name.charAt(0)}
                      </div>
                      <span className="font-medium text-white">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-white/40 text-xs">{t.email}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {STATUS_OPTIONS.map((status) => (
                        <button key={status}
                          onClick={() => setAttendance((prev) => ({ ...prev, [t._id]: status }))}
                          className={`text-xs px-2.5 py-1 rounded-lg border capitalize font-medium transition-all ${
                            attendance[t._id] === status ? STATUS_COLORS[status] : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/10'
                          }`}>
                          {status}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {existing[t._id] ? <Badge value={existing[t._id]} /> : <span className="text-white/20 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {teachers.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving} size="lg">
            <CheckSquare size={16} />
            Save for {format(new Date(date + 'T00:00:00'), 'MMM dd, yyyy')}
          </Button>
        </div>
      )}
    </div>
  );
}
