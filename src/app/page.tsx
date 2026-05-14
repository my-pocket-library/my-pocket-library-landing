import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col bg-black text-white">
      <Navbar />
      <Hero />
    </main>
  );
}
