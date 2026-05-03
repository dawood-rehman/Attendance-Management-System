'use client';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui';
import { BookOpen, CalendarDays } from 'lucide-react';
import { apiCall } from '@/utils/api';
import toast from 'react-hot-toast';

interface RefValue {
  _id: string;
  name: string;
}

interface Teacher {
  _id: string;
  name: string;
}

interface Lecture {
  _id: string;
  title: string;
  subject: string;
  classId: string | RefValue;
  teacherId: string | Teacher;
  dayOfWeek?: string;
  lectureDate?: string;
  startTime: string;
  endTime: string;
  room?: string;
  status: string;
}

function refName(value: string | RefValue | Teacher | undefined) {
  return typeof value === 'object' && value ? value.name : '-';
}

function scheduleLabel(lecture: Lecture) {
  const date = lecture.lectureDate ? format(new Date(lecture.lectureDate), 'MMM dd, yyyy') : '';
  const day = lecture.dayOfWeek ? lecture.dayOfWeek.charAt(0).toUpperCase() + lecture.dayOfWeek.slice(1) : '';
  return [date, day].filter(Boolean).join(' / ') || '-';
}

export default function TeacherLecturesPage() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall<{ lectures: Lecture[] }>('/api/admin/lectures')
      .then((data) => setLectures(data.lectures))
      .catch(() => toast.error('Failed to load lectures'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">My Lectures</h1>
        <p className="text-white/40 text-sm mt-0.5">Lectures assigned to your teacher account</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : lectures.length === 0 ? (
          <EmptyState icon={<BookOpen size={32} />} title="No lectures assigned" description="Your admin can assign lectures after linking you to classes" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['Lecture', 'Class', 'Schedule', 'Room', 'Status'].map((header) => (
                    <th key={header} className="text-left px-5 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lectures.map((lecture) => (
                  <tr key={lecture._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-white">{lecture.title}</div>
                      <div className="text-xs text-white/35">{lecture.subject}</div>
                    </td>
                    <td className="px-5 py-3.5 text-white/50">{refName(lecture.classId)}</td>
                    <td className="px-5 py-3.5 text-white/45">
                      <div className="flex items-center gap-2"><CalendarDays size={14} /> {scheduleLabel(lecture)}</div>
                      <div className="text-xs text-white/30 ml-6">{lecture.startTime} - {lecture.endTime}</div>
                    </td>
                    <td className="px-5 py-3.5 text-white/40">{lecture.room || '-'}</td>
                    <td className="px-5 py-3.5"><Badge value={lecture.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
