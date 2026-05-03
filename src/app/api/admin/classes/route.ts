import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import Department from '@/models/Department';
import AcademicClass from '@/models/AcademicClass';
import Student from '@/models/Student';
import { ensureTeacherProfile } from '@/lib/profiles';
import { z } from 'zod';

const ClassSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional().or(z.literal('')),
  departmentId: z.string().min(1),
  maxStudents: z.coerce.number().int().min(1).max(500).optional(),
});

export const GET = requireAuth(async (req: NextRequest, user) => {
  try {
    if (!['admin', 'teacher'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await connectDB();
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const filter: Record<string, unknown> = departmentId ? { departmentId } : {};

    if (user.role === 'teacher') {
      const teacher = await ensureTeacherProfile(user.userId);
      if (!teacher || teacher.assignedClassIds.length === 0) {
        return NextResponse.json({ classes: [] });
      }
      filter._id = { $in: teacher.assignedClassIds };
    }

    const classes = await AcademicClass.find(filter)
      .populate('departmentId', 'name code')
      .sort({ name: 1 })
      .lean();
    const counts = await Student.aggregate([
      { $match: { classId: { $in: classes.map((academicClass) => academicClass._id) } } },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ]);
    const countByClass = new Map(counts.map((item) => [item._id.toString(), item.count]));

    return NextResponse.json({
      classes: classes.map((academicClass) => ({
        ...academicClass,
        currentStrength: countByClass.get(academicClass._id.toString()) || 0,
      })),
    });
  } catch (error) {
    console.error('Get classes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = requireRole(['admin'], async (req: NextRequest) => {
  try {
    await connectDB();
    const parsed = ClassSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const department = await Department.findById(parsed.data.departmentId).lean();
    if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

    const academicClass = await AcademicClass.create({
      name: parsed.data.name,
      code: parsed.data.code || undefined,
      departmentId: parsed.data.departmentId,
      maxStudents: parsed.data.maxStudents || 10,
    });

    return NextResponse.json({ class: academicClass, message: 'Class created' }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: 'Class name or code already exists in this department' }, { status: 409 });
    }
    console.error('Create class error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
