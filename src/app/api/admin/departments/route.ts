import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/db/mongoose';
import Department from '@/models/Department';
import { z } from 'zod';

const DepartmentSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().max(20).optional().or(z.literal('')),
  description: z.string().max(500).optional().or(z.literal('')),
});

export const GET = requireAuth(async (_req: NextRequest, user) => {
  try {
    if (!['admin', 'teacher'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await connectDB();
    const departments = await Department.find({}).sort({ name: 1 }).lean();
    return NextResponse.json({ departments });
  } catch (error) {
    console.error('Get departments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = requireRole(['admin'], async (req: NextRequest) => {
  try {
    await connectDB();
    const parsed = DepartmentSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const department = await Department.create({
      name: parsed.data.name,
      code: parsed.data.code || undefined,
      description: parsed.data.description || undefined,
    });

    return NextResponse.json({ department, message: 'Department created' }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: 'Department name or code already exists' }, { status: 409 });
    }
    console.error('Create department error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
