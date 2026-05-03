import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import Department from '@/models/Department';
import AcademicClass from '@/models/AcademicClass';
import Lecture from '@/models/Lecture';
import Student from '@/models/Student';
import Teacher from '@/models/Teacher';
import { z } from 'zod';

const UpdateDepartmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().max(20).optional().or(z.literal('')),
  description: z.string().max(500).optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireRole(['admin'], async (req: NextRequest) => {
    try {
      await connectDB();
      const parsed = UpdateDepartmentSchema.safeParse(await req.json());

      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
      }

      const department = await Department.findByIdAndUpdate(
        params.id,
        {
          ...parsed.data,
          code: parsed.data.code || undefined,
          description: parsed.data.description || undefined,
        },
        { new: true }
      ).lean();

      if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

      return NextResponse.json({ department, message: 'Department updated' });
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 11000) {
        return NextResponse.json({ error: 'Department name or code already exists' }, { status: 409 });
      }
      console.error('Update department error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });

  return handler(req);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireRole(['admin'], async () => {
    try {
      await connectDB();
      const [classCount, studentCount, teacherCount, lectureCount] = await Promise.all([
        AcademicClass.countDocuments({ departmentId: params.id }),
        Student.countDocuments({ departmentId: params.id }),
        Teacher.countDocuments({ departmentId: params.id }),
        Lecture.countDocuments({ departmentId: params.id }),
      ]);

      if (classCount || studentCount || teacherCount || lectureCount) {
        return NextResponse.json(
          { error: 'Department has classes, teachers, students, or lectures and cannot be deleted' },
          { status: 409 }
        );
      }

      await Department.findByIdAndDelete(params.id);
      return NextResponse.json({ message: 'Department deleted' });
    } catch (error) {
      console.error('Delete department error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });

  return handler(req);
}
