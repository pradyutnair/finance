'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { user, loading, isEmailVerified } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !user) {
        console.log('AuthGuard: No user found, redirecting to login');
        router.push('/login');
      } else if (!requireAuth && user) {
        console.log('AuthGuard: User found on public route, redirecting to dashboard');
        router.push('/dashboard');
      } else if (requireAuth && user && !isEmailVerified) {
        console.log('AuthGuard: User not verified, redirecting to verify-email');
        router.push('/verify-email');
      } else if (requireAuth && user && isEmailVerified) {
        console.log('AuthGuard: User authenticated and verified, allowing access');
      }
    }
  }, [user, loading, isEmailVerified, requireAuth, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="ml-2 text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Show loading state while redirecting
  if (requireAuth && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="ml-2 text-sm text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  if (requireAuth && user && !isEmailVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="ml-2 text-sm text-muted-foreground">Redirecting to email verification...</p>
      </div>
    );
  }

  if (!requireAuth && user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="ml-2 text-sm text-muted-foreground">Redirecting to dashboard...</p>
      </div>
    );
  }

  return <>{children}</>;
}
