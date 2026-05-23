"use client";

import type { BookCover } from "./book";

type Props = {
  cover: BookCover;
};

/**
 * Placeholder iPhone rectangle that hovers in front of the 3D carousel.
 * Shows a simplified Pocket Library UI with the carousel's currently-
 * centered book on the screen.
 */
export function IPhoneMock({ cover }: Props) {
  return (
    <div
      className="relative w-[clamp(220px,26vw,320px)] aspect-[1242/2688] rounded-[42px] bg-black p-[6px] shadow-[0_30px_80px_-25px_rgba(0,0,0,0.55)]"
      aria-hidden
    >
      {/* Screen */}
      <div className="absolute inset-[6px] overflow-hidden rounded-[36px] bg-ana-1">
        {/* Dynamic island */}
        <div className="absolute left-1/2 top-2 z-10 h-[22px] w-[80px] -translate-x-1/2 rounded-full bg-black" />

        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-[14px] text-[10px] font-semibold text-black">
          <span>9:41</span>
          <div className="flex items-center gap-1 opacity-70">
            <span>•••</span>
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>

        {/* App content */}
        <div className="mt-7 px-5">
          <div className="text-[13px] font-semibold text-black">My Library</div>

          {/* Tab pills */}
          <div className="mt-3 flex gap-[6px]">
            <span className="rounded-full bg-black px-[10px] py-[3px] text-[9px] font-medium text-ana-1">
              Reading
            </span>
            <span className="rounded-full border border-black/10 bg-white px-[10px] py-[3px] text-[9px] font-medium text-black/65">
              Read
            </span>
            <span className="rounded-full border border-black/10 bg-white px-[10px] py-[3px] text-[9px] font-medium text-black/65">
              Want to read
            </span>
          </div>

          {/* Cover preview — re-keyed by title so it cross-fades when the
              centered book changes. */}
          <div className="mt-5 flex justify-center">
            <div
              key={cover.title}
              className="relative w-[58%] overflow-hidden rounded-[6px] aspect-[1/1.5] animate-in fade-in duration-500"
              style={{
                background: cover.baseColor,
                color: cover.ink,
                boxShadow:
                  "0 12px 24px -8px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.15)",
              }}
            >
              {/* Decorative inner border like the 3D cover. */}
              <div
                className="absolute inset-[5%] rounded-[3px] border"
                style={{ borderColor: cover.accent, opacity: 0.55 }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
                <div
                  className="font-serif text-[10px] font-bold uppercase leading-[1.1] tracking-[0.04em]"
                  style={{ color: cover.ink }}
                >
                  {cover.title}
                </div>
                {cover.author ? (
                  <div
                    className="mt-2 text-[7px] italic opacity-80"
                    style={{ color: cover.ink }}
                  >
                    {cover.author}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Meta card */}
          <div
            key={`${cover.title}-meta`}
            className="mt-4 rounded-xl border border-black/[0.06] bg-white p-3 shadow-[0_4px_14px_-8px_rgba(0,0,0,0.18)] animate-in fade-in slide-in-from-bottom-1 duration-500"
          >
            <div className="text-[11px] font-semibold text-black leading-tight">
              {cover.title}
            </div>
            {cover.author ? (
              <div className="mt-[2px] text-[9px] text-black/60">
                {cover.author}
              </div>
            ) : null}
            <div className="mt-2 flex items-center gap-[5px] text-[9px] font-medium text-emerald-700">
              <span className="grid size-3 place-items-center rounded-full bg-emerald-700 text-[7px] text-white">
                ✓
              </span>
              Saved
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
