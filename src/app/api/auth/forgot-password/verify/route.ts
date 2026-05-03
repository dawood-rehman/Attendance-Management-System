import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/models/User';

const VerifySchema = z.object({
  email: z.string().email(),
  pin: z.string().regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = VerifySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid email and 6-digit PIN are required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email: parsed.data.email.toLowerCase().trim() }).select(
      '+resetPasswordOtpHash +resetPasswordOtpExpiresAt +resetPasswordVerifiedUntil'
    );

    if (!user?.resetPasswordOtpHash || !user.resetPasswordOtpExpiresAt) {
      return NextResponse.json({ error: 'Invalid or expired PIN' }, { status: 400 });
    }

    if (user.resetPasswordOtpExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired PIN' }, { status: 400 });
    }

    const matches = await bcrypt.compare(parsed.data.pin, user.resetPasswordOtpHash);
    if (!matches) {
      return NextResponse.json({ error: 'Invalid or expired PIN' }, { status: 400 });
    }

    user.resetPasswordVerifiedUntil = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    return NextResponse.json({ message: 'PIN verified' });
  } catch (error) {
    console.error('Password reset verify error:', error);
    return NextResponse.json({ error: 'Could not verify PIN' }, { status: 500 });
  }
}
