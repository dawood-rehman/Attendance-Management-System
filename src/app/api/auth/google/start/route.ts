import { NextRequest, NextResponse } from 'next/server';
import { createGoogleState, googleAuthUrl, GoogleRegisterRole } from '@/lib/auth/google';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const mode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const role = searchParams.get('role') === 'teacher' ? 'teacher' : 'student';
  const state = createGoogleState({
    mode,
    role: mode === 'register' ? (role as GoogleRegisterRole) : undefined,
  });
  const url = googleAuthUrl(origin, state);

  if (!url) {
    const target = mode === 'register' ? '/register?googleError=missing_config' : '/login?googleError=missing_config';
    return NextResponse.redirect(new URL(target, req.url));
  }

  return NextResponse.redirect(url);
}
