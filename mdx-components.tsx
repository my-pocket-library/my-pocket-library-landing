import type { MDXComponents } from "mdx/types";

/**
 * Project-wide MDX component map.
 *
 * Next.js looks for this file at the project root by convention. Components
 * returned here are merged with any per-file overrides — so the FAQ section
 * doesn't have to redeclare paragraph / link / list styles; the defaults
 * here apply across every MDX file we import.
 *
 * Per-section components (e.g. <FaqItem> that wraps an Accordion entry)
 * are passed inline at the import site instead, so they stay scoped to
 * the section that uses them.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Headings inside MDX content. Light defaults — page-level type comes
    // from each section's own header above the MDX block.
    h2: ({ children, ...props }) => (
      <h2
        className="mt-10 font-serif text-2xl font-medium tracking-[-0.01em] text-black"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3
        className="mt-6 text-lg font-semibold text-black"
        {...props}
      >
        {children}
      </h3>
    ),
    p: ({ children, ...props }) => (
      <p
        className="mt-4 text-base leading-relaxed text-black/70"
        {...props}
      >
        {children}
      </p>
    ),
    a: ({ children, ...props }) => (
      <a
        className="text-black underline decoration-black/30 underline-offset-4 transition-colors hover:decoration-black"
        {...props}
      >
        {children}
      </a>
    ),
    ul: ({ children, ...props }) => (
      <ul
        className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed text-black/70 marker:text-black/40"
        {...props}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol
        className="mt-4 list-decimal space-y-2 pl-5 text-base leading-relaxed text-black/70 marker:text-black/40"
        {...props}
      >
        {children}
      </ol>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-semibold text-black" {...props}>
        {children}
      </strong>
    ),
    ...components,
  };
}
