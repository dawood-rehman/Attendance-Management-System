'use client';
import { useEffect, useState, useCallback } from 'react';
import { Button, Card, EmptyState } from '@/components/ui';
import { Brain, Search, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { apiCall } from '@/utils/api';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

interface Student { _id: string; name: string; rollNumber: string; }

interface ChartPoint {
  week: string;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

interface Insights {
  summary: string;
  trend: string;
  recommendation: string;
  riskLevel: 'low' | 'medium' | 'high';
  percentage: number;
}

const RISK_COLORS = {
  low:    { bg: 'bg-green-500/10',  border: 'border-green-500/20',  text: 'text-green-300',  icon: <CheckCircle size={18} /> },
  medium: { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-300',  icon: <Info size={18} /> },
  high:   { bg: 'bg-red-500/10',    border: 'border-red-500/20',    text: 'text-red-300',    icon: <AlertTriangle size={18} /> },
};

export default function TeacherAIChartPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  useEffect(() => {
    apiCall<{ students: Student[] }>('/api/teacher/students?limit=200')
      .then((d) => setStudents(d.students))
      .catch(console.error);
  }, []);

  const analyze = useCallback(async () => {
    if (!selectedId) return toast.error('Select a student first');
    setLoading(true);
    setChartData([]);
    setInsights(null);
    try {
      const data = await apiCall<{
        chartData: ChartPoint[];
        insights: Insights;
        studentName: string;
      }>('/api/ai/chart', {
        method: 'POST',
        body: JSON.stringify({ studentId: selectedId }),
      });
      setChartData(data.chartData);
      setInsights(data.insights);
      setStudentName(data.studentName);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const risk = insights ? RISK_COLORS[insights.riskLevel] : null;

  return (
    <div className="space-y-6 animate-fade-up max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-brand-600/20 border border-brand-500/30">
          <Brain size={20} className="text-brand-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">AI Chart Generator</h1>
          <p className="text-white/40 text-sm">AI-powered attendance analysis with trend insights</p>
        </div>
      </div>

      {/* Student selector */}
      <Card>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium text-white/60 mb-1.5 block">Select Student</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg"
            >
              <option value="">Choose a student...</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.rollNumber})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setChartType('bar')}
              className={`px-3 py-2.5 text-sm rounded-lg border transition-all ${chartType === 'bar' ? 'bg-brand-600/20 border-brand-500/30 text-brand-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
            >Bar</button>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-2.5 text-sm rounded-lg border transition-all ${chartType === 'line' ? 'bg-brand-600/20 border-brand-500/30 text-brand-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
            >Line</button>
          </div>
          <Button onClick={analyze} loading={loading} size="md">
            <Search size={14} /> Analyze
          </Button>
        </div>
      </Card>

      {/* Results */}
      {loading && (
        <Card className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <Brain size={18} className="text-brand-400 absolute inset-0 m-auto" />
          </div>
          <p className="text-white/40 text-sm">AI is analyzing attendance data...</p>
        </Card>
      )}

      {!loading && insights && (
        <>
          {/* AI Insights */}
          <div className={`p-5 rounded-xl border ${risk?.bg} ${risk?.border} animate-fade-up`}>
            <div className="flex items-start gap-3">
              <span className={risk?.text}>{risk?.icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={`font-display font-semibold ${risk?.text}`}>
                    AI Insights — {studentName}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${risk?.bg} ${risk?.border} ${risk?.text} capitalize font-medium`}>
                    {insights.riskLevel} risk
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${risk?.bg} ${risk?.border} ${risk?.text} font-mono font-bold`}>
                    {insights.percentage}%
                  </span>
                </div>
                <p className="text-sm text-white/70 mb-2">{insights.summary}</p>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-white/50"><span className="font-medium text-white/60">📈 Trend:</span> {insights.trend}</p>
                  <p className="text-xs text-white/50"><span className="font-medium text-white/60">💡 Recommendation:</span> {insights.recommendation}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <Card className="animate-fade-up-delay-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-400" />
                Weekly Attendance — {studentName}
              </h2>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                {chartType === 'bar' ? (
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="week" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#1e2032', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f0f2f8' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                    <Bar dataKey="present" fill="#22c55e" radius={[4,4,0,0]} name="Present" />
                    <Bar dataKey="absent" fill="rgba(239,68,68,0.7)" radius={[4,4,0,0]} name="Absent" />
                    <Bar dataKey="late" fill="#f59e0b" radius={[4,4,0,0]} name="Late" />
                  </BarChart>
                ) : (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="week" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip contentStyle={{ background: '#1e2032', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f0f2f8' }} />
                    <ReferenceLine y={75} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 4" label={{ value: '75% threshold', fill: 'rgba(239,68,68,0.6)', fontSize: 11 }} />
                    <ReferenceLine y={85} stroke="rgba(34,197,94,0.4)" strokeDasharray="4 4" label={{ value: '85% threshold', fill: 'rgba(34,197,94,0.6)', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                    <Line type="monotone" dataKey="percentage" stroke="#2d6be4" strokeWidth={2.5} dot={{ fill: '#2d6be4', r: 4 }} activeDot={{ r: 6 }} name="Attendance %" />
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<TrendingUp size={28} />} title="No chart data" description="No attendance records found for this student" />
            )}
          </Card>
        </>
      )}

      {!loading && !insights && (
        <Card>
          <EmptyState
            icon={<Brain size={32} />}
            title="Select a student to analyze"
            description="AI will generate charts and insights from attendance data"
          />
        </Card>
      )}
    </div>
  );
}
