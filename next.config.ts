import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow .mdx alongside .ts(x). We still serve regular pages from page.tsx
  // — this just lets us *import* MDX files as React components anywhere in
  // the tree (e.g. our FAQ + Support content under src/content/).
  pageExtensions: ["ts", "tsx", "md", "mdx"],
};

const withMDX = createMDX({
  // Default MDX loader. Custom remark/rehype plugins can land here later
  // if we want footnotes, code highlighting, etc.
});

export default withMDX(nextConfig);
