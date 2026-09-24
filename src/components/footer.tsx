import Link from "next/link";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

const linkClass =
  "rounded-sm underline-offset-4 transition-colors hover:text-ink hover:underline";

export function Footer() {
  return (
    <footer className="relative z-20 border-t border-ink/10">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-6 py-7 text-[13px] text-ink/70 md:flex-row md:px-10">
        <p>
          © {new Date().getFullYear()} {SITE_NAME}
        </p>
        <nav aria-label="Footer" className="flex items-center gap-5">
          <Link href="/privacy" className={linkClass}>
            Privacy
          </Link>
          <Link href="/terms" className={linkClass}>
            Terms
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
