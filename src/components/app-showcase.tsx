"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SCREENS = [
  {
    src: "/images/pckt1.png",
    alt: "Pocket Library welcome screen with a reading illustration and quote.",
  },
  {
    src: "/images/pkt2.png",
    alt: "Your library — book covers, reading filters, and collection search.",
  },
  {
    src: "/images/pkt3.png",
    alt: "Book details — reading status, progress, and profile visibility.",
  },
];

export function AppShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  // Fire the blur+opacity reveal once the section first crosses into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="app"
      className="relative isolate overflow-hidden bg-ana-1 py-24 md:py-32"
    >
      <div className="mx-auto max-w-[1100px] px-6 text-center">
        <Image src="/brand/first-book.svg" alt="" width={144} height={144} className="mx-auto mb-2" />
        <span className="inline-block rounded-full border border-ink/10 bg-white/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-ink/70 backdrop-blur">
          On your phone
        </span>
        <h2 className="mt-5 font-serif text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-5xl">
          Built for browsing.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-balance text-base text-ink/70 md:text-lg">
          A library that fits in your pocket — scan, sort your shelves, and
          rediscover what&rsquo;s waiting.
        </p>
      </div>

      <div
        aria-label="App screenshots"
        tabIndex={0}
        role="region"
        className="relative mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-4 md:mt-16 lg:justify-center lg:gap-7 lg:!px-6"
        style={{
          paddingLeft: "calc(50% - min(130px, 36vw))",
          paddingRight: "calc(50% - min(130px, 36vw))",
        }}
      >
        {SCREENS.map((screen, i) => (
          <div
            key={i}
            className="shrink-0 snap-center"
            style={{ width: "min(260px, 72vw)" }}
          >
            <div
              className={cn(
                "relative aspect-[1242/2688] overflow-hidden rounded-[34px] border border-ink/10 bg-white",
                "will-change-[transform,opacity,filter]",
                "transition-[opacity,filter,transform] duration-[1100ms] ease-out",
                revealed
                  ? "translate-y-0 opacity-100 blur-0"
                  : "translate-y-8 opacity-0 blur-md",
              )}
              style={{ transitionDelay: revealed ? `${i * 140}ms` : "0ms" }}
            >
              <Image
                src={screen.src}
                alt={screen.alt}
                fill
                sizes="(min-width: 768px) 260px, 72vw"
                className="object-cover"
                draggable={false}
                priority={i === 0}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Soft edge fades so items slide in/out of the section gracefully. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-ana-1 to-transparent md:w-16"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-ana-1 to-transparent md:w-16"
      />
    </section>
  );
}
