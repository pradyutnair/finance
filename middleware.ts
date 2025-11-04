import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/middleware/auth';

// Routes that require premium subscription
const PREMIUM_ROUTES = [
  '/banks',
  '/link-bank',
  '/transactions',
  '/analytics',
  '/settings',
];

// Routes that require authentication but not premium
const AUTH_ROUTES = [
  '/dashboard',
  '/profile',
];

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/pricing',
  '/privacy',
  '/terms',
  '/api/stripe/webhook-handler', // Webhook endpoint must be public
];

// Auth routes that should redirect authenticated users away
const REDIRECT_AUTH_ROUTES = [
  '/login',
  '/signup',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, API routes (except protected ones), and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') ||
    pathname.startsWith('/static') ||
    PUBLIC_ROUTES.some(route => pathname === route)
  ) {
    return NextResponse.next();
  }

  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // User is not authenticated
    if (!user) {
      // For protected routes, redirect to login with return URL
      if (AUTH_ROUTES.some(route => pathname.startsWith(route)) ||
          PREMIUM_ROUTES.some(route => pathname.startsWith(route))) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }

    // User is authenticated - check for redirects from auth pages
    if (REDIRECT_AUTH_ROUTES.includes(pathname)) {
      // Redirect to dashboard or intended destination
      const redirectUrl = request.nextUrl.searchParams.get('redirect') || '/dashboard';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // Check premium subscription for premium routes
    if (PREMIUM_ROUTES.some(route => pathname.startsWith(route))) {
      try {
        // Check user's premium status
        const subscriptionResponse = await fetch(`${request.nextUrl.origin}/api/stripe/subscription-status`, {
          headers: {
            'Cookie': request.headers.get('Cookie') || '',
          },
        });

        if (!subscriptionResponse.ok) {
          console.error('Failed to check subscription status:', subscriptionResponse.status);
          // If we can't verify status, allow access but log the error
          return NextResponse.next();
        }

        const subscriptionData = await subscriptionResponse.json();

        if (!subscriptionData.isPremium) {
          // User is not premium, redirect to pricing with return URL
          const pricingUrl = new URL('/pricing', request.url);
          pricingUrl.searchParams.set('redirect', pathname);
          pricingUrl.searchParams.set('require_premium', 'true');
          return NextResponse.redirect(pricingUrl);
        }
      } catch (error) {
        console.error('Error checking premium status:', error);
        // If there's an error checking premium status, allow access but log it
        return NextResponse.next();
      }
    }

    // User is authenticated and has required access
    return NextResponse.next();

  } catch (error) {
    console.error('Middleware error:', error);

    // For protected routes, redirect to login on any auth error
    if (AUTH_ROUTES.some(route => pathname.startsWith(route)) ||
        PREMIUM_ROUTES.some(route => pathname.startsWith(route))) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};