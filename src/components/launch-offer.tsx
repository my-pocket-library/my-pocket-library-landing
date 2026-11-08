"use client";

import { useSyncExternalStore } from "react";
import { LAUNCH_OFFER } from "@/lib/site";

// The date never needs to notify; it is read once per render.
const subscribe = () => () => {};

/** Launch-week pill above the hero headline. Pages are static, so the
 *  expiry is checked in the browser rather than at build time. */
export function LaunchOffer() {
  const live = useSyncExternalStore(
    subscribe,
    () => Date.now() < LAUNCH_OFFER.endsAt,
    () => true,
  );

  if (!live) return null;

  return (
    <a
      href={LAUNCH_OFFER.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Launch week: 30% off a year of Pro with code ${LAUNCH_OFFER.code}`}
      className="group mb-5 inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full border border-coral/25 bg-white/70 py-1 pl-1 pr-3.5 text-[13px] text-ink backdrop-blur transition-colors hover:border-coral/50 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 sm:py-1.5 sm:pl-1.5 sm:pr-4 sm:text-sm md:mb-8"
    >
      <span className="shrink-0 rounded-full bg-coral px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white sm:text-xs">
        <span className="sm:hidden">30% off</span>
        <span className="hidden sm:inline">Launch week</span>
      </span>
      <span>
        <span className="sm:hidden">Launch week &middot; </span>
        <span className="hidden sm:inline">30% off a year of Pro with </span>
        <span className="font-mono font-semibold tracking-wide">
          {LAUNCH_OFFER.code}
        </span>
        <span className="hidden sm:inline"> &middot; first 1,000 readers</span>
      </span>
      <span
        aria-hidden
        className="shrink-0 text-coral transition-transform group-hover:translate-x-0.5"
      >
        &rarr;
      </span>
    </a>
  );
}
