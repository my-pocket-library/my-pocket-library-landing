"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

// three.js + R3F are ~240 KB gzipped. Loading the scene as its own chunk
// keeps it out of the initial bundle, so the page is interactive first.
const BookScene = dynamic(
  () => import("@/components/book-scene").then((m) => m.BookScene),
  { ssr: false },
);

// three.js needs WebGL 2. Checked once, on the client; the probe context is
// released straight away so it doesn't count against the browser's limit.
let webgl2: boolean | undefined;
function supportsWebGL2() {
  if (webgl2 === undefined) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      webgl2 = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}
const noSubscription = () => () => {};

/** Renders nothing if the scene throws — a failed chunk download, a
 *  runtime error — so the poster underneath stays up instead of the whole
 *  page falling over to the error screen. */
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The hero's 3D book carousel, fronted by a still of its opening frame.
 *
 * The poster (public/hero/scene-*.webp) is in the server HTML, so the space
 * is filled from first paint; the live scene crossfades over it once it has
 * drawn. It is a render of the scene's first frame at the box's height —
 * the camera's vertical FOV is fixed, so at a given height the scene draws
 * identically around the centre at any width — shown centred and unscaled,
 * which lines it up with the live canvas. Visitors who prefer reduced
 * motion, or whose browser has no WebGL 2, keep the poster: the scene would
 * only ever show that frame to them anyway.
 *
 * Re-render the posters when the scene's look or framing changes (see
 * README).
 */
export function HeroScene() {
  const reducedMotion = useReducedMotion();
  const hasWebGL2 = useSyncExternalStore(
    noSubscription,
    supportsWebGL2,
    () => false,
  );
  const [live, setLive] = useState(false);

  return (
    <div className="pointer-events-none relative order-2 h-[360px] w-full shrink-0 overflow-hidden md:h-[460px] lg:h-[520px]">
      <picture>
        <source
          media="(min-width: 1024px)"
          srcSet="/hero/scene-lg.webp 2x"
          width={1600}
          height={520}
        />
        <source
          media="(min-width: 768px)"
          srcSet="/hero/scene-md.webp 2x"
          width={1023}
          height={460}
        />
        {/* Plain <img>: the posters are pre-encoded at 2x, and must render
         *  at exactly their CSS size (centred, never scaled) to line up with
         *  the canvas — next/image's responsive sizing works against that. */}
        <img
          src="/hero/scene-sm.webp"
          srcSet="/hero/scene-sm.webp 2x"
          alt=""
          width={767}
          height={360}
          fetchPriority="high"
          draggable={false}
          className={cn(
            "absolute left-1/2 top-0 h-[360px] w-[767px] max-w-none -translate-x-1/2 select-none md:h-[460px] md:w-[1023px] lg:h-[520px] lg:w-[1600px]",
            // The scene fades in over the poster (both show the same frame),
            // then the poster steps out — fading both at once would dip.
            // It comes back instantly if the scene goes away.
            live
              ? "opacity-0 transition-opacity delay-700 duration-150"
              : "opacity-100",
          )}
        />
      </picture>

      {hasWebGL2 && !reducedMotion && (
        <SceneBoundary onError={() => setLive(false)}>
          <BookScene onLiveChange={setLive} />
        </SceneBoundary>
      )}
    </div>
  );
}
