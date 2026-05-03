import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/models/User';
import Student from '@/models/Student';
import Attendance from '@/models/Attendance';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export const GET = requireRole(['admin'], async (req: NextRequest) => {
  try {
    await connectDB();

    const today = new Date();
    const [
      totalTeachers,
      totalStudents,
      pendingApprovals,
      todayTeacherAttendance,
      weeklyAttendance,
    ] = await Promise.all([
      User.countDocuments({ role: 'teacher', status: 'approved' }),
      Student.countDocuments(),
      User.countDocuments({ status: 'pending' }),
      Attendance.countDocuments({
        role: 'teacher',
        date: { $gte: startOfDay(today), $lte: endOfDay(today) },
        status: 'present',
      }),
      Attendance.aggregate([
        {
          $match: {
            date: { $gte: subDays(today, 6) },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
              status: '$status',
              role: '$role',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]),
    ]);

    return NextResponse.json({
      stats: {
        totalTeachers,
        totalStudents,
        pendingApprovals,
        todayTeacherAttendance,
      },
      weeklyAttendance,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
