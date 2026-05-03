'use client';
import { useEffect, useState, useCallback } from 'react';
import { Button, Card, Select, Badge, EmptyState, Skeleton } from '@/components/ui';
import { CheckSquare, Download, GraduationCap } from 'lucide-react';
import { apiCall } from '@/utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Student {
  _id: string;
  userId?: string | { _id: string };
  name: string;
  rollNumber: string;
  class?: string;
  section?: string;
}

type AttStatus = 'present' | 'absent' | 'late' | 'excused';

interface AttRecord {
  [studentId: string]: AttStatus;
}

const STATUS_OPTIONS: AttStatus[] = ['present', 'absent', 'late', 'excused'];
const STATUS_COLORS: Record<AttStatus, string> = {
  present: 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30',
  absent: 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30',
  late: 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30',
  excused: 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30',
};

export default function TeacherAttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttRecord>({});
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingRecords, setExistingRecords] = useState<Record<string, AttStatus>>({});

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall<{ students: Student[] }>('/api/teacher/students?limit=200');
      setStudents(data.students);
      // Initialize all as present by default
      const init: AttRecord = {};
      data.students.forEach((s) => { init[s._id] = 'present'; });
      setAttendance(init);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  }, []);

  const loadExisting = useCallback(async () => {
    if (!students.length) return;
    try {
      const data = await apiCall<{ records: { studentId: { _id: string }; status: AttStatus }[] }>(
        `/api/attendance?role=student&startDate=${date}&endDate=${date}`
      );
      const map: Record<string, AttStatus> = {};
      data.records.forEach((r) => {
        if (r.studentId) map[r.studentId._id] = r.status;
      });
      setExistingRecords(map);
      // Pre-fill with existing
      setAttendance((prev) => {
        const updated = { ...prev };
        Object.entries(map).forEach(([id, status]) => { updated[id] = status; });
        return updated;
      });
    } catch { /* no existing records */ }
  }, [students, date]);

  useEffect(() => { loadStudents(); }, [loadStudents]);
  useEffect(() => { loadExisting(); }, [loadExisting]);

  const markAll = (status: AttStatus) => {
    const updated: AttRecord = {};
    students.forEach((s) => { updated[s._id] = status; });
    setAttendance(updated);
  };

  const save = async () => {
    if (!students.length) return;
    setSaving(true);
    try {
      const records = students.map((s) => ({
        userId: typeof s.userId === 'object' ? s.userId._id : s.userId || s._id,
        studentId: s._id,
        role: 'student',
        date,
        status: attendance[s._id] || 'absent',
      }));
      await apiCall('/api/attendance', { method: 'POST', body: JSON.stringify({ records }) });
      toast.success(`Attendance saved for ${format(new Date(date), 'MMM dd, yyyy')}`);
      loadExisting();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const exportExcel = () => {
    const token = localStorage.getItem('auth-token');
    window.open(`/api/attendance/export?type=student&startDate=${date}&endDate=${date}`, '_blank');
  };

  const summary = {
    present: Object.values(attendance).filter((s) => s === 'present').length,
    absent: Object.values(attendance).filter((s) => s === 'absent').length,
    late: Object.values(attendance).filter((s) => s === 'late').length,
    excused: Object.values(attendance).filter((s) => s === 'excused').length,
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Mark Attendance</h1>
          <p className="text-white/40 text-sm mt-0.5">Record daily attendance for your students</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download size={14} /> Export Excel
          </Button>
          <Button size="sm" onClick={save} loading={saving}>
            <CheckSquare size={14} /> Save Attendance
          </Button>
        </div>
      </div>

      {/* Date picker + bulk actions */}
      <Card className="flex flex-wrap items-center gap-4">
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <label className="text-sm font-medium text-white/60">Date:</label>
          <input
            type="date"
            value={date}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-white/30 self-center">Mark all:</span>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => markAll(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border capitalize font-medium transition-all ${STATUS_COLORS[s]}`}
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {/* Summary strip */}
      {students.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.entries(summary) as [AttStatus, number][]).map(([s, n]) => (
            <div key={s} className={`p-3 rounded-xl border text-center ${STATUS_COLORS[s]}`}>
              <div className="text-xl font-bold font-display">{n}</div>
              <div className="text-xs capitalize mt-0.5">{s}</div>
            </div>
          ))}
        </div>
      )}

      {/* Student list */}
      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : students.length === 0 ? (
          <EmptyState
            icon={<GraduationCap size={32} />}
            title="No students found"
            description="Add students first to mark attendance"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['#', 'Student', 'Roll No.', 'Status', 'Previously'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-white/25 text-xs font-mono">{i + 1}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500/40 to-purple-600/40 flex items-center justify-center text-white/70 font-bold text-xs">
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-white">{s.name}</div>
                        {s.class && <div className="text-xs text-white/30">{s.class}{s.section ? `-${s.section}` : ''}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-white/40">{s.rollNumber}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {STATUS_OPTIONS.map((status) => (
                        <button
                          key={status}
                          onClick={() => setAttendance((prev) => ({ ...prev, [s._id]: status }))}
                          className={`text-xs px-2.5 py-1 rounded-lg border capitalize font-medium transition-all ${
                            attendance[s._id] === status
                              ? STATUS_COLORS[status]
                              : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {existingRecords[s._id] ? (
                      <Badge value={existingRecords[s._id]} />
                    ) : (
                      <span className="text-white/20 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {students.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving} size="lg">
            <CheckSquare size={16} />
            Save Attendance for {format(new Date(date + 'T00:00:00'), 'MMM dd, yyyy')}
          </Button>
        </div>
      )}
    </div>
  );
}
