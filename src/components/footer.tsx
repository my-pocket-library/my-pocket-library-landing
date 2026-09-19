import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative z-20 border-t border-ink/5">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-6 py-6 text-[12px] text-ink/60 md:flex-row md:px-10">
        <p>© {new Date().getFullYear()} My Pocket Library</p>
        <nav className="flex items-center gap-5">
          <Link
            href="/privacy"
            className="transition-colors hover:text-ink"
          >
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-ink">
            Terms
          </Link>
          <a
            href="mailto:hasanharman33@gmail.com"
            className="transition-colors hover:text-ink"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
