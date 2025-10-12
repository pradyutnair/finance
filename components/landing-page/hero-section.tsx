'use client';

import { ContainerScroll } from '@/components/ui/container-scroll-animation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function HeroSection() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const DashboardMockup = () => (
    <div className="mx-auto bg-white dark:bg-black h-[30rem] w-full max-w-[25rem] rounded-xl border border-neutral-200 dark:border-[#40221a] p-4 shadow-2xl">
      {/* Dashboard Mockup */}
      <div className="flex flex-col h-full space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="w-8 h-8 bg-gray-200 dark:bg-[#40221a]/30 rounded-full animate-pulse"></div>
          <div className="flex space-x-2">
            <div className="w-6 h-6 bg-gray-200 dark:bg-[#40221a]/30 rounded-full animate-pulse"></div>
            <div className="w-6 h-6 bg-gray-200 dark:bg-[#40221a]/30 rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Balance Card */}
        <div
          className="rounded-xl p-5 text-white shadow-lg"
          style={{ 
            backgroundColor: '#40221a',
            background: 'linear-gradient(135deg, #40221a 0%, #5a3028 100%)'
          }}
        >
          <div className="text-sm opacity-90 font-medium">Total Balance</div>
          <div className="text-3xl font-bold mt-1">€12,458.00</div>
          <div className="text-xs mt-3 opacity-80 flex items-center">
            <span className="text-green-300">↑ 12.5%</span>
            <span className="ml-1">from last month</span>
          </div>
        </div>

        {/* Mini Charts */}
        <div className="flex space-x-4">
          <div className="flex-1 bg-gray-50 dark:bg-[#40221a]/10 rounded-xl p-4 border border-gray-100 dark:border-[#40221a]/30">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">Spending</div>
            <div className="w-full h-14 bg-gradient-to-r from-red-200 to-orange-200 dark:from-[#40221a] dark:to-[#5a3028] rounded-lg"></div>
          </div>
          <div className="flex-1 bg-gray-50 dark:bg-[#40221a]/10 rounded-xl p-4 border border-gray-100 dark:border-[#40221a]/30">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">Income</div>
            <div className="w-full h-14 bg-gradient-to-r from-green-200 to-emerald-200 dark:from-[#5a3028] dark:to-[#40221a] rounded-lg"></div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="flex-1 bg-gray-50 dark:bg-[#40221a]/10 rounded-xl p-4 border border-gray-100 dark:border-[#40221a]/30">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3">Recent Transactions</div>
          <div className="space-y-3">
            {[
              { name: 'Coffee Shop', amount: '-€4.50', color: 'bg-orange-400' },
              { name: 'Salary', amount: '+€2,850.00', color: 'bg-green-400' },
              { name: 'Groceries', amount: '-€67.30', color: 'bg-blue-400' },
            ].map((transaction, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 ${transaction.color} rounded-full opacity-80`}></div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{transaction.name}</div>
                </div>
                <div className={`text-xs font-semibold ${transaction.amount.startsWith('+') ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {transaction.amount}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Mobile view - no scroll animation
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-transparent relative">
        {/* Content overlay */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12 space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-bold text-black dark:text-white tracking-tight">
              Your Finance,
            </h1>
            <div className="text-6xl font-bold text-black dark:text-white leading-tight tracking-tight">
              Simplified
            </div>
          </div>

          {/* Dashboard mockup for mobile */}
          <div className="w-full max-w-sm transform scale-95">
            <DashboardMockup />
          </div>

          {/* CTA section for mobile */}
          <div className="space-y-4 text-center px-4">
            <div className="flex flex-col gap-3">
              <Button
                asChild
                size="lg"
                className="text-white font-semibold w-full"
                style={{ backgroundColor: '#40221a' }}
              >
                <Link href="/login">
                  Get Started
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-[#40221a] dark:border-[#40221a] text-[#40221a] dark:text-white hover:bg-[#40221a]/10 dark:hover:bg-[#40221a]/20 w-full gradient-button"
              >
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop view - with scroll animation
  return (
    <div className="flex flex-col overflow-hidden bg-transparent relative min-h-screen" data-hero-section>
      {/* Content overlay */}
      <div className="relative z-10 flex flex-col pt-2">
        <ContainerScroll
          titleComponent={
            <div className="flex flex-col items-center justify-center pt-2 pb-4">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white dark:text-white text-center tracking-tight">
                Your Finances,
              </h1>
              <div
                className="text-6xl md:text-7xl lg:text-8xl font-bold mt-1 text-center leading-tight tracking-tight"
                style={{
                  background: 'linear-gradient(90deg, #000000, #40221a, #ffffff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  color: 'transparent',
                  WebkitTextStroke: '1px white', // adds white border
                }}
              >
                Simplified
              </div>

            </div>
          }
        >
          <DashboardMockup />
        </ContainerScroll>

        {/* CTA Section - now with background overlay */}
        <div className="flex flex-col items-center text-center space-y-6 px-4 py-16 -mt-32 relative">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              asChild
              size="lg"
              className="text-white font-semibold px-8"
              style={{ backgroundColor: '#40221a' }}
            >
              <Link href="/login">
                Get Started
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-[#40221a] dark:border-[#40221a] text-[#40221a] dark:text-white hover:bg-[#40221a]/10 dark:hover:bg-[#40221a]/20 px-8"
            >
              View Demo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}