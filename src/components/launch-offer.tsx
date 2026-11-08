"use client";

import { useSyncExternalStore } from "react";
import { LAUNCH_OFFER } from "@/lib/site";

/** Launch-week pill above the hero headline. Pages are static, so the
 *  expiry is checked in the browser rather than at build time. */
// The date never needs to notify; it is read once per render.
const subscribe = () => () => {};

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
      className="group mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-coral/25 bg-white/70 py-1.5 pl-1.5 pr-4 text-left text-sm text-ink backdrop-blur transition-colors hover:border-coral/50 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 md:mb-8"
    >
      <span className="shrink-0 rounded-full bg-coral px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
        Launch week
      </span>
      <span className="min-w-0">
        30% off a year of Pro with{" "}
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
