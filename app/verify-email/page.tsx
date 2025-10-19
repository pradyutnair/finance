'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, ArrowLeft, RefreshCw } from 'lucide-react';

export default function VerifyEmailPage() {
  const { user, sendVerificationEmail, refresh } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const router = useRouter();

  // Redirect if user is not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Check if email is already verified
    const checkVerification = async () => {
      await refresh();
      if (user.emailVerification) {
        router.push('/dashboard');
      }
    };

    checkVerification();
  }, [user, router, refresh]);

  // Timer for resend button
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleResendEmail = async () => {
    if (timeLeft > 0) return;

    setIsResending(true);
    try {
      await sendVerificationEmail();
      toast.success('Verification email sent successfully!');
      setTimeLeft(60); // Reset timer
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      toast.error('Failed to resend verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-blue-600 dark:text-blue-300" />
          </div>
          <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification email to:<br />
            <span className="font-medium text-gray-900 dark:text-white">{user.email}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Please check your inbox and click the verification link to activate your account.
            </p>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              If you don't see the email, check your spam folder or request a new one below.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleResendEmail}
              disabled={isResending || timeLeft > 0}
              className="w-full"
              variant="outline"
            >
              {isResending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : timeLeft > 0 ? (
                `Resend Email (${timeLeft}s)`
              ) : (
                'Resend Verification Email'
              )}
            </Button>

            <Button
              onClick={() => window.location.reload()}
              className="w-full"
              variant="outline"
            >
              I've Verified My Email
            </Button>

            <Button
              onClick={handleBackToLogin}
              className="w-full"
              variant="ghost"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Need help? Contact support at support@nexpass.app
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}