'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/contexts/auth-context';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useAuth();

  useEffect(() => {
    const complete = async () => {
      const userId = searchParams.get('userId');
      const secret = searchParams.get('secret');
      const failure = searchParams.get('failure');

      if (failure) {
        setError('OAuth sign-in failed');
        router.replace('/login');
        return;
      }

      if (!userId || !secret) {
        setError('Missing OAuth parameters');
        router.replace('/login');
        return;
      }

      try {
        await account.createSession(userId, secret as unknown as string);
        await refresh();
        router.replace('/dashboard');
      } catch (e: any) {
        setError(e?.message || 'Failed to create session');
        router.replace('/login');
      }
    };
    complete();
  }, [router, searchParams]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-sm text-muted-foreground">
        {error ? 'Authentication failed, redirecting…' : 'Completing sign-in…'}
      </div>
    </div>
  );
}


