import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/db/mongoose';
import { sendPasswordResetPin } from '@/lib/email/nodemailer';
import User from '@/models/User';

const RequestSchema = z.object({
  email: z.string().email(),
});

function createPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    await connectDB();
    const email = parsed.data.email.toLowerCase().trim();
    const user = await User.findOne({ email }).select('+resetPasswordOtpHash +resetPasswordOtpExpiresAt');

    if (!user) {
      return NextResponse.json({ message: 'If the email exists, a reset PIN has been sent.' });
    }

    const pin = createPin();
    user.resetPasswordOtpHash = await bcrypt.hash(pin, 12);
    user.resetPasswordOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.resetPasswordVerifiedUntil = undefined;
    await user.save();

    try {
      await sendPasswordResetPin(email, pin);
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }

      return NextResponse.json({
        message: 'Email service is not configured. Use the development PIN to continue.',
        devPin: pin,
      });
    }

    return NextResponse.json({ message: 'If the email exists, a reset PIN has been sent.' });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json({ error: 'Could not send reset PIN' }, { status: 500 });
  }
}
