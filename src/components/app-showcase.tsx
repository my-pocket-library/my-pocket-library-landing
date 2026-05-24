"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Core from "smooothy";
import { cn } from "@/lib/utils";

const SCREENS = [
  {
    src: "/images/pckt1.png",
    alt: "Pocket Library — your shelf, scanned and organised at a glance.",
  },
  {
    src: "/images/pkt2.png",
    alt: "Book details — status, reading progress, and notes for every title.",
  },
  {
    src: "/images/pkt3.png",
    alt: "Library overview — search and sort across your entire collection.",
  },
];

export function AppShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<Core | null>(null);
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

  // Smooothy drives drag/snap/momentum. Items are the host's direct children;
  // smooothy mutates `transform` on each one. Our reveal animation lives on
  // an INNER wrapper (one level deeper) so its transition-on-transform
  // doesn't fight smooothy's per-frame transform writes.
  useEffect(() => {
    if (!hostRef.current) return;
    const inst = new Core(hostRef.current, {
      infinite: false,
      snap: true,
      lerpFactor: 0.22,
      dragSensitivity: 0.012,
      speedDecay: 0.9,
      scrollInput: false,
    });
    sliderRef.current = inst;
    let raf = 0;
    const tick = () => {
      inst.update();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      inst.destroy();
      sliderRef.current = null;
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden bg-ana-1 py-24 md:py-32"
    >
      <div className="mx-auto max-w-[1100px] px-6 text-center">
        <span className="inline-block rounded-full border border-black/10 bg-white/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-black/70 backdrop-blur">
          On your phone
        </span>
        <h2 className="mt-5 font-serif text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-black md:text-5xl">
          Built for browsing.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-balance text-base text-black/70 md:text-lg">
          A library that fits in your pocket — scan, sort your shelves, and
          rediscover what&rsquo;s waiting.
        </p>
      </div>

      <div
        ref={hostRef}
        aria-label="App screenshots"
        className="relative mt-12 flex cursor-grab select-none touch-pan-y overflow-hidden active:cursor-grabbing md:mt-16"
        // Centre-align: pad each side by half the (viewport − item-width)
        // so item 0 starts in the middle of the viewport. Smooothy snaps
        // by translating all items by `current × itemWidth`, so the same
        // padding keeps every snapped slide centred — at slide 1 the
        // second item lands at the centre, at slide 2 the third, etc.
        // 130px = half the desktop item width (260), 36vw = half the
        // mobile item width (72vw).
        style={{
          paddingLeft: "calc(50% - min(130px, 36vw))",
          paddingRight: "calc(50% - min(130px, 36vw))",
        }}
      >
        {SCREENS.map((screen, i) => (
          <div
            key={i}
            className="flex-shrink-0 pr-5 md:pr-7"
            style={{ width: "min(260px, 72vw)" }}
          >
            <div
              className={cn(
                "relative aspect-[1242/2688] overflow-hidden rounded-[34px] border border-black/10 bg-white",
                "shadow-[0_30px_80px_-30px_rgba(0,0,0,0.4)]",
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
