'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface PaymentSuccessNotificationProps {
  isVisible?: boolean;
  onClose?: () => void;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export function PaymentSuccessNotification({
  isVisible = false,
  onClose,
  autoHide = true,
  autoHideDelay = 8000
}: PaymentSuccessNotificationProps) {
  const [visible, setVisible] = useState(isVisible);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setVisible(isVisible);
    if (isVisible) {
      setIsAnimating(true);
    }
  }, [isVisible]);

  useEffect(() => {
    if (visible && autoHide) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [visible, autoHide, autoHideDelay]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 300);
  };

  if (!visible) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-300 transform ${
      isAnimating ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-green-200 dark:border-green-800 p-4">
        <div className="flex items-start gap-3">
          {/* Success Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Payment Successful!
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Welcome to Premium! You now have unlimited access to all features.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                asChild
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Link href="/dashboard">
                  Go to Dashboard
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600"
              >
                Dismiss
              </Button>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook to check for successful payment from URL params
export function usePaymentSuccess() {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Check if user was redirected from a successful checkout
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    const sessionId = urlParams.get('session_id');

    if (paymentSuccess === 'true' && sessionId) {
      setShowSuccess(true);

      // Clean up URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('payment_success');
      newUrl.searchParams.delete('session_id');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  const handleClose = () => {
    setShowSuccess(false);
  };

  return {
    showSuccess,
    handleClose
  };
}