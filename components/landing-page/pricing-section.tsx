'use client';

import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import Link from 'next/link';

const features = [
  "Unlimited bank connections",
  "Real-time insights and analytics",
  "Advanced budget tracking",
  "AI-powered categorization",
  "End-to-end encryption",
  "Export financial reports",
  "Email support",
  "GDPR compliant"
];

export function PricingSection() {
  return (
    <section className="py-24 sm:py-32 px-4 bg-white dark:bg-black">
      <style jsx>{`
        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .gradient-button {
          background: linear-gradient(
            90deg,
            #40221a 0%,
            #5c3128 25%,
            #40221a 50%,
            #5c3128 75%,
            #40221a 100%
          );
          background-size: 200% 100%;
          animation: gradient-shift 3s ease infinite;
        }
        .gradient-button:hover {
          animation: gradient-shift 1.5s ease infinite;
        }
      `}</style>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-4">
            One plan with everything you need. No hidden fees, cancel anytime.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Pricing Card */}
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden">
            {/* Border effect */}
            <div className="absolute inset-0" style={{ backgroundColor: '#40221a' }} />
            
            {/* Inner card */}
            <div className="relative m-[2px] rounded-2xl sm:rounded-3xl bg-white dark:bg-black p-6 sm:p-8 lg:p-12">
              <div className="text-center mb-8 sm:mb-10">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Premium
                </h3>
                
                {/* Price */}
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white">
                    €6.99
                  </span>
                  <span className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 font-medium">
                    /month
                  </span>
                </div>
                
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                  Billed monthly, cancel anytime
                </p>
              </div>

              {/* CTA Button */}
            <div className="mb-10">
              <Button
                asChild
                size="lg"
                className="w-full text-white font-medium py-6 text-base rounded-full border-0 gradient-button"
              >
                <Link href="/login">
                  Get Started
                </Link>
              </Button>
            </div>


              {/* Features List */}
              <div className="space-y-3 sm:space-y-4">
                <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4 sm:mb-6">
                  What's included
                </p>
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#40221a20' }}>
                      <Check className="w-3 h-3" style={{ color: '#40221a' }} strokeWidth={3} />
                    </div>
                    <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}