import { cn } from "@/lib/utils";

type AppStoreBadgeProps = {
  /** App Store URL — defaults to "#" while we don't have a live listing. */
  href?: string;
  className?: string;
};

/**
 * "Download on the App Store" badge.
 *
 * Built inline as JSX rather than using Apple's official PNG/SVG asset so
 * it's vector-crisp at any size and tints cleanly via currentColor. The
 * layout follows Apple's marketing-resources spec:
 *
 *   ┌──────────────────────────────────────┐
 *   │  ▲      Download on the              │   ▲ = Apple silhouette
 *   │ ▲▲▲     App Store                    │   text right-aligned column
 *   └──────────────────────────────────────┘
 *
 * Black variant for light backgrounds; flip to a white/`bg-white` wrapper
 * with `text-black` for dark surfaces if needed later.
 */
export function AppStoreBadge({
  href = "#",
  className,
}: AppStoreBadgeProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download My Pocket Library on the App Store"
      className={cn(
        "group inline-flex h-12 items-center gap-2 rounded-xl bg-black px-4 text-white",
        "shadow-[0_2px_30px_-2px_rgba(0,0,0,0.25)]",
        "transition-colors hover:bg-black/90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ana-1",
        className,
      )}
    >
      {/* Apple silhouette — the same path FontAwesome / Simple Icons use
       *  for the brand mark. viewBox 0 0 384 512 keeps the height : width
       *  ratio close to the real logo's vertical-leaning silhouette. */}
      <svg
        viewBox="0 0 384 512"
        aria-hidden
        className="h-7 w-auto translate-y-[-1px] fill-current"
      >
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>

      {/* Two-line stack — small caps row above the wordmark. Tight
       *  line-heights so the two lines visually centre together. */}
      <span className="flex flex-col items-start leading-none">
        <span className="text-[10px] font-normal tracking-[0.04em] opacity-80">
          Download on the
        </span>
        <span className="-mt-0.5 text-[17px] font-semibold leading-tight tracking-tight">
          App Store
        </span>
      </span>
    </a>
  );
}
