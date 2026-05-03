import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db/mongoose';
import Teacher from '@/models/Teacher';
import User from '@/models/User';

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(['teacher', 'student']),
});

export async function POST(req: NextRequest) {
  let createdUserId: string | null = null;

  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectDB();

    const { name, email, password, role } = parsed.data;

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      status: 'pending',
    });
    createdUserId = user._id.toString();

    if (role === 'teacher') {
      await Teacher.create({
        userId: user._id,
        name: user.name,
        email: user.email,
        assignedClassIds: [],
      });
    }

    return NextResponse.json(
      {
        message: 'Registration successful. Awaiting admin approval.',
        user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status },
      },
      { status: 201 }
    );
  } catch (error) {
    if (createdUserId) {
      await User.findByIdAndDelete(createdUserId).catch(() => {});
    }
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
