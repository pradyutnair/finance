'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Crown } from 'lucide-react';

interface CheckoutButtonProps {
  children?: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  redirectTo?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

export function CheckoutButton({
  children = "Upgrade to Premium",
  variant = 'default',
  size = 'default',
  className = "",
  redirectTo,
  onSuccess,
  onError,
  disabled = false
}: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);

    try {
      // Check if user is authenticated
      const userResponse = await fetch('/api/user/profile');

      if (!userResponse.ok) {
        // User not authenticated, redirect to login
        const currentPath = redirectTo || window.location.pathname;
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
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
        const errorData = await checkoutResponse.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await checkoutResponse.json();

      // Track success and redirect to Stripe Checkout
      onSuccess?.();
      window.location.href = url;

    } catch (error) {
      console.error('Checkout error:', error);
      const errorObj = error instanceof Error ? error : new Error('Checkout failed');
      onError?.(errorObj);
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCheckout}
      disabled={isLoading || disabled}
      variant={variant}
      size={size}
      className={`${className} ${variant === 'default' ? 'bg-gradient-to-r from-[#40221a] to-[#5c3128] hover:from-[#5c3128] hover:to-[#40221a]' : ''}`}
      style={variant === 'default' ? {} : {}}
    >
      {isLoading ? (
        <>
          <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
          Processing...
        </>
      ) : (
        <>
          <Crown className="w-4 h-4 mr-2" />
          {children}
        </>
      )}
    </Button>
  );
}

// Hook for premium status checking
export function usePremiumStatus() {
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkPremiumStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/stripe/subscription-status');

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated
          setIsPremium(false);
          return;
        }
        throw new Error('Failed to check premium status');
      }

      const data = await response.json();
      setIsPremium(data.isPremium);

    } catch (err) {
      console.error('Error checking premium status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check status');
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isPremium,
    isLoading,
    error,
    checkPremiumStatus
  };
}