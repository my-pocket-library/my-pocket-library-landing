"use client";

import { AppStoreBadge } from "@/components/app-store-badge";
import { BookScene } from "@/components/book-scene";
import { Tweakpane } from "@/components/tweakpane";

export function Hero() {
  return (
    <section className="relative isolate flex min-h-svh flex-col overflow-hidden bg-ana-1">
      <RadialPattern />

      <div className="pointer-events-none relative order-2 h-[360px] w-full shrink-0 md:h-[460px] lg:h-[520px]">
        <BookScene />
      </div>

      <div className="pointer-events-none relative z-10 mx-auto flex max-w-[1100px] flex-col items-center w-full px-6 pt-36 text-center">
        <h1 className="font-serif text-balance text-[clamp(2.5rem,10vw,3rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-7xl">
          Your library. <span className="italic">In your pocket.</span>
        </h1>
        <p className="mt-6 max-w-xl text-balance text-base text-ink/70 md:text-lg">
          Scan the books on your shelf to build a digital catalog, then track
          what you&rsquo;ve read, what you&rsquo;re reading, and what&rsquo;s
          waiting next.
        </p>

        <div className="pointer-events-auto mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <AppStoreBadge />
          <a
            href="#app"
            className="inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] text-ink hover:bg-black/5 hover:text-ink"
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
