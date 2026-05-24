import SupportContent from "@/content/support.mdx";

/**
 * Plain text section — content body comes from src/content/support.mdx.
 * Default MDX component styles (paragraph, link, list) come from the
 * root mdx-components.tsx file; no custom overrides needed here.
 */
export function SupportSection() {
  return (
    <section
      id="support"
      className="relative isolate bg-ana-1 pb-24 md:pb-32"
    >
      <div className="mx-auto max-w-[760px] px-6">
        <div className="text-center">
          <span className="inline-block rounded-full border border-black/10 bg-white/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-black/70 backdrop-blur">
            Support
          </span>
          <h2 className="mt-5 font-serif text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-black md:text-5xl">
            We&rsquo;re here to help.
          </h2>
        </div>

        <div className="mt-10 md:mt-12">
          {/* Default typography styles for h2/h3/p/a/etc. come from the
           *  project-root mdx-components.tsx. Override per-section if a
           *  section needs different type — Support uses the defaults. */}
          <SupportContent />
        </div>
      </div>
    </section>
  );
}
