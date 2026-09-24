import type { Metadata } from "next";

/**
 * Site-wide constants. Everything that has to agree across pages — the
 * canonical origin, the contact address, the App Store listing, the share
 * card — lives here so it is changed in one place.
 */

/** Canonical origin. The apex domain redirects here (Vercel domain config),
 *  and the iOS app links to /privacy and /terms on it (LegalLinks.swift). */
export const SITE_URL = "https://www.mypocketlibrary.app";

export const SITE_NAME = "My Pocket Library";

export const SITE_TITLE = `${SITE_NAME} — Scan, shelve, and track every book you own`;

export const SITE_DESCRIPTION =
  "Scan the books on your shelf to build a digital library, then track what you’ve read, what you’re reading, and what’s next.";

export const CONTACT_EMAIL = "hasanharman33@gmail.com";

/**
 * The App Store listing, e.g. "https://apps.apple.com/app/id1234567890".
 * Leave null until the app is live: the download badge then renders as a
 * non-interactive "Coming soon" badge. Setting it turns the badge into a
 * link and adds Safari's Smart App Banner (the numeric id is read from the
 * URL).
 */
// `as` keeps the declared type: an annotated `= null` would narrow to `null`.
export const APP_STORE_URL = null as string | null;

export const APP_STORE_ID = APP_STORE_URL?.match(/\/id(\d+)/)?.[1] ?? null;

/** Link-preview card (public/og.jpg, 1200×630), used by every page. */
const SHARE_IMAGE = {
  url: "/og.jpg",
  width: 1200,
  height: 630,
  alt: "My Pocket Library — Your library. In your pocket. An iPhone showing a book in the app, surrounded by a carousel of books.",
};

/** Shared Open Graph / X fields. Next.js merges `openGraph` and `twitter`
 *  shallowly, so every page that sets its own title spreads these in to
 *  keep the rest (the image in particular). */
export const OPEN_GRAPH_BASE = {
  type: "website" as const,
  siteName: SITE_NAME,
  locale: "en_US",
  images: [SHARE_IMAGE],
};

export const TWITTER_BASE = {
  card: "summary_large_image" as const,
  images: [SHARE_IMAGE],
};

/** Title, description, canonical URL and share tags for an inner page. */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const fullTitle = `${title} — ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OPEN_GRAPH_BASE, url: path, title: fullTitle, description },
    twitter: { ...TWITTER_BASE, title: fullTitle, description },
  };
}
