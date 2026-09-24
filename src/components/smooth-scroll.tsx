"use client";

import { useEffect, useRef } from "react";
import { ReactLenis, type LenisRef } from "lenis/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Thin client wrapper around Lenis. Mounted once at the root of the app so
 * every page inherits smooth wheel + touch scrolling without each route
 * needing to opt in. `root` makes Lenis attach to the document body, which
 * is what we want for full-page smoothing (rather than a single container).
 *
 * Also runs a manual ResizeObserver on `document.body` and calls
 * `lenis.resize()` on every size change. Lenis's built-in autoResize
 * watches its wrapper element, but doesn't reliably pick up dynamic
 * content-driven height changes (e.g. an accordion panel animating from
 * 0 to its natural height) — which leaves `maxScroll` stale and makes the
 * new bottom of the page unreachable. Observing the body directly fixes
 * that for any future dynamic content, not just the FAQ accordion.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      lenisRef.current?.lenis?.resize();
    });
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  // `anchors` makes Lenis intercept clicks on <a href="#id"> so the navbar's
  // "App / FAQ / Support" links scroll consistently with the rest of the
  // page. With reduced motion, wheel scrolling stays native and anchor
  // links jump instead of gliding; Lenis still reports scroll position,
  // which the navbar's hide/show logic reads.
  return (
    <ReactLenis
      ref={lenisRef}
      root
      options={
        reducedMotion
          ? { smoothWheel: false, anchors: { immediate: true } }
          : { anchors: true }
      }
    >
      {children}
    </ReactLenis>
  );
}
