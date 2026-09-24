import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// Baseline security headers for every route. (Vercel already sends
// Strict-Transport-Security, and .app is HTTPS-only by HSTS preload.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing on this site is meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Allow .mdx alongside .ts(x). We still serve regular pages from page.tsx
  // — this just lets us *import* MDX files as React components anywhere in
  // the tree (e.g. our FAQ + Support content under src/content/).
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withMDX = createMDX({
  options: { remarkPlugins: ["remark-gfm"] },
});

export default withMDX(nextConfig);
