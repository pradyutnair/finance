'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Product Designer",
    content: "The interface is beautifully simple. Finally, a finance app that doesn't feel like work.",
    rating: 5
  },
  {
    name: "Michael Rodriguez",
    role: "Software Engineer",
    content: "Bank integration just works. The encryption gives me peace of mind about my data.",
    rating: 5
  },
  {
    name: "Emily Thompson",
    role: "Freelancer",
    content: "Budget tracking has helped me save 20% more each month. Game-changer.",
    rating: 5
  }
];

export function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-16 sm:py-24 lg:py-32 px-4 bg-gray-50 dark:bg-black relative overflow-hidden">
      {/* Chocolate blur background for dark mode */}
      <div className="absolute inset-0 dark:block hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#40221a] rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/4 right-0 w-80 h-80 bg-[#5a3028] rounded-full filter blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-[#40221a] rounded-full filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '4s' }}></div>
        <div className="absolute top-1/2 left-1/4 w-72 h-72 bg-[#6B4423] rounded-full filter blur-3xl opacity-12 animate-pulse" style={{ animationDelay: '6s' }}></div>
        <div className="absolute bottom-1/4 right-1/3 w-88 h-88 bg-[#5C4033] rounded-full filter blur-3xl opacity-18 animate-pulse" style={{ animationDelay: '8s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Trusted by users across Europe
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-4">
            Join thousands who have taken control of their finances.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative group"
            >
              <div className="relative rounded-xl sm:rounded-2xl bg-white dark:bg-[#40221a]/10 border border-gray-200 dark:border-[#40221a]/30 p-6 sm:p-8 h-full hover:border-[#40221a]/50 transition-all duration-300">
                {/* Rating Stars */}
                <div className="flex gap-1 mb-4 sm:mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4"
                      style={{ fill: '#40221a', color: '#40221a' }}
                    />
                  ))}
                </div>

                {/* Testimonial Content */}
                <blockquote className="text-gray-700 dark:text-gray-300 mb-6 sm:mb-8 leading-relaxed text-base sm:text-lg">
                  "{testimonial.content}"
                </blockquote>

                {/* Author Info */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ backgroundColor: '#40221a' }}>
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                      {testimonial.name}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust indicators
        <div className="mt-12 sm:mt-16 lg:mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">10K+</div>
            <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Active Users</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">€2M+</div>
            <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Managed</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">99.9%</div>
            <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Uptime</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">4.9/5</div>
            <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400">User Rating</div>
          </div>
        </div> */}
      </div>
    </section>
  );
}