import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import AcademicClass from '@/models/AcademicClass';
import Lecture from '@/models/Lecture';
import Student from '@/models/Student';
import Teacher from '@/models/Teacher';
import { ensureTeacherProfile } from '@/lib/profiles';
import { z } from 'zod';

const UpdateClassSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(20).optional().or(z.literal('')),
  maxStudents: z.coerce.number().int().min(1).max(500).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireAuth(async (req: NextRequest, user) => {
    try {
      if (!['admin', 'teacher'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await connectDB();
      const parsed = UpdateClassSchema.safeParse(await req.json());

      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
      }

      if (user.role === 'teacher') {
        const teacher = await ensureTeacherProfile(user.userId);
        const assignedClassIds = teacher?.assignedClassIds.map((id) => id.toString()) || [];
        if (!assignedClassIds.includes(params.id)) {
          return NextResponse.json({ error: 'This class is not assigned to your teacher account' }, { status: 403 });
        }
        if (parsed.data.name || parsed.data.code !== undefined) {
          return NextResponse.json({ error: 'Teachers can only update class strength' }, { status: 403 });
        }
      }

      if (parsed.data.maxStudents !== undefined) {
        const studentCount = await Student.countDocuments({ classId: params.id });
        if (parsed.data.maxStudents < studentCount) {
          return NextResponse.json(
            { error: `Class strength cannot be lower than current enrolled students (${studentCount})` },
            { status: 400 }
          );
        }
      }

      const updates: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.code !== undefined) updates.code = parsed.data.code || undefined;

      const academicClass = await AcademicClass.findByIdAndUpdate(
        params.id,
        updates,
        { new: true }
      ).lean();

      if (!academicClass) return NextResponse.json({ error: 'Class not found' }, { status: 404 });
      return NextResponse.json({ class: academicClass, message: 'Class updated' });
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 11000) {
        return NextResponse.json({ error: 'Class name or code already exists in this department' }, { status: 409 });
      }
      console.error('Update class error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });

  return handler(req);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireRole(['admin'], async () => {
    try {
      await connectDB();
      const [studentCount, teacherCount, lectureCount] = await Promise.all([
        Student.countDocuments({ classId: params.id }),
        Teacher.countDocuments({ assignedClassIds: params.id }),
        Lecture.countDocuments({ classId: params.id }),
      ]);

      if (studentCount || teacherCount || lectureCount) {
        return NextResponse.json(
          { error: 'Class has students, teachers, or lectures and cannot be deleted' },
          { status: 409 }
        );
      }

      await AcademicClass.findByIdAndDelete(params.id);
      return NextResponse.json({ message: 'Class deleted' });
    } catch (error) {
      console.error('Delete class error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });

  return handler(req);
}
