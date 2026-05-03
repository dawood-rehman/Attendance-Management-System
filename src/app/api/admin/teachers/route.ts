import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import AcademicClass from '@/models/AcademicClass';
import Teacher from '@/models/Teacher';
import User from '@/models/User';
import { generateTeacherEmail } from '@/lib/email-generator';

const TeacherSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(6).max(100).optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  employeeId: z.string().optional().or(z.literal('')),
  education: z.string().optional().or(z.literal('')),
  degree: z.string().optional().or(z.literal('')),
  departmentId: z.string().optional().or(z.literal('')),
  assignedClassIds: z.array(z.string().min(1)).optional(),
});

function uniqueIds(ids: string[] = []) {
  return [...new Set(ids.filter(Boolean))];
}

async function ensureTeacherProfiles() {
  const users = await User.find({ role: 'teacher' }).select('_id name email').lean();
  const userIds = users.map((user) => user._id);
  const existing = await Teacher.find({ userId: { $in: userIds } }).select('userId').lean();
  const existingIds = new Set(existing.map((teacher) => teacher.userId.toString()));
  const missing = users.filter((user) => !existingIds.has(user._id.toString()));

  if (missing.length) {
    await Teacher.insertMany(
      missing.map((user) => ({
        userId: user._id,
        name: user.name,
        email: user.email,
        assignedClassIds: [],
      })),
      { ordered: false }
    ).catch(() => {});
  }
}

async function validateClasses(classIds: string[]) {
  if (!classIds.length) return true;
  const count = await AcademicClass.countDocuments({ _id: { $in: classIds } });
  return count === classIds.length;
}

export const GET = requireRole(['admin'], async (req: NextRequest) => {
  try {
    await connectDB();
    await ensureTeacherProfiles();

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const classId = searchParams.get('classId');
    const status = searchParams.get('status');
    const search = searchParams.get('search') || '';

    const filter: Record<string, unknown> = {};
    if (departmentId) filter.departmentId = departmentId;
    if (classId) filter.assignedClassIds = classId;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) {
      const users = await User.find({ role: 'teacher', status }).select('_id').lean();
      filter.userId = { $in: users.map((user) => user._id) };
    }

    const teachers = await Teacher.find(filter)
      .populate('userId', 'name email role status mustChangePassword createdAt')
      .populate('departmentId', 'name code')
      .populate('assignedClassIds', 'name code departmentId')
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ teachers });
  } catch (error) {
    console.error('Get teachers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = requireRole(['admin'], async (req: NextRequest) => {
  let createdUserId: string | null = null;

  try {
    await connectDB();
    const parsed = TeacherSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const normalizedEmail = parsed.data.email?.trim()
      ? parsed.data.email.toLowerCase().trim()
      : await generateTeacherEmail(parsed.data.name);
    const assignedClassIds = uniqueIds(parsed.data.assignedClassIds);
    const classesExist = await validateClasses(assignedClassIds);

    if (!classesExist) {
      return NextResponse.json({ error: 'One or more assigned classes were not found' }, { status: 404 });
    }

    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const teacherUser = await User.create({
      name: parsed.data.name,
      email: normalizedEmail,
      password: parsed.data.password || normalizedEmail,
      role: 'teacher',
      status: 'approved',
      mustChangePassword: true,
    });
    createdUserId = teacherUser._id.toString();

    const teacher = await Teacher.create({
      userId: teacherUser._id,
      name: parsed.data.name,
      email: normalizedEmail,
      phone: parsed.data.phone || undefined,
      employeeId: parsed.data.employeeId || undefined,
      education: parsed.data.education || undefined,
      degree: parsed.data.degree || undefined,
      departmentId: parsed.data.departmentId || undefined,
      assignedClassIds,
    });

    const populated = await Teacher.findById(teacher._id)
      .populate('userId', 'name email role status mustChangePassword createdAt')
      .populate('departmentId', 'name code')
      .populate('assignedClassIds', 'name code departmentId')
      .lean();

    return NextResponse.json({ teacher: populated, message: 'Teacher account created' }, { status: 201 });
  } catch (error: unknown) {
    if (createdUserId) {
      await User.findByIdAndDelete(createdUserId).catch(() => {});
    }
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: 'Teacher email or employee ID already exists' }, { status: 409 });
    }
    console.error('Create teacher error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
