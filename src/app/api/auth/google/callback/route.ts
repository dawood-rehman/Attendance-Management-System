import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import { getGoogleProfile, readGoogleState } from '@/lib/auth/google';
import { signToken } from '@/lib/auth/jwt';
import { ensureAdminProfile, ensureTeacherProfile } from '@/lib/profiles';
import Teacher from '@/models/Teacher';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

function redirectWithError(req: NextRequest, path: string, error: string) {
  return NextResponse.redirect(new URL(`${path}?googleError=${encodeURIComponent(error)}`, req.url));
}

function dashboardPath(role: string) {
  if (role === 'admin') return '/dashboard/admin';
  if (role === 'teacher') return '/dashboard/teacher';
  return '/dashboard/student';
}

function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const state = readGoogleState(searchParams.get('state'));
  const code = searchParams.get('code');

  if (!state || !code) {
    return redirectWithError(req, '/login', 'invalid_state');
  }

  try {
    await connectDB();
    const profile = await getGoogleProfile(code, origin);

    if (!profile.email_verified) {
      return redirectWithError(req, state.mode === 'register' ? '/register' : '/login', 'email_not_verified');
    }

    const email = profile.email.toLowerCase().trim();
    let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email }] }).select('+password');

    if (state.mode === 'register') {
      if (user) {
        if (!user.googleId) {
          user.googleId = profile.sub;
          user.authProvider = 'google';
          user.avatarUrl = profile.picture;
          await user.save();
        }
        return NextResponse.redirect(new URL('/login?registered=1', req.url));
      }

      user = await User.create({
        name: profile.name || email.split('@')[0],
        email,
        password: crypto.randomBytes(24).toString('base64url'),
        googleId: profile.sub,
        avatarUrl: profile.picture,
        authProvider: 'google',
        role: state.role || 'student',
        status: 'pending',
        mustChangePassword: false,
      });

      if (user.role === 'teacher') {
        await Teacher.create({
          userId: user._id,
          name: user.name,
          email: user.email,
          assignedClassIds: [],
        });
      }

      return NextResponse.redirect(new URL('/login?registered=1', req.url));
    }

    if (!user) {
      return redirectWithError(req, '/login', 'not_registered');
    }

    if (!user.googleId) user.googleId = profile.sub;
    user.authProvider = 'google';
    user.avatarUrl = profile.picture || user.avatarUrl;
    await user.save();

    if (user.status === 'pending') {
      return redirectWithError(req, '/login', 'pending');
    }
    if (user.status === 'rejected') {
      return redirectWithError(req, '/login', 'rejected');
    }

    if (user.role === 'admin') await ensureAdminProfile(user._id.toString());
    if (user.role === 'teacher') await ensureTeacherProfile(user._id.toString());

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
    });

    const response = NextResponse.redirect(new URL(dashboardPath(user.role), req.url));
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Google OAuth error:', error);
    return redirectWithError(req, state.mode === 'register' ? '/register' : '/login', 'oauth_failed');
  }
}
