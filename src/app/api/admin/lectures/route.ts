import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import AcademicClass from '@/models/AcademicClass';
import Department from '@/models/Department';
import Lecture from '@/models/Lecture';
import Student from '@/models/Student';
import Teacher from '@/models/Teacher';
import { ensureTeacherProfile } from '@/lib/profiles';

const dayValues = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const LectureSchema = z.object({
  title: z.string().min(1).max(120),
  subject: z.string().min(1).max(120),
  departmentId: z.string().min(1),
  classId: z.string().min(1),
  teacherId: z.string().min(1),
  dayOfWeek: z.enum(dayValues).optional().or(z.literal('')),
  lectureDate: z.string().optional().or(z.literal('')),
  startTime: z.string().min(1).max(20),
  endTime: z.string().min(1).max(20),
  room: z.string().max(80).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
});

function dateOrUndefined(value?: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00`);
}

async function validateLectureLinks(data: z.infer<typeof LectureSchema>) {
  const [department, academicClass, teacher] = await Promise.all([
    Department.findById(data.departmentId).lean(),
    AcademicClass.findById(data.classId).lean(),
    Teacher.findById(data.teacherId).lean(),
  ]);

  if (!department) return 'Department not found';
  if (!academicClass || academicClass.departmentId.toString() !== data.departmentId) {
    return 'Class not found in selected department';
  }
  if (!teacher) return 'Teacher not found';

  const assignedClassIds = teacher.assignedClassIds.map((id) => id.toString());
  if (!assignedClassIds.includes(data.classId)) {
    return 'Selected teacher is not assigned to this class';
  }

  return null;
}

export const GET = requireAuth(async (req: NextRequest, user) => {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const classId = searchParams.get('classId');
    const teacherId = searchParams.get('teacherId');
    const status = searchParams.get('status');

    const filter: Record<string, unknown> = {};
    if (departmentId) filter.departmentId = departmentId;
    if (classId) filter.classId = classId;
    if (teacherId && user.role === 'admin') filter.teacherId = teacherId;
    if (status) filter.status = status;

    if (user.role === 'teacher') {
      const teacher = await ensureTeacherProfile(user.userId);
      if (!teacher) return NextResponse.json({ lectures: [] });
      filter.teacherId = teacher._id;
    }

    if (user.role === 'student') {
      const student = await Student.findOne({ userId: user.userId }).lean();
      if (!student) return NextResponse.json({ lectures: [] });
      filter.classId = student.classId;
    }

    const lectures = await Lecture.find(filter)
      .populate('departmentId', 'name code')
      .populate('classId', 'name code')
      .populate('teacherId', 'name email employeeId')
      .sort({ dayOfWeek: 1, lectureDate: 1, startTime: 1, title: 1 })
      .lean();

    return NextResponse.json({ lectures });
  } catch (error) {
    console.error('Get lectures error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = requireRole(['admin'], async (req: NextRequest, user) => {
  try {
    await connectDB();
    const parsed = LectureSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    if (!parsed.data.dayOfWeek && !parsed.data.lectureDate) {
      return NextResponse.json({ error: 'Choose a weekly day or a specific lecture date' }, { status: 400 });
    }

    const linkError = await validateLectureLinks(parsed.data);
    if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });

    const lecture = await Lecture.create({
      ...parsed.data,
      dayOfWeek: parsed.data.dayOfWeek || undefined,
      lectureDate: dateOrUndefined(parsed.data.lectureDate),
      room: parsed.data.room || undefined,
      notes: parsed.data.notes || undefined,
      status: parsed.data.status || 'scheduled',
      createdBy: user.userId,
    });

    const populated = await Lecture.findById(lecture._id)
      .populate('departmentId', 'name code')
      .populate('classId', 'name code')
      .populate('teacherId', 'name email employeeId')
      .lean();

    return NextResponse.json({ lecture: populated, message: 'Lecture created' }, { status: 201 });
  } catch (error) {
    console.error('Create lecture error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
