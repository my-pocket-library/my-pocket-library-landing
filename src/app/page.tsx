import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { AppShowcase } from "@/components/app-showcase";
import { FaqSection } from "@/components/faq-section";
import { SupportSection } from "@/components/support-section";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col bg-ana-1 text-ink">
      <Navbar />
      <Hero />
      <AppShowcase />
      <FaqSection />
      <SupportSection />
      <Footer />
    </main>
  );
}
