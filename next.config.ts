import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plain HTML/CSS/JS in out/, served by Cloudflare Pages (see wrangler.jsonc).
  // Security headers live in public/_headers, which Pages applies to every route.
  output: "export",
  // Pages has no image optimizer; the images in public/ ship as they are.
  images: { unoptimized: true },
  // Allow .mdx alongside .ts(x). We still serve regular pages from page.tsx
  // — this just lets us *import* MDX files as React components anywhere in
  // the tree (e.g. our FAQ + Support content under src/content/).
  pageExtensions: ["ts", "tsx", "md", "mdx"],
};

const withMDX = createMDX({
  options: { remarkPlugins: ["remark-gfm"] },
});

export default withMDX(nextConfig);
