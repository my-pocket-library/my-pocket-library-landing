import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { AppShowcase } from "@/components/app-showcase";
import { FaqSection } from "@/components/faq-section";
import { SupportSection } from "@/components/support-section";
import { Footer } from "@/components/footer";
import { OPEN_GRAPH_BASE, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function Home() {
  return (
    <>
      <Navbar />
      <main
        id="main"
        className="relative flex min-h-screen flex-col bg-ana-1 text-ink"
      >
        <Hero />
        <AppShowcase />
        <FaqSection />
        <SupportSection />
      </main>
      <Footer />
    </>
  );
}
