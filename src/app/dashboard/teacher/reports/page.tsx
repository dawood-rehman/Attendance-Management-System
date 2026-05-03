'use client';
import { useEffect, useState, useCallback } from 'react';
import { Button, Card, Badge, EmptyState, Skeleton } from '@/components/ui';
import { BarChart3, Download, Filter } from 'lucide-react';
import { apiCall } from '@/utils/api';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';

interface AttRecord {
  _id: string;
  studentId: { _id: string; name: string; rollNumber: string } | null;
  date: string;
  status: string;
  note?: string;
}

export default function TeacherReportsPage() {
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        role: 'student',
        startDate,
        endDate,
        page: String(page),
        limit: String(LIMIT),
      });
      if (statusFilter) params.set('status', statusFilter);
      const data = await apiCall<{ records: AttRecord[]; total: number }>(`/api/attendance?${params}`);
      setRecords(data.records);
      setTotal(data.total);
    } catch { toast.error('Failed to load records'); }
    finally { setLoading(false); }
  }, [startDate, endDate, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const exportExcel = () => {
    const token = localStorage.getItem('auth-token');
    const params = new URLSearchParams({ type: 'student', startDate, endDate });
    window.open(`/api/attendance/export?${params}`, '_blank');
  };

  const statusCounts = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Attendance Reports</h1>
          <p className="text-white/40 text-sm mt-0.5">{total} records found</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel}>
          <Download size={14} /> Export Excel
        </Button>
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap gap-3 items-end">
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
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm rounded-lg">
          <option value="">All Statuses</option>
          {['present','absent','late','excused'].map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={() => { setPage(1); load(); }}>
          <Filter size={14} /> Apply
        </Button>
      </Card>

      {/* Summary chips */}
      {Object.entries(statusCounts).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(statusCounts).map(([s, n]) => (
            <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Badge value={s} />
              <span className="text-xs font-mono font-bold text-white/60">{n}</span>
            </div>
          ))}
        </div>
      )}

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : records.length === 0 ? (
          <EmptyState icon={<BarChart3 size={32} />} title="No records found" description="Adjust filters or mark attendance first" />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Student','Roll No.','Date','Status','Note'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium text-white">{r.studentId?.name || '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-white/40">{r.studentId?.rollNumber || '—'}</td>
                    <td className="px-5 py-3 text-white/50 text-xs">{format(new Date(r.date), 'MMM dd, yyyy')}</td>
                    <td className="px-5 py-3"><Badge value={r.status} /></td>
                    <td className="px-5 py-3 text-white/30 text-xs">{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination */}
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
