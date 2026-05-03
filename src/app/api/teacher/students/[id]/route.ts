import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import AcademicClass from '@/models/AcademicClass';
import Student from '@/models/Student';
import Teacher from '@/models/Teacher';
import User from '@/models/User';
import { ensureTeacherProfile } from '@/lib/profiles';
import { z } from 'zod';

const UpdateSchema = z.object({
  name: z.string().min(2).optional(),
  rollNumber: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100).optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  departmentId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  teacherId: z.string().optional().or(z.literal('')),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireAuth(async () => {
    await connectDB();
    const student = await Student.findById(params.id)
      .populate('departmentId', 'name code')
      .populate('classId', 'name code')
      .populate('userId', 'name email mustChangePassword status')
      .lean();

    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ student });
  });

  return handler(req);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireAuth(async (req: NextRequest, user) => {
    try {
      if (!['teacher', 'admin'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await connectDB();
      const parsed = UpdateSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
      }

      const existing = await Student.findById(params.id);
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      let currentTeacherId: string | undefined;
      if (user.role === 'teacher') {
        const teacher = await ensureTeacherProfile(user.userId);
        if (!teacher) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });

        const assignedClassIds = teacher.assignedClassIds.map((id) => id.toString());
        const existingTeacherId = existing.teacherId?.toString();
        const ownsStudent = existingTeacherId === teacher._id.toString() || existingTeacherId === user.userId;
        if (!ownsStudent && !assignedClassIds.includes(existing.classId.toString())) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        currentTeacherId = teacher._id.toString();
      }

      const nextDepartmentId = parsed.data.departmentId || existing.departmentId.toString();
      const nextClassId = parsed.data.classId || existing.classId.toString();
      const academicClass = await AcademicClass.findById(nextClassId).lean();

      if (!academicClass || academicClass.departmentId.toString() !== nextDepartmentId) {
        return NextResponse.json({ error: 'Class not found in selected department' }, { status: 404 });
      }

      if (nextClassId !== existing.classId.toString()) {
        const currentClassStrength = await Student.countDocuments({ classId: nextClassId });
        if (currentClassStrength >= academicClass.maxStudents) {
          return NextResponse.json(
            { error: `Class strength limit reached (${academicClass.maxStudents} students)` },
            { status: 409 }
          );
        }
      }

      if (user.role === 'teacher') {
        const teacher = await ensureTeacherProfile(user.userId);
        const assignedClassIds = teacher?.assignedClassIds.map((id) => id.toString()) || [];
        if (!assignedClassIds.includes(nextClassId)) {
          return NextResponse.json({ error: 'This class is not assigned to your teacher account' }, { status: 403 });
        }
      } else if (parsed.data.teacherId !== undefined) {
        if (parsed.data.teacherId) {
          const teacher = await Teacher.findById(parsed.data.teacherId).lean();
          if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });

          const assignedClassIds = teacher.assignedClassIds.map((id) => id.toString());
          if (assignedClassIds.length && !assignedClassIds.includes(nextClassId)) {
            return NextResponse.json({ error: 'Selected teacher is not assigned to this class' }, { status: 409 });
          }
          currentTeacherId = teacher._id.toString();
        } else {
          currentTeacherId = undefined;
        }
      }

      const nextEmail = parsed.data.email?.toLowerCase().trim();
      if (nextEmail && nextEmail !== existing.email) {
        const duplicate = await User.findOne({ email: nextEmail, _id: { $ne: existing.userId } }).lean();
        if (duplicate) {
          return NextResponse.json({ error: 'A user with this student email already exists' }, { status: 409 });
        }
      }

      const updates: Record<string, unknown> = {
        ...parsed.data,
        email: nextEmail || existing.email,
        phone: parsed.data.phone || undefined,
        departmentId: nextDepartmentId,
        classId: nextClassId,
        class: academicClass.name,
      };
      delete updates.password;
      if (currentTeacherId !== undefined || parsed.data.teacherId !== undefined) {
        updates.teacherId = currentTeacherId;
      }

      const student = await Student.findByIdAndUpdate(params.id, updates, { new: true })
        .populate('departmentId', 'name code')
        .populate('classId', 'name code')
        .populate('teacherId', 'name email')
        .populate('userId', 'name email mustChangePassword status')
        .lean();

      const linkedUser = await User.findById(existing.userId).select('+password');
      if (linkedUser) {
        if (parsed.data.name) linkedUser.name = parsed.data.name;
        if (nextEmail) linkedUser.email = nextEmail;
        if (parsed.data.password) {
          linkedUser.password = parsed.data.password;
          linkedUser.mustChangePassword = true;
        }
        await linkedUser.save();
      }

      return NextResponse.json({ student, message: 'Student updated' });
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 11000) {
        return NextResponse.json({ error: 'Roll number already exists in this class' }, { status: 409 });
      }
      console.error('Update student error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });

  return handler(req);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireAuth(async (_req: NextRequest, user) => {
    if (!['teacher', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const existing = await Student.findById(params.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (user.role === 'teacher') {
      const teacher = await ensureTeacherProfile(user.userId);
      if (!teacher) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });

      const assignedClassIds = teacher.assignedClassIds.map((id) => id.toString());
      const existingTeacherId = existing.teacherId?.toString();
      const ownsStudent = existingTeacherId === teacher._id.toString() || existingTeacherId === user.userId;
      if (!ownsStudent && !assignedClassIds.includes(existing.classId.toString())) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const student = await Student.findByIdAndDelete(params.id);
    if (student?.userId) {
      await User.findByIdAndDelete(student.userId).catch(() => {});
    }

    return NextResponse.json({ message: 'Student deleted' });
  });

  return handler(req);
}
