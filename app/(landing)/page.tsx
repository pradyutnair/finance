import { LandingHeader } from '@/components/landing-page/landing-header';
import { HeroSection } from '@/components/landing-page/hero-section';
import { FeaturesSection } from '@/components/landing-page/features-section';
import { TestimonialsCarousel } from '@/components/landing-page/testimonials-carousel';
import { PricingSection } from '@/components/landing-page/pricing-section';
import { Footer } from '@/components/landing-page/footer';

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* Global hero background spanning header + hero */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: 'url(/login-placeholder.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          filter: 'blur(8px)'
        }}
      />
      <LandingHeader />
      <div className="relative z-10 pt-10"> {/* Spacing for fixed header */}
        <HeroSection />
        <div id="features">
          <FeaturesSection />
        </div>
        <TestimonialsCarousel />
        <div id="pricing">
          <PricingSection />
        </div>
        <Footer />
      </div>
    </div>
  );
}
