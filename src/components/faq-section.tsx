import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import FaqContent from "@/content/faq.mdx";

/**
 * Maps the friendly <FaqItem question="...">…answer…</FaqItem> JSX inside
 * faq.mdx to the underlying Accordion primitive parts. Letting content
 * editors stay in the question/answer headspace instead of having to know
 * the Accordion API.
 *
 * The `value` we give each AccordionItem is the question text itself —
 * it has to be unique within the accordion, and questions naturally are.
 */
function FaqItem({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={question}>
      <AccordionTrigger>{question}</AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

export function FaqSection() {
  return (
    <section
      id="faq"
      className="relative isolate bg-ana-1 py-24 md:py-32"
    >
      <div className="mx-auto max-w-[760px] px-6">
        <div className="text-center">
          <span className="inline-block rounded-full border border-ink/10 bg-white/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-ink/70 backdrop-blur">
            Frequently asked
          </span>
          <h2 className="mt-5 font-serif text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-ink md:text-5xl">
            Questions, answered.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base text-ink/70 md:text-lg">
            The stuff people ask us most — scanning, sync, pricing, and
            what happens to your data.
          </p>
        </div>

        <div className="mt-12 md:mt-16">
          {/* `multiple` lets several questions stay open at once — Base UI
           *  defaults it to false (single-open accordion). */}
          <Accordion multiple>
            {/* MDX content lives in src/content/faq.mdx — each
             *  <FaqItem question="…">…</FaqItem> in there renders as one
             *  AccordionItem here via the `components` prop. */}
            <FaqContent components={{ FaqItem }} />
          </Accordion>
        </div>
      </div>
    </section>
  );
}
