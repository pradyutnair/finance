'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { account } from '@/lib/appwrite';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';

export default function VerifyEmailSuccessPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh } = useAuth();

  useEffect(() => {
    const verifyEmail = async () => {
      const userId = searchParams.get('userId');
      const secret = searchParams.get('secret');

      if (!userId || !secret) {
        setStatus('error');
        setMessage('Invalid verification link. Missing required parameters.');
        return;
      }

      try {
        // Update verification status
        await account.updateVerification(userId, secret);

        // Refresh the user context to update verification status
        await refresh();

        setStatus('success');
        setMessage('Your email has been successfully verified!');
        toast.success('Email verified successfully!');

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);

      } catch (error) {
        console.error('Email verification error:', error);
        setStatus('error');
        setMessage('Failed to verify email. The link may be expired or invalid.');
        toast.error('Email verification failed');
      }
    };

    verifyEmail();
  }, [searchParams, router, refresh]);

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const handleGoToLogin = () => {
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-300 animate-spin" />
            </div>
          )}

          {status === 'success' && (
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-300" />
            </div>
          )}

          {status === 'error' && (
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-300" />
            </div>
          )}

          <CardTitle className="text-2xl font-bold">
            {status === 'loading' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>

          <CardDescription className="text-center">
            {status === 'loading' && 'Please wait while we verify your email address.'}
            {status === 'success' && 'Welcome to Nexpass! Your account is now active.'}
            {status === 'error' && message}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === 'success' && (
            <Button
              onClick={handleGoToDashboard}
              className="w-full"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <Button
                onClick={handleGoToLogin}
                className="w-full"
                variant="outline"
              >
                Go to Login
              </Button>

              <Button
                onClick={() => window.location.reload()}
                className="w-full"
                variant="ghost"
              >
                Try Again
              </Button>
            </div>
          )}

          {status === 'loading' && (
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This should only take a moment...
              </p>
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {status === 'success' && 'You will be redirected to your dashboard automatically.'}
              {status === 'error' && 'If you continue to have issues, please contact support.'}
              {status === 'loading' && 'Redirecting you to your dashboard once verification is complete.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}