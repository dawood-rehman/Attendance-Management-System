import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import Admin from '@/models/Admin';
import Lecture from '@/models/Lecture';
import Student from '@/models/Student';
import Teacher from '@/models/Teacher';
import User from '@/models/User';
import { ensureAdminProfile, ensureTeacherProfile } from '@/lib/profiles';
import { z } from 'zod';

const UpdateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']).optional(),
  name: z.string().min(2).optional(),
  role: z.enum(['teacher', 'student']).optional(),
});

// PATCH /api/admin/users/[id] - update user status
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireRole(['admin'], async (req: NextRequest) => {
    try {
      await connectDB();
      const body = await req.json();
      const parsed = UpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
      }

      const user = await User.findByIdAndUpdate(params.id, parsed.data, { new: true });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (user.role === 'teacher') {
        const teacher = await ensureTeacherProfile(user._id.toString());
        if (teacher) {
          teacher.name = user.name;
          teacher.email = user.email;
          await teacher.save();
        }
      }

      if (user.role === 'admin') {
        const admin = await ensureAdminProfile(user._id.toString());
        if (admin) {
          admin.name = user.name;
          admin.email = user.email;
          await admin.save();
        }
      }

      return NextResponse.json({ user: user.toJSON(), message: 'User updated successfully' });
    } catch (error) {
      console.error('Update user error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
  return handler(req);
}

// DELETE /api/admin/users/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const handler = requireRole(['admin'], async (req: NextRequest) => {
    try {
      await connectDB();
      const user = await User.findById(params.id);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      if (user.role === 'teacher') {
        const teacher = await Teacher.findOne({ userId: user._id });
        if (teacher) {
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
          await Teacher.findByIdAndDelete(teacher._id);
        }
      }

      if (user.role === 'student') {
        await Student.findOneAndDelete({ userId: user._id });
      }

      if (user.role === 'admin') {
        await Admin.findOneAndDelete({ userId: user._id });
      }

      await User.findByIdAndDelete(params.id);
      return NextResponse.json({ message: 'User deleted' });
    } catch (error) {
      console.error('Delete user error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
  return handler(req);
}
