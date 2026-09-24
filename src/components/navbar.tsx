"use client";

import Image from "next/image";
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
// "App" is dropped below `sm` so the bar fits on one row on phones — the
// hero's "See how it works" button already goes to #app.
const navLinks = [
  { label: "App", href: "#app", className: "hidden sm:inline-flex" },
  { label: "FAQ", href: "#faq", className: "inline-flex" },
  { label: "Support", href: "#support", className: "inline-flex" },
];

export function Navbar() {
  // Smart header visibility:
  //   inside the hero (≈ first viewport-height of the page) → always shown
  //   below the hero, scrolling DOWN  → hide
  //   below the hero, scrolling UP    → show
  // Once the page has scrolled at all, the bar gets a translucent backdrop
  // so it stays legible over whatever content slides beneath it.
  //
  // useLenis fires on every Lenis frame and gives us the smoothed scroll
  // position + direction (1 = down, -1 = up, 0 = idle). Re-using Lenis
  // here keeps the slide animation in lockstep with the page's smooth-
  // scroll motion rather than fighting raw `window.scroll` events.
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // useLenis returns the Lenis instance even when called with a callback,
  // so this single call gives us BOTH the per-frame scroll subscription
  // (for the hide/show animation below) AND a handle to call scrollTo()
  // from the home-link click handler further down.
  const lenis = useLenis(({ scroll, direction }) => {
    setScrolled(scroll > 8);

    // The hero is `min-h-svh`, so its bottom edge is at ≈ 100vh. Use
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
    // depth in the page. On other routes let next/link navigate normally
    // — Next.js scrolls the new page to top on its own, which Lenis then
    // smooths.
    if (pathname === "/" && lenis) {
      e.preventDefault();
      lenis.scrollTo(0);
    }
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 border-b transition-[translate,background-color,border-color] duration-300 ease-out motion-reduce:transition-none",
        // A keyboard user tabbing into a hidden bar brings it back.
        hidden ? "-translate-y-full focus-within:translate-y-0" : "translate-y-0",
        scrolled
          ? "border-ink/10 bg-ana-1/85 backdrop-blur-md"
          : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-5 md:h-20 md:justify-start md:gap-10 md:px-10">
        <Link
          href="/"
          onClick={handleHomeClick}
          className="inline-flex shrink-0 items-center gap-2.5 rounded-lg font-serif text-lg tracking-tight text-ink md:gap-3 md:text-xl"
        >
          <Image
            src="/brand/app-icon.png"
            alt=""
            width={40}
            height={40}
            className="size-8 rounded-[9px] md:size-10 md:rounded-xl"
          />
          <span>
            <span className="italic">My</span> Pocket Library
          </span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-4 md:gap-7">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={pathname === "/" ? link.href : `/${link.href}`}
              className={cn(
                "min-h-11 items-center rounded-sm text-sm text-ink/70 transition-colors hover:text-ink",
                link.className,
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
