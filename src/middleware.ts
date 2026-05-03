import { NextRequest, NextResponse } from 'next/server';
import { verifyEdgeToken } from '@/lib/auth/edge-jwt';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/api/auth/login', '/api/auth/register'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static files
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Skip middleware for API routes (they handle auth themselves)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const payload = await verifyEdgeToken(token);

    if (payload.status !== 'approved') {
      const response = NextResponse.redirect(new URL('/login', req.url));
      response.cookies.delete('auth-token');
      return response;
    }

    if (payload.mustChangePassword && pathname !== '/profile') {
      return NextResponse.redirect(new URL('/profile?forcePassword=1', req.url));
    }

    // Role-based route protection
    if (pathname.startsWith('/dashboard/admin') && payload.role !== 'admin') {
      return NextResponse.redirect(new URL(`/dashboard/${payload.role}`, req.url));
    }
    if (pathname.startsWith('/dashboard/teacher') && payload.role !== 'teacher') {
      return NextResponse.redirect(new URL(`/dashboard/${payload.role}`, req.url));
    }
    if (pathname.startsWith('/dashboard/student') && payload.role !== 'student') {
      return NextResponse.redirect(new URL(`/dashboard/${payload.role}`, req.url));
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('auth-token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
