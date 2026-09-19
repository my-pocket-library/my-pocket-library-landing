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
    table: ({ children, ...props }) => (
      <div role="region" aria-label="Personal data and processing purposes" tabIndex={0} className="my-6 overflow-x-auto rounded-xl border border-ink/15">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm leading-relaxed [&_th]:bg-ink/5 [&_th]:font-semibold [&_th]:p-4 [&_td]:p-4 [&_td]:align-top [&_tr]:border-b [&_tr]:border-ink/10" {...props}>{children}</table>
      </div>
    ),
    // Headings inside MDX content. Light defaults — page-level type comes
    // from each section's own header above the MDX block.
    h2: ({ children, ...props }) => (
      <h2
        className="mt-10 font-serif text-2xl font-medium tracking-[-0.01em] text-ink"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3
        className="mt-6 text-lg font-semibold text-ink"
        {...props}
      >
        {children}
      </h3>
    ),
    p: ({ children, ...props }) => (
      <p
        className="mt-4 text-base leading-relaxed text-ink/70"
        {...props}
      >
        {children}
      </p>
    ),
    a: ({ children, ...props }) => (
      <a
        className="wrap-anywhere text-ink underline decoration-black/30 underline-offset-4 transition-colors hover:decoration-black"
        {...props}
      >
        {children}
      </a>
    ),
    ul: ({ children, ...props }) => (
      <ul
        className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed text-ink/70 marker:text-ink/40"
        {...props}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol
        className="mt-4 list-decimal space-y-2 pl-5 text-base leading-relaxed text-ink/70 marker:text-ink/40"
        {...props}
      >
        {children}
      </ol>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-semibold text-ink" {...props}>
        {children}
      </strong>
    ),
    ...components,
  };
}
