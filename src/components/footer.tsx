import Link from "next/link";

export function Footer() {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-6 pb-5 text-[12px] text-black/60 md:flex-row md:px-10">
        <p className="pointer-events-auto">
          © {new Date().getFullYear()} My Pocket Library
        </p>
        <nav className="pointer-events-auto flex items-center gap-5">
          <Link
            href="/privacy"
            className="transition-colors hover:text-black"
          >
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-black">
            Terms
          </Link>
          <a
            href="mailto:hasanaharman33@gmail.com"
            className="transition-colors hover:text-black"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
