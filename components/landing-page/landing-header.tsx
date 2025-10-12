'use client';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function LandingHeader() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const [isNearHero, setIsNearHero] = useState(true);

  useEffect(() => {
    if (!isHomePage) return;

    const handleScroll = () => {
      const heroSection = document.querySelector('[data-hero-section]');
      if (!heroSection) return;

      const heroRect = heroSection.getBoundingClientRect();
      const heroBottom = heroRect.bottom;
      
      // Consider "near hero" when within 200px of hero section
      setIsNearHero(heroBottom > -200);
    };

    // Check initial position
    handleScroll();
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHomePage]);

  // Don't show header on dashboard pages
  if (!isHomePage) {
    return null;
  }

  return (
    <header 
      className={`fixed rounded-xl top-0 w-full z-50 backdrop-blur-xl transition-all duration-300 glass-effect${
        isNearHero 
          ? 'bg-[#26161a]  dark:border-[#40221a]/30' 
          : 'bg-white/70 dark:bg-gray-950/70  dark:border-gray-800/50'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity group-hover:opacity-80" style={{ backgroundColor: '#40221a' }}>
              <img
                src="/android-chrome-512x512.png"
                alt="Nexpass Logo"
                className="w-7 h-7 rounded"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <span className={`text-xl font-bold transition-colors duration-300 ${
              isNearHero 
                ? 'text-white dark:text-white' 
                : 'text-gray-900 dark:text-white'
            }`}>
              Nexpass
            </span>
          </Link>

          {/* Navigation Links - Centered */}
          <nav className="hidden md:flex items-center space-x-8 absolute left-1/2 transform -translate-x-1/2">
            <a
              href="#features"
              className={`text-sm font-medium transition-colors duration-300 ${
                isNearHero 
                  ? 'text-white/80 dark:text-gray-300 hover:text-white dark:hover:text-white' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Features
            </a>
            <a
              href="#pricing"
              className={`text-sm font-medium transition-colors duration-300 ${
                isNearHero 
                  ? 'text-white/80 dark:text-gray-300 hover:text-white dark:hover:text-white' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Pricing
            </a>
            <Link
              href="/privacy"
              className={`text-sm font-medium transition-colors duration-300 ${
                isNearHero 
                  ? 'text-white/80 dark:text-gray-300 hover:text-white dark:hover:text-white' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Security
            </Link>
          </nav>

          {/* Right side buttons */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/login" className="hidden sm:block">
              <Button
                variant="ghost"
                className={`transition-colors duration-300 ${
                  isNearHero 
                    ? 'text-white/80 dark:text-gray-300 hover:text-white dark:hover:text-white' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </Button>
            </Link>

            <Button
              asChild
              className="text-white font-medium rounded-full text-sm sm:text-base px-4 sm:px-6 gradient-button"
              style={{ backgroundColor: '#40221a' }}
            >
              <Link href="/login">
                Get Started
              </Link>
            </Button>

            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}