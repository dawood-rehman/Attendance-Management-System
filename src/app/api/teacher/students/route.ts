import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import AcademicClass from '@/models/AcademicClass';
import Department from '@/models/Department';
import Student from '@/models/Student';
import Teacher from '@/models/Teacher';
import User from '@/models/User';
import { ensureTeacherProfile } from '@/lib/profiles';
import { generateStudentEmail } from '@/lib/email-generator';
import { z } from 'zod';

const StudentSchema = z.object({
  name: z.string().min(2),
  rollNumber: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(6).max(100).optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  departmentId: z.string().min(1),
  classId: z.string().min(1),
  teacherId: z.string().optional().or(z.literal('')),
});

// GET /api/teacher/students
export const GET = requireAuth(async (req: NextRequest, user) => {
  try {
    if (!['teacher', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const { searchParams } = new URL(req.url);
    const teacherId = user.role === 'admin' ? searchParams.get('teacherId') : null;
    const departmentId = searchParams.get('departmentId');
    const classId = searchParams.get('classId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';

    const filter: Record<string, unknown> = {};
    if (user.role === 'teacher') {
      const teacher = await ensureTeacherProfile(user.userId);
      if (!teacher) {
        return NextResponse.json({ students: [], total: 0, page, pages: 0 });
      }

      const assignedClassIds = teacher.assignedClassIds.map((id) => id.toString());
      if (classId && !assignedClassIds.includes(classId)) {
        return NextResponse.json({ students: [], total: 0, page, pages: 0 });
      }
      if (assignedClassIds.length) {
        filter.classId = classId || { $in: assignedClassIds };
      } else {
        filter.teacherId = { $in: [teacher._id, user.userId] };
      }
    } else if (teacherId) {
      filter.teacherId = teacherId;
    }
    if (departmentId) filter.departmentId = departmentId;
    if (classId) filter.classId = classId;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Student.countDocuments(filter);
    const students = await Student.find(filter)
      .populate('departmentId', 'name code')
      .populate('classId', 'name code')
      .populate('teacherId', 'name email')
      .populate('userId', 'name email mustChangePassword status')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({ students, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Get students error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/teacher/students
export const POST = requireAuth(async (req: NextRequest, user) => {
  let createdUserId: string | null = null;

  try {
    if (!['teacher', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const parsed = StudentSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, rollNumber, email, password, phone, departmentId, classId, teacherId } = parsed.data;
    const normalizedEmail = email?.trim()
      ? email.toLowerCase().trim()
      : await generateStudentEmail(name, classId);
    let linkedTeacherId: string | undefined;

    const [department, academicClass, existingUser] = await Promise.all([
      Department.findById(departmentId).lean(),
      AcademicClass.findById(classId).lean(),
      User.findOne({ email: normalizedEmail }).lean(),
    ]);

    if (!department) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    if (!academicClass || academicClass.departmentId.toString() !== departmentId) {
      return NextResponse.json({ error: 'Class not found in selected department' }, { status: 404 });
    }
    if (existingUser) {
      return NextResponse.json({ error: 'A user with this student email already exists' }, { status: 409 });
    }

    const currentClassStrength = await Student.countDocuments({ classId });
    if (currentClassStrength >= academicClass.maxStudents) {
      return NextResponse.json(
        { error: `Class strength limit reached (${academicClass.maxStudents} students)` },
        { status: 409 }
      );
    }

    if (user.role === 'teacher') {
      const teacher = await ensureTeacherProfile(user.userId);
      if (!teacher) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });

      const assignedClassIds = teacher.assignedClassIds.map((id) => id.toString());
      if (!assignedClassIds.includes(classId)) {
        return NextResponse.json({ error: 'This class is not assigned to your teacher account' }, { status: 403 });
      }
      linkedTeacherId = teacher._id.toString();
    } else if (teacherId) {
      const teacher = await Teacher.findById(teacherId).lean();
      if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });

      const assignedClassIds = teacher.assignedClassIds.map((id) => id.toString());
      if (assignedClassIds.length && !assignedClassIds.includes(classId)) {
        return NextResponse.json({ error: 'Selected teacher is not assigned to this class' }, { status: 409 });
      }
      linkedTeacherId = teacher._id.toString();
    }

    const studentUser = await User.create({
      name,
      email: normalizedEmail,
      password: password || normalizedEmail,
      role: 'student',
      status: 'approved',
      mustChangePassword: true,
    });
    createdUserId = studentUser._id.toString();

    const student = await Student.create({
      name,
      rollNumber,
      email: normalizedEmail,
      phone: phone || undefined,
      userId: studentUser._id,
      teacherId: linkedTeacherId,
      departmentId,
      classId,
      class: academicClass.name,
    });

    return NextResponse.json({ student, message: 'Student created' }, { status: 201 });
  } catch (error: unknown) {
    if (createdUserId) {
      await User.findByIdAndDelete(createdUserId).catch(() => {});
    }

    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: 'Roll number already exists in this class' }, { status: 409 });
    }
    console.error('Create student error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
