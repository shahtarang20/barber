import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const payload = token ? verifyToken(token) : null;

  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/register');

  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard');
  const isAdminPage = request.nextUrl.pathname.startsWith('/admin');

  // If user is trying to access dashboard but is not logged in
  if (isDashboardPage && !payload) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Admin pages require a valid token AND the ADMIN role
  if (isAdminPage && (!payload || payload.role !== 'ADMIN')) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If user is already logged in and tries to access login/register
  if (isAuthPage && payload) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login', '/register'],
};
