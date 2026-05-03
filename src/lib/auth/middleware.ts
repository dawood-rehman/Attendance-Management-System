import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, JWTPayload } from '@/lib/auth/jwt';

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookieToken = req.cookies.get('auth-token')?.value;
  return cookieToken || null;
}

export function authenticate(req: NextRequest): JWTPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(
  handler: (req: NextRequest, user: JWTPayload) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const user = authenticate(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.status !== 'approved') {
      return NextResponse.json({ error: 'Account not approved yet' }, { status: 403 });
    }
    if (user.mustChangePassword && new URL(req.url).pathname !== '/api/settings') {
      return NextResponse.json(
        { error: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' },
        { status: 403 }
      );
    }
    return handler(req, user);
  };
}

export function requireRole(
  roles: string[],
  handler: (req: NextRequest, user: JWTPayload) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const user = authenticate(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.status !== 'approved') {
      return NextResponse.json({ error: 'Account not approved yet' }, { status: 403 });
    }
    if (user.mustChangePassword && new URL(req.url).pathname !== '/api/settings') {
      return NextResponse.json(
        { error: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' },
        { status: 403 }
      );
    }
    if (!roles.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req, user);
  };
}
