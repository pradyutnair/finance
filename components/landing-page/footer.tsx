'use client';

import Link from 'next/link';
import { Twitter, Github, Linkedin } from 'lucide-react';

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Security', href: '/privacy' }
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/gdpr' },
    { label: 'GDPR', href: '/gdpr' }
  ]
};

export function Footer() {
  return (
    <footer className="bg-white dark:bg-black border-t border-gray-200 dark:border-[#40221a]/30">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 md:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-2">
            <Link href="/" className="inline-flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: '#40221a' }}>
                N
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Nexpass
              </span>
            </Link>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 max-w-sm">
              Personal finance management for the modern age. Secure, private, and built for you.
            </p>

            {/* Social Links */}
            <div className="flex space-x-3 sm:space-x-4">
              <a
                href="#"
                className="text-gray-400 transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.color = '#40221a'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="text-gray-400 transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.color = '#40221a'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="text-gray-400 transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.color = '#40221a'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">
              Product
            </h4>
            <ul className="space-y-2 sm:space-y-3">
              {footerLinks.product.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">
              Legal
            </h4>
            <ul className="space-y-2 sm:space-y-3">
              {footerLinks.legal.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-gray-200 dark:border-[#40221a]/30">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
              © {new Date().getFullYear()} Nexpass. All rights reserved.
            </p>

            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <span>Made with</span>
              <span style={{ color: '#40221a' }}>❤️</span>
              <span>in Europe</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}