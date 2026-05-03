import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import Student from '@/models/Student';
import User from '@/models/User';
import { z } from 'zod';
import { signToken } from '@/lib/auth/jwt';
import { ensureAdminProfile, ensureTeacherProfile } from '@/lib/profiles';

const UpdateSettingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  return true;
}, { message: 'Current password required to change password' });

export const PATCH = requireAuth(async (req: NextRequest, user) => {
  try {
    await connectDB();
    const body = await req.json();
    const parsed = UpdateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, email, currentPassword, newPassword } = parsed.data;
    const dbUser = await User.findById(user.userId).select('+password');

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if email is taken
    if (email && email !== dbUser.email) {
      const existing = await User.findOne({ email, _id: { $ne: user.userId } });
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
    }

    // Verify and update password
    if (currentPassword && newPassword) {
      const isMatch = await dbUser.comparePassword(currentPassword);
      if (!isMatch) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
      dbUser.password = newPassword;
      dbUser.mustChangePassword = false;
    }

    if (name) dbUser.name = name;
    if (email) dbUser.email = email;

    await dbUser.save();

    if (dbUser.role === 'admin') {
      const admin = await ensureAdminProfile(dbUser._id.toString());
      if (admin) {
        admin.name = dbUser.name;
        admin.email = dbUser.email;
        await admin.save();
      }
    }
    if (dbUser.role === 'teacher') {
      const teacher = await ensureTeacherProfile(dbUser._id.toString());
      if (teacher) {
        teacher.name = dbUser.name;
        teacher.email = dbUser.email;
        await teacher.save();
      }
    }
    if (dbUser.role === 'student') {
      await Student.findOneAndUpdate(
        { userId: dbUser._id },
        { name: dbUser.name, email: dbUser.email }
      );
    }

    const token = signToken({
      userId: dbUser._id.toString(),
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status,
      mustChangePassword: dbUser.mustChangePassword,
    });

    const response = NextResponse.json({
      message: 'Settings updated successfully',
      token,
      user: {
        id: dbUser._id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        status: dbUser.status,
        mustChangePassword: dbUser.mustChangePassword,
      },
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
