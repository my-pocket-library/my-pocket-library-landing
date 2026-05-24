"use client";

import Link from "next/link";
import { type MouseEvent, useState } from "react";
import { usePathname } from "next/navigation";
import { useLenis } from "lenis/react";
import { cn } from "@/lib/utils";

// Same-page anchor links — Lenis (configured with `anchors: true` in
// SmoothScroll) intercepts the click and smoothly scrolls to the section
// matching each `href`. The target ids live on the section elements:
//   #app     → <AppShowcase>
//   #faq     → <FaqSection>
//   #support → <SupportSection>
const navLinks = [
  { label: "App", href: "#app" },
  { label: "FAQ", href: "#faq" },
  { label: "Support", href: "#support" },
];

export function Navbar() {
  // Smart header visibility:
  //   inside the hero (≈ first viewport-height of the page) → always shown
  //   below the hero, scrolling DOWN  → hide
  //   below the hero, scrolling UP    → show
  //
  // useLenis fires on every Lenis frame and gives us the smoothed scroll
  // position + direction (1 = down, -1 = up, 0 = idle). Re-using Lenis
  // here keeps the slide animation in lockstep with the page's smooth-
  // scroll motion rather than fighting raw `window.scroll` events.
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();

  // useLenis returns the Lenis instance even when called with a callback,
  // so this single call gives us BOTH the per-frame scroll subscription
  // (for the hide/show animation below) AND a handle to call scrollTo()
  // from the home-link click handler further down.
  const lenis = useLenis(({ scroll, direction }) => {
    // The hero is `min-h-screen`, so its bottom edge is at ≈ 100vh. Use
    // a small early-trigger margin so the header starts hiding just
    // before the hero is fully off-screen, instead of waiting for the
    // exact boundary.
    const heroEnd = window.innerHeight - 100;

    if (scroll < heroEnd) {
      // Still over the hero — always visible.
      setHidden(false);
    } else if (direction === 1) {
      // Past the hero, scrolling down — slide up out of view.
      setHidden(true);
    } else if (direction === -1) {
      // Past the hero, scrolling up — slide back in.
      setHidden(false);
    }
    // direction === 0 (idle) leaves the current state alone.
  });

  const handleHomeClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // On the home page, clicking the logo would otherwise be a no-op (we
    // already are at `/`). Hijack the click and smooth-scroll to the top
    // through Lenis so the same gesture works for "go home" from any
    // depth in the page. On other routes (`/privacy`, `/terms`) let
    // next/link navigate normally — Next.js scrolls the new page to top
    // on its own, which Lenis then smooths.
    if (pathname === "/") {
      e.preventDefault();
      lenis?.scrollTo(0);
    }
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 transition-transform duration-300 ease-out",
        hidden ? "-translate-y-full" : "translate-y-0",
      )}
    >
      <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6 md:px-10">
        <div className="flex items-center gap-10">
          <Link
            href="/"
            onClick={handleHomeClick}
            className="font-serif text-xl tracking-tight text-black"
          >
            <span className="italic">My</span>{" "}
            <span className="font-medium">Pocket Library</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-black/70 transition-colors hover:text-black"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
