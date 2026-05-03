import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import Attendance from '@/models/Attendance';
import Student from '@/models/Student';
import { analyzeAttendance } from '@/lib/ai/analysis';
import { subDays, format } from 'date-fns';

export const POST = requireAuth(async (req: NextRequest, user) => {
  try {
    await connectDB();
    const { studentId, studentName } = await req.json();

    let userId = studentId;
    let name = studentName;

    // Find student record
    const student = await Student.findById(studentId).lean();
    if (student) {
      name = student.name;
      // Get userId from student's teacherId (find user with this student)
      userId = studentId;
    }

    const endDate = new Date();
    const startDate = subDays(endDate, 89); // 90 days

    const records = await Attendance.find({
      $or: [{ studentId: studentId }, { userId: studentId }],
      date: { $gte: startDate, $lte: endDate },
    })
      .sort({ date: 1 })
      .lean();

    if (!records.length) {
      return NextResponse.json({ error: 'No attendance records found for this student' }, { status: 404 });
    }

    // Build chart data — group by week
    const weeklyMap: Record<string, { present: number; absent: number; late: number; total: number }> = {};

    records.forEach((r) => {
      const week = format(new Date(r.date), 'yyyy-\'W\'ww');
      if (!weeklyMap[week]) weeklyMap[week] = { present: 0, absent: 0, late: 0, total: 0 };
      weeklyMap[week].total++;
      if (r.status === 'present') weeklyMap[week].present++;
      else if (r.status === 'absent') weeklyMap[week].absent++;
      else if (r.status === 'late') weeklyMap[week].late++;
    });

    const chartData = Object.entries(weeklyMap).map(([week, data]) => ({
      week,
      present: data.present,
      absent: data.absent,
      late: data.late,
      percentage: Math.round(((data.present + data.late) / data.total) * 100),
    }));

    // Daily data for line chart
    const dailyMap: Record<string, string> = {};
    records.forEach((r) => {
      dailyMap[format(new Date(r.date), 'yyyy-MM-dd')] = r.status;
    });

    const insights = await analyzeAttendance(
      name || 'Student',
      records.map((r) => ({ date: format(new Date(r.date), 'yyyy-MM-dd'), status: r.status }))
    );

    return NextResponse.json({ chartData, dailyData: dailyMap, insights, studentName: name });
  } catch (error) {
    console.error('AI chart error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
