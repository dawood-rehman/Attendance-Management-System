import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import AcademicClass from '@/models/AcademicClass';
import Department from '@/models/Department';
import Lecture from '@/models/Lecture';
import Teacher from '@/models/Teacher';

const dayValues = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const UpdateLectureSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  subject: z.string().min(1).max(120).optional(),
  departmentId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  dayOfWeek: z.enum(dayValues).optional().or(z.literal('')),
  lectureDate: z.string().optional().or(z.literal('')),
  startTime: z.string().min(1).max(20).optional(),
  endTime: z.string().min(1).max(20).optional(),
  room: z.string().max(80).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
});

function dateOrUndefined(value?: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00`);
}

async function validateLectureLinks(departmentId: string, classId: string, teacherId: string) {
  const [department, academicClass, teacher] = await Promise.all([
    Department.findById(departmentId).lean(),
    AcademicClass.findById(classId).lean(),
    Teacher.findById(teacherId).lean(),
  ]);

  if (!department) return 'Department not found';
  if (!academicClass || academicClass.departmentId.toString() !== departmentId) {
    return 'Class not found in selected department';
  }
  if (!teacher) return 'Teacher not found';

  const assignedClassIds = teacher.assignedClassIds.map((id) => id.toString());
  if (!assignedClassIds.includes(classId)) {
    return 'Selected teacher is not assigned to this class';
  }

  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireRole(['admin'], async (req: NextRequest) => {
    try {
      await connectDB();
      const parsed = UpdateLectureSchema.safeParse(await req.json());

      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
      }

      const lecture = await Lecture.findById(params.id);
      if (!lecture) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });

      const nextDepartmentId = parsed.data.departmentId || lecture.departmentId.toString();
      const nextClassId = parsed.data.classId || lecture.classId.toString();
      const nextTeacherId = parsed.data.teacherId || lecture.teacherId.toString();

      const linkError = await validateLectureLinks(nextDepartmentId, nextClassId, nextTeacherId);
      if (linkError) return NextResponse.json({ error: linkError }, { status: 400 });

      const nextDay = parsed.data.dayOfWeek !== undefined ? parsed.data.dayOfWeek : lecture.dayOfWeek;
      const nextDate =
        parsed.data.lectureDate !== undefined
          ? dateOrUndefined(parsed.data.lectureDate)
          : lecture.lectureDate;
      if (!nextDay && !nextDate) {
        return NextResponse.json({ error: 'Choose a weekly day or a specific lecture date' }, { status: 400 });
      }

      if (parsed.data.title !== undefined) lecture.title = parsed.data.title;
      if (parsed.data.subject !== undefined) lecture.subject = parsed.data.subject;
      lecture.set('departmentId', nextDepartmentId);
      lecture.set('classId', nextClassId);
      lecture.set('teacherId', nextTeacherId);
      if (parsed.data.dayOfWeek !== undefined) lecture.dayOfWeek = parsed.data.dayOfWeek || undefined;
      if (parsed.data.lectureDate !== undefined) lecture.lectureDate = dateOrUndefined(parsed.data.lectureDate);
      if (parsed.data.startTime !== undefined) lecture.startTime = parsed.data.startTime;
      if (parsed.data.endTime !== undefined) lecture.endTime = parsed.data.endTime;
      if (parsed.data.room !== undefined) lecture.room = parsed.data.room || undefined;
      if (parsed.data.notes !== undefined) lecture.notes = parsed.data.notes || undefined;
      if (parsed.data.status !== undefined) lecture.status = parsed.data.status;
      await lecture.save();

      const populated = await Lecture.findById(lecture._id)
        .populate('departmentId', 'name code')
        .populate('classId', 'name code')
        .populate('teacherId', 'name email employeeId')
        .lean();

      return NextResponse.json({ lecture: populated, message: 'Lecture updated' });
    } catch (error) {
      console.error('Update lecture error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });

  return handler(req);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireRole(['admin'], async () => {
    try {
      await connectDB();
      const lecture = await Lecture.findByIdAndDelete(params.id);
      if (!lecture) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
      return NextResponse.json({ message: 'Lecture deleted' });
    } catch (error) {
      console.error('Delete lecture error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });

  return handler(req);
}
