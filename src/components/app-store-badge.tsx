import Image from "next/image";
import { APP_STORE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

type AppStoreBadgeProps = {
  className?: string;
};

/**
 * Apple's official "Download on the App Store" badge (black, US-English),
 * from Apple's marketing tools — the guidelines require the unaltered
 * artwork, so it is served as-is from /brand/app-store-badge.svg.
 *
 * Until APP_STORE_URL is set in src/lib/site.ts the badge is not a link:
 * it renders with a "Coming soon" label instead of pointing nowhere.
 */
export function AppStoreBadge({ className }: AppStoreBadgeProps) {
  const badge = (
    <Image
      src="/brand/app-store-badge.svg"
      alt=""
      width={120}
      height={40}
      className="h-12 w-auto"
      draggable={false}
    />
  );

  if (APP_STORE_URL) {
    return (
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download My Pocket Library on the App Store"
        className={cn(
          "inline-flex shrink-0 rounded-[10px] transition-opacity hover:opacity-85",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ana-1",
          className,
        )}
      >
        {badge}
      </a>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex shrink-0 cursor-default select-none flex-col items-center gap-2.5",
        className,
      )}
    >
      <span aria-hidden className="inline-flex">
        {badge}
      </span>
      <span className="rounded-full border border-ink/10 bg-white/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-ink/70 backdrop-blur">
        Coming soon <span className="sr-only">to the App Store</span>
      </span>
    </div>
  );
}
