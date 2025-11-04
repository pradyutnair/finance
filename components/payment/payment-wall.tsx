'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Lock, Check, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface PaymentWallProps {
  title?: string;
  description?: string;
  feature?: string;
  ctaText?: string;
  redirectTo?: string;
  className?: string;
}

const premiumFeatures = [
  "Unlimited bank connections",
  "Real-time insights and analytics",
  "Advanced budget tracking",
  "AI-powered categorization",
  "End-to-end encryption",
  "Export financial reports",
  "Email support",
  "GDPR compliant"
];

export function PaymentWall({
  title = "Premium Feature",
  description = "Get unlimited access to all premium features and take control of your finances.",
  feature,
  ctaText = "Upgrade to Premium",
  redirectTo = "/pricing",
  className = ""
}: PaymentWallProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgradeClick = async () => {
    setIsLoading(true);

    try {
      // Check if user is authenticated
      const response = await fetch('/api/user/profile');

      if (!response.ok) {
        // User not authenticated, redirect to login
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      // User is authenticated, create checkout session
      const checkoutResponse = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!checkoutResponse.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await checkoutResponse.json();
      window.location.href = url;

    } catch (error) {
      console.error('Error initiating checkout:', error);
      setIsLoading(false);
      // Fallback to pricing page
      window.location.href = redirectTo;
    }
  };

  return (
    <div className={`flex items-center justify-center min-h-[400px] p-4 ${className}`}>
      <Card className="w-full max-w-md mx-auto border-2" style={{ borderColor: '#40221a' }}>
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#40221a20' }}>
            <Crown className="w-8 h-8" style={{ color: '#40221a' }} />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
            {title}
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            {description}
          </CardDescription>
          {feature && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: '#40221a10', color: '#40221a' }}>
              <Lock className="w-4 h-4" />
              {feature}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4 pb-6">
          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                €6.99
              </span>
              <span className="text-lg text-gray-600 dark:text-gray-400">
                /month
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Billed monthly, cancel anytime
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white text-center">
              What's included in Premium:
            </p>
            {premiumFeatures.slice(0, 4).map((premiumFeature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#40221a20' }}>
                  <Check className="w-3 h-3" style={{ color: '#40221a' }} strokeWidth={3} />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {premiumFeature}
                </span>
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-0">
          <Button
            onClick={handleUpgradeClick}
            disabled={isLoading}
            size="lg"
            className="w-full text-white font-medium py-6 rounded-full border-0"
            style={{ backgroundColor: '#40221a' }}
          >
            {isLoading ? (
              <>
                <Sparkles className="w-5 h-5 mr-2 animate-pulse" />
                Processing...
              </>
            ) : (
              <>
                <Crown className="w-5 h-5 mr-2" />
                {ctaText}
              </>
            )}
          </Button>

          <Link
            href="/pricing"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Learn more about Premium →
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}