import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import Attendance from '@/models/Attendance';
import Student from '@/models/Student';
import * as XLSX from 'xlsx';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

export const GET = requireAuth(async (req: NextRequest, user) => {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'student'; // 'student' | 'teacher'
    const teacherId = user.role === 'teacher' ? user.userId : searchParams.get('teacherId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const filter: Record<string, unknown> = { role: type };
    if (startDate) (filter.date as Record<string, Date> | undefined) ?? (filter.date = {});
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) (filter.date as Record<string, Date>).$gte = startOfDay(parseISO(startDate));
      if (endDate) (filter.date as Record<string, Date>).$lte = endOfDay(parseISO(endDate));
    }

    let rows: Record<string, string>[] = [];

    if (type === 'student') {
      const studentFilter: Record<string, unknown> = {};
      if (teacherId) studentFilter.teacherId = teacherId;
      const students = await Student.find(studentFilter).lean();
      const studentIds = students.map((s) => s._id.toString());

      filter.studentId = { $in: studentIds };
      const records = await Attendance.find(filter)
        .populate('studentId', 'name rollNumber class section')
        .lean();

      rows = records.map((r) => {
        const s = r.studentId as unknown as Record<string, string> | null;
        return {
          Name: s?.name || '',
          'Roll Number': s?.rollNumber || '',
          Class: s?.class || '',
          Section: s?.section || '',
          Date: format(new Date(r.date), 'yyyy-MM-dd'),
          Status: r.status,
          Note: r.note || '',
        };
      });
    } else {
      const records = await Attendance.find(filter)
        .populate('userId', 'name email')
        .lean();
      rows = records.map((r) => {
        const u = r.userId as unknown as Record<string, string> | null;
        return {
          Name: u?.name || '',
          Email: u?.email || '',
          Date: format(new Date(r.date), 'yyyy-MM-dd'),
          Status: r.status,
          Note: r.note || '',
        };
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="attendance_${type}_${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
