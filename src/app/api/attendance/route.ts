import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAuth } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import Attendance from '@/models/Attendance';
import Student from '@/models/Student';
import { ensureTeacherProfile } from '@/lib/profiles';
import { z } from 'zod';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

const MarkSchema = z.object({
  userId: z.string(),
  studentId: z.string().optional(),
  role: z.enum(['student', 'teacher']),
  date: z.string(),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  note: z.string().optional(),
});

const BulkMarkSchema = z.object({
  records: z.array(MarkSchema),
});

// GET /api/attendance?userId=&role=&startDate=&endDate=
export const GET = requireAuth(async (req: NextRequest, user) => {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const filter: Record<string, unknown> = {};
    if (userId) filter.userId = userId;
    if (role) filter.role = role;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) (filter.date as Record<string, Date>).$gte = startOfDay(parseISO(startDate));
      if (endDate) (filter.date as Record<string, Date>).$lte = endOfDay(parseISO(endDate));
    }

    // Students can only view their own records
    if (user.role === 'student') {
      filter.userId = user.userId;
    }

    const total = await Attendance.countDocuments(filter);
    const records = await Attendance.find(filter)
      .populate('userId', 'name email')
      .populate('studentId', 'name rollNumber')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({ records, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Get attendance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/attendance - bulk mark attendance
export const POST = requireAuth(async (req: NextRequest, user) => {
  try {
    if (!['admin', 'teacher'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();
    const parsed = BulkMarkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    if (user.role === 'teacher') {
      const teacher = await ensureTeacherProfile(user.userId);
      if (!teacher) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });
      if (parsed.data.records.some((record) => record.role !== 'student' || !record.studentId)) {
        return NextResponse.json({ error: 'Teachers can only mark student attendance' }, { status: 403 });
      }

      const assignedClassIds = teacher.assignedClassIds.map((id) => id.toString());
      const studentIds = parsed.data.records
        .map((record) => record.studentId)
        .filter((id): id is string => Boolean(id));
      const students = await Student.find({ _id: { $in: studentIds } }).select('_id classId teacherId').lean();
      const allowedStudentIds = new Set(
        students
          .filter((student) => {
            const classAllowed = assignedClassIds.includes(student.classId.toString());
            const teacherAllowed = student.teacherId?.toString() === teacher._id.toString();
            return classAllowed || teacherAllowed;
          })
          .map((student) => student._id.toString())
      );

      if (studentIds.some((id) => !allowedStudentIds.has(id))) {
        return NextResponse.json({ error: 'One or more students are not in your assigned classes' }, { status: 403 });
      }
    }

    const ops = parsed.data.records.map((r) => {
      const attendanceUserId = new mongoose.Types.ObjectId(r.userId);
      const attendanceStudentId = r.studentId ? new mongoose.Types.ObjectId(r.studentId) : undefined;
      const markedBy = new mongoose.Types.ObjectId(user.userId);

      return {
        updateOne: {
        filter: {
          userId: attendanceUserId,
          date: { $gte: startOfDay(parseISO(r.date)), $lte: endOfDay(parseISO(r.date)) },
          role: r.role,
        },
        update: {
          $set: {
            userId: attendanceUserId,
            studentId: attendanceStudentId,
            role: r.role,
            date: parseISO(r.date),
            status: r.status,
            note: r.note,
            markedBy,
          },
        },
        upsert: true,
      },
      };
    });

    const result = await Attendance.bulkWrite(ops);

    return NextResponse.json({
      message: 'Attendance marked successfully',
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
