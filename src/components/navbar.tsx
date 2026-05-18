import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

const navLinks = [
  { label: "Solutions", href: "#solutions" },
  { label: "Customer service", href: "#support" },
  { label: "About us", href: "#about" },
  { label: "Careers", href: "#careers" },
];

export function Navbar() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6 md:px-10">
        <div className="flex items-center gap-10">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-black"
          >
            <span className="italic">My</span>{" "}
            <span className="font-medium">Pocket Library</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="group inline-flex items-center gap-1 text-sm text-black/70 transition-colors hover:text-black"
              >
                {link.label}
                <ChevronDown
                  className="size-3.5 opacity-60 transition-transform group-hover:translate-y-0.5"
                  strokeWidth={2}
                />
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="rounded-full border border-black/15 bg-transparent px-5 text-black hover:bg-black/5 hover:text-black"
          >
            Log in
          </Button>
          <Button className="rounded-full border border-black/15 bg-black/5 px-5 text-black backdrop-blur hover:bg-black/10">
            Try now
          </Button>
        </div>
      </div>
    </header>
  );
}
