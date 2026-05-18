import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
};

export function LegalPage({ title, effectiveDate, children }: Props) {
  return (
    <main className="min-h-screen bg-ana-1 text-black">
      <div className="mx-auto max-w-3xl px-6 pt-10 pb-24 md:px-8 md:pt-14">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-black/70 transition-colors hover:text-black"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          Back to home
        </Link>

        <header className="mt-10 border-b border-black/10 pb-8">
          <p className="font-serif text-xl italic tracking-tight">
            <span className="font-medium not-italic">My Pocket Library</span>
          </p>
          <h1 className="mt-4 font-serif text-4xl font-medium leading-[1.1] tracking-[-0.02em] md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-black/60">
            Effective date: {effectiveDate}
          </p>
        </header>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-black/80 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:text-black [&_h2]:mt-10 [&_h2:first-child]:mt-0 [&_p]:mt-3 [&_p:first-child]:mt-0">
          {children}
        </div>
      </div>
    </main>
  );
}
