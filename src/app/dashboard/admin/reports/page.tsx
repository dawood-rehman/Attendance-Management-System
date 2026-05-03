'use client';
import { useEffect, useState, useCallback } from 'react';
import { Button, Card, Badge, Select, EmptyState, Skeleton } from '@/components/ui';
import { BarChart3, Download } from 'lucide-react';
import { apiCall } from '@/utils/api';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';

interface AttRecord {
  _id: string;
  userId: { _id: string; name: string; email: string } | null;
  studentId: { _id: string; name: string; rollNumber: string } | null;
  date: string;
  status: string;
  role: string;
}

export default function AdminReportsPage() {
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('teacher');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ role, startDate, endDate, page: String(page), limit: String(LIMIT) });
      const data = await apiCall<{ records: AttRecord[]; total: number }>(`/api/attendance?${params}`);
      setRecords(data.records);
      setTotal(data.total);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [role, startDate, endDate, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">System Reports</h1>
          <p className="text-white/40 text-sm mt-0.5">{total} records</p>
        </div>
        <Button variant="outline" size="sm"
          onClick={() => window.open(`/api/attendance/export?type=${role}&startDate=${startDate}&endDate=${endDate}`, '_blank')}>
          <Download size={14} /> Export Excel
        </Button>
      </div>

      <Card className="flex flex-wrap gap-3 items-end">
        <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}
          options={[{ value: 'teacher', label: 'Teacher Attendance' }, { value: 'student', label: 'Student Attendance' }]}
          label="Type" className="w-full sm:w-44" />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/50">From</label>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/50">To</label>
          <input type="date" value={endDate} max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg" />
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : records.length === 0 ? (
          <EmptyState icon={<BarChart3 size={32} />} title="No records" description="No attendance for the selected filters" />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Name', role === 'teacher' ? 'Email' : 'Roll No.', 'Date', 'Status', 'Role'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const person = role === 'teacher' ? r.userId : r.studentId;
                  const name = (person as {name?: string})?.name || '—';
                  const secondary = role === 'teacher'
                    ? (r.userId as {email?: string})?.email
                    : (r.studentId as {rollNumber?: string})?.rollNumber;
                  return (
                    <tr key={r._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-medium text-white">{name}</td>
                      <td className="px-5 py-3 text-white/40 text-xs">{secondary || '—'}</td>
                      <td className="px-5 py-3 text-white/50 text-xs">{format(new Date(r.date), 'MMM dd, yyyy')}</td>
                      <td className="px-5 py-3"><Badge value={r.status} /></td>
                      <td className="px-5 py-3"><Badge value={r.role} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {total > LIMIT && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                <span className="text-xs text-white/30">Page {page} of {Math.ceil(total / LIMIT)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  <Button size="sm" variant="ghost" disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
