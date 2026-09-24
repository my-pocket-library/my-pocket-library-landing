import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/footer";

type Props = {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
};

export function LegalPage({ title, effectiveDate, children }: Props) {
  return (
    <>
      <main id="main" className="min-h-screen bg-ana-1 text-ink">
        <div className="mx-auto max-w-3xl px-6 pt-10 pb-24 md:px-8 md:pt-14">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm text-ink/70 transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden className="size-4" strokeWidth={2} />
            Back to home
          </Link>

          <header className="mt-8 border-b border-ink/10 pb-8">
            <p className="font-serif text-xl tracking-tight">
              <span className="italic">My</span> Pocket Library
            </p>
            <h1 className="mt-4 font-serif text-4xl font-medium leading-[1.1] tracking-[-0.02em] md:text-5xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-ink/70">
              Effective date: {effectiveDate}
            </p>
          </header>

          {/* break-words (overflow-wrap: break-word) rather than wrap-anywhere:
           *  both stop long emails/URLs overflowing, but `anywhere` also
           *  shrinks every word's min-content width, which let the privacy
           *  table squeeze its first column until words split mid-word. */}
          <div className="mt-10 space-y-8 break-words text-[15px] leading-relaxed text-ink/80 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:text-ink [&_h2]:mt-10 [&_h2:first-child]:mt-0 [&_p]:mt-3 [&_p:first-child]:mt-0">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
