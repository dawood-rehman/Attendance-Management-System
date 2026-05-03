import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import AcademicClass from '@/models/AcademicClass';
import Lecture from '@/models/Lecture';
import Student from '@/models/Student';
import Teacher from '@/models/Teacher';
import User from '@/models/User';

const UpdateTeacherSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100).optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  employeeId: z.string().optional().or(z.literal('')),
  education: z.string().optional().or(z.literal('')),
  degree: z.string().optional().or(z.literal('')),
  departmentId: z.string().optional().or(z.literal('')),
  assignedClassIds: z.array(z.string().min(1)).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

function uniqueIds(ids: string[] = []) {
  return [...new Set(ids.filter(Boolean))];
}

async function validateClasses(classIds: string[]) {
  if (!classIds.length) return true;
  const count = await AcademicClass.countDocuments({ _id: { $in: classIds } });
  return count === classIds.length;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireRole(['admin'], async (req: NextRequest) => {
    try {
      await connectDB();
      const parsed = UpdateTeacherSchema.safeParse(await req.json());

      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
      }

      const teacher = await Teacher.findById(params.id);
      if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });

      const nextEmail = parsed.data.email?.toLowerCase().trim();
      const assignedClassIds = parsed.data.assignedClassIds
        ? uniqueIds(parsed.data.assignedClassIds)
        : undefined;

      if (assignedClassIds && !(await validateClasses(assignedClassIds))) {
        return NextResponse.json({ error: 'One or more assigned classes were not found' }, { status: 404 });
      }

      if (nextEmail && nextEmail !== teacher.email) {
        const duplicate = await User.findOne({ email: nextEmail, _id: { $ne: teacher.userId } }).lean();
        if (duplicate) {
          return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
        }
      }

      const user = await User.findById(teacher.userId).select('+password');
      if (user) {
        if (parsed.data.name) user.name = parsed.data.name;
        if (nextEmail) user.email = nextEmail;
        if (parsed.data.status) user.status = parsed.data.status;
        if (parsed.data.password) {
          user.password = parsed.data.password;
          user.mustChangePassword = true;
        }
        await user.save();
      }

      if (parsed.data.name) teacher.name = parsed.data.name;
      if (nextEmail) teacher.email = nextEmail;
      if (parsed.data.phone !== undefined) teacher.phone = parsed.data.phone || undefined;
      if (parsed.data.employeeId !== undefined) teacher.employeeId = parsed.data.employeeId || undefined;
      if (parsed.data.education !== undefined) teacher.education = parsed.data.education || undefined;
      if (parsed.data.degree !== undefined) teacher.degree = parsed.data.degree || undefined;
      if (parsed.data.departmentId !== undefined) teacher.set('departmentId', parsed.data.departmentId || undefined);
      if (assignedClassIds) teacher.set('assignedClassIds', assignedClassIds);
      await teacher.save();

      const populated = await Teacher.findById(teacher._id)
        .populate('userId', 'name email role status mustChangePassword createdAt')
        .populate('departmentId', 'name code')
        .populate('assignedClassIds', 'name code departmentId')
        .lean();

      return NextResponse.json({ teacher: populated, message: 'Teacher updated' });
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 11000) {
        return NextResponse.json({ error: 'Teacher email or employee ID already exists' }, { status: 409 });
      }
      console.error('Update teacher error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });

  return handler(req);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireRole(['admin'], async () => {
    try {
      await connectDB();
      const teacher = await Teacher.findById(params.id);
      if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });

      const [studentCount, lectureCount] = await Promise.all([
        Student.countDocuments({ teacherId: teacher._id }),
        Lecture.countDocuments({ teacherId: teacher._id }),
      ]);

      if (studentCount || lectureCount) {
        return NextResponse.json(
          { error: 'Teacher has linked students or lectures and cannot be deleted' },
          { status: 409 }
        );
      }

      await Promise.all([
        Teacher.findByIdAndDelete(teacher._id),
        User.findByIdAndDelete(teacher.userId),
      ]);

      return NextResponse.json({ message: 'Teacher deleted' });
    } catch (error) {
      console.error('Delete teacher error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });

  return handler(req);
}
