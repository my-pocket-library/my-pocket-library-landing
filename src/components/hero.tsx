"use client";

import dynamic from "next/dynamic";
import { AppStoreBadge } from "@/components/app-store-badge";
import { HeroScene } from "@/components/hero-scene";

// Dev-only live controls for the scene; never part of a production build.
const Tweakpane = dynamic(
  () => import("@/components/tweakpane").then((m) => m.Tweakpane),
  { ssr: false },
);

export function Hero() {
  return (
    <section className="relative isolate flex min-h-svh flex-col overflow-hidden bg-ana-1">
      <RadialPattern />

      <HeroScene />

      <div className="relative z-10 mx-auto flex w-full max-w-[1100px] flex-col items-center px-6 pt-28 text-center md:pt-36">
        <h1 className="font-serif text-balance text-[clamp(2.5rem,10vw,3rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-7xl">
          Your library. <span className="italic">In your pocket.</span>
        </h1>
        <p className="mt-6 max-w-xl text-balance text-base text-ink/70 md:text-lg">
          Scan the books on your shelf to build a digital catalog, then track
          what you&rsquo;ve read, what you&rsquo;re reading, and what&rsquo;s
          waiting next.
        </p>

        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:items-start">
          <AppStoreBadge />
          <a
            href="#app"
            className="inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] text-ink transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          >
            See how it works
          </a>
        </div>
      </div>

      {process.env.NODE_ENV === "development" && <Tweakpane />}
    </section>
  );
}

function RadialPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 bg-[url('/brand/pattern.svg')] [mask-image:linear-gradient(black,transparent_75%)]"
    />
  );
}
