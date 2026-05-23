"use client";

import { Button } from "@/components/ui/button";
import { BookScene } from "@/components/book-scene";
import { Tweakpane } from "@/components/tweakpane";

export function Hero() {
  return (
    <section className="relative isolate min-h-screen overflow-hidden bg-ana-1">
      <RadialPattern />

      <div className="pointer-events-none absolute left-1/2 top-[36%] bottom-0 w-screen -translate-x-1/2">
        <BookScene />
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-ana-1 via-ana-1/60 to-transparent" />
      </div>

      <div className="pointer-events-none relative z-10 mx-auto flex max-w-[1100px] flex-col items-center px-6 pt-44 text-center md:pt-52">
        <h1 className="font-serif text-balance text-5xl font-medium leading-[1.05] tracking-[-0.02em] text-black md:text-7xl">
          Your library. In your pocket.
        </h1>
        <p className="mt-6 max-w-xl text-balance text-base text-black/70 md:text-lg">
          Scan the books on your shelf to build a digital catalog, then track
          what you&rsquo;ve read, what you&rsquo;re reading, and what&rsquo;s
          waiting next.
        </p>

        <div className="pointer-events-auto mt-8 flex items-center gap-3">
          <Button
            size="lg"
            className="group h-12 rounded-full bg-black px-6 text-[15px] font-medium text-ana-1 shadow-[0_2px_30px_-2px_rgba(0,0,0,0.25)] hover:bg-black/90"
          >
            <span className="mr-2 inline-block size-1.5 rounded-full bg-ana-1" />
            Get the app
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="h-12 rounded-full px-6 text-[15px] text-black hover:bg-black/5 hover:text-black"
          >
            See how it works
          </Button>
        </div>
      </div>

      <Tweakpane />
    </section>
  );
}

function RadialPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[42%] -z-0 -translate-x-1/2 -translate-y-1/2"
    >
      <svg
        width="1800"
        height="1800"
        viewBox="0 0 1800 1800"
        fill="none"
        className="opacity-[0.14]"
      >
        <defs>
          <radialGradient id="ring-fade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.5" />
            <stop offset="70%" stopColor="white" stopOpacity="0.1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="ring-mask">
            <rect width="100%" height="100%" fill="url(#ring-fade)" />
          </mask>
        </defs>
        <g
          mask="url(#ring-mask)"
          stroke="black"
          strokeWidth="1"
          fill="none"
          opacity="0.7"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <circle
              key={i}
              cx="900"
              cy="900"
              r={120 + i * 70}
              strokeDasharray={i % 3 === 0 ? "0" : "2 6"}
            />
          ))}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const x1 = (900 + Math.cos(a) * 60).toFixed(2);
            const y1 = (900 + Math.sin(a) * 60).toFixed(2);
            const x2 = (900 + Math.cos(a) * 880).toFixed(2);
            const y2 = (900 + Math.sin(a) * 880).toFixed(2);
            return (
              <line
                key={`s-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                opacity="0.25"
              />
            );
          })}
          {Array.from({ length: 40 }).map((_, i) => {
            const a = (i / 40) * Math.PI * 2;
            const r = 200 + (i % 7) * 90;
            const x = (900 + Math.cos(a) * r).toFixed(2);
            const y = (900 + Math.sin(a) * r).toFixed(2);
            return <circle key={`d-${i}`} cx={x} cy={y} r="2" fill="black" />;
          })}
        </g>
      </svg>
    </div>
  );
}
