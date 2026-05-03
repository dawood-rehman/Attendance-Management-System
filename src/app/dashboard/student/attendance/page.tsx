'use client';
import { useEffect, useState, useCallback } from 'react';
import { Card, Badge, EmptyState, Skeleton } from '@/components/ui';
import { CheckSquare, Download } from 'lucide-react';
import { Button } from '@/components/ui';
import { apiCall } from '@/utils/api';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';

interface AttRecord {
  _id: string;
  date: string;
  status: string;
  note?: string;
}

export default function StudentAttendancePage() {
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
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
      const data = await apiCall<{ records: AttRecord[]; total: number }>(`/api/attendance?${params}`);
      setRecords(data.records);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, page]);

  useEffect(() => { load(); }, [load]);

  const present = records.filter((r) => r.status === 'present').length;
  const absent  = records.filter((r) => r.status === 'absent').length;
  const late    = records.filter((r) => r.status === 'late').length;
  const pct     = records.length > 0 ? Math.round(((present + late) / records.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">My Attendance</h1>
          <p className="text-white/40 text-sm mt-0.5">{total} total records</p>
        </div>
        <Button variant="outline" size="sm"
          onClick={() => window.open(`/api/attendance/export?type=student&startDate=${startDate}&endDate=${endDate}`, '_blank')}>
          <Download size={14} /> Export
        </Button>
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/50">From</label>
          <input type="date" value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/50">To</label>
          <input type="date" value={endDate} max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg" />
        </div>
      </Card>

      {/* Summary */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Present', value: present, cls: 'bg-green-500/10 border-green-500/20 text-green-300' },
            { label: 'Absent',  value: absent,  cls: 'bg-red-500/10 border-red-500/20 text-red-300' },
            { label: 'Late',    value: late,    cls: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
            { label: 'Rate',    value: `${pct}%`, cls: pct >= 85 ? 'bg-green-500/10 border-green-500/20 text-green-300' : pct >= 70 ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-red-500/10 border-red-500/20 text-red-300' },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`p-3 rounded-xl border text-center ${cls}`}>
              <div className="text-xl font-bold font-display">{value}</div>
              <div className="text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : records.length === 0 ? (
          <EmptyState icon={<CheckSquare size={32} />} title="No attendance records" description="No records found for the selected date range" />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Date', 'Day', 'Status', 'Note'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-white font-medium">{format(new Date(r.date), 'MMM dd, yyyy')}</td>
                    <td className="px-5 py-3 text-white/50">{format(new Date(r.date), 'EEEE')}</td>
                    <td className="px-5 py-3"><Badge value={r.status} /></td>
                    <td className="px-5 py-3 text-white/30 text-xs">{r.note || '—'}</td>
                  </tr>
                ))}
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
