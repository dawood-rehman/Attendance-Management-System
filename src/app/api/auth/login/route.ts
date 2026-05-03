import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/models/User';
import { signToken } from '@/lib/auth/jwt';
import { ensureAdminProfile, ensureTeacherProfile } from '@/lib/profiles';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid credentials format' }, { status: 400 });
    }

    await connectDB();

    const { email, password } = parsed.data;

    // Include password for comparison (excluded by default via toJSON)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status === 'rejected') {
      return NextResponse.json({ error: 'Your account has been rejected.' }, { status: 403 });
    }

    if (user.status === 'pending') {
      return NextResponse.json(
        { error: 'Your account is pending admin approval.' },
        { status: 403 }
      );
    }

    if (user.role === 'admin') {
      await ensureAdminProfile(user._id.toString());
    }
    if (user.role === 'teacher') {
      await ensureTeacherProfile(user._id.toString());
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
    });

    const response = NextResponse.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
      },
    });

    // Set HTTP-only cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
