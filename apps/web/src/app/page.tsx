'use client'

import {
  SmoothScrollProvider,
  NoiseOverlay,
  ScrollProgress,
  Navbar,
  HeroSection,
  FeaturesSection,
  StatsSection,
  HowItWorksSection,
  TestimonialsSection,
  FAQSection,
  CTASection,
  Footer,
} from '@/components/landing'

export default function RootPage() {
  return (
    <SmoothScrollProvider>
      <NoiseOverlay />
      <ScrollProgress />
      <Navbar />

      <main>
        <HeroSection />
        <FeaturesSection />
        <StatsSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>

      <Footer />
    </SmoothScrollProvider>
  )
}
