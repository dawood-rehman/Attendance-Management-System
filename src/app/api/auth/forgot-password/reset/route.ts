import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/models/User';

const ResetSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = ResetSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid email and new password are required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email: parsed.data.email.toLowerCase().trim() }).select(
      '+password +resetPasswordOtpHash +resetPasswordOtpExpiresAt +resetPasswordVerifiedUntil'
    );

    if (!user?.resetPasswordVerifiedUntil || user.resetPasswordVerifiedUntil.getTime() < Date.now()) {
      return NextResponse.json({ error: 'PIN verification expired. Please request a new PIN.' }, { status: 400 });
    }

    user.password = parsed.data.password;
    user.mustChangePassword = false;
    user.resetPasswordOtpHash = undefined;
    user.resetPasswordOtpExpiresAt = undefined;
    user.resetPasswordVerifiedUntil = undefined;
    await user.save();

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Could not reset password' }, { status: 500 });
  }
}
