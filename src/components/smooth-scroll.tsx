"use client";

import { ReactLenis } from "lenis/react";

/**
 * Thin client wrapper around Lenis. Mounted once at the root of the app so
 * every page inherits smooth wheel + touch scrolling without each route
 * needing to opt in. `root` makes Lenis attach to the document body, which
 * is what we want for full-page smoothing (rather than a single container).
 *
 * Default options are fine for the hero (slow-ish exponential ease that
 * feels good with the auto-rotating carousel); tune via the options prop
 * if a section ever needs faster snap.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  // `anchors: true` makes Lenis intercept clicks on <a href="#id"> and
  // smoothly scroll to the target instead of letting the browser instant-
  // jump. Required for the navbar's "App / FAQ / Support" anchor links to
  // feel consistent with the rest of the page's smoothed scrolling.
  return <ReactLenis root options={{ anchors: true }}>{children}</ReactLenis>;
}
