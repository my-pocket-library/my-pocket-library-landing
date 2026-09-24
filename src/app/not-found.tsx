import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/footer";

// Next.js adds `noindex` to 404 responses on its own.
export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <>
      <main
        id="main"
        className="flex min-h-[80svh] flex-1 flex-col items-center justify-center bg-ana-1 px-6 py-24 text-center text-ink"
      >
        <Image
          src="/brand/first-book.svg"
          alt=""
          width={144}
          height={144}
          className="mb-2"
        />
        <span className="inline-block rounded-full border border-ink/10 bg-white/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-ink/70">
          Error 404
        </span>
        <h1 className="mt-5 font-serif text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] md:text-5xl">
          This page isn&rsquo;t on the shelf.
        </h1>
        <p className="mt-5 max-w-md text-balance text-base text-ink/70 md:text-lg">
          The link may be old or mistyped. Everything else is right where you
          left it.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-ink px-6 text-[15px] font-medium text-ana-1 transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ana-1"
        >
          Back to home
        </Link>
      </main>
      <Footer />
    </>
  );
}
