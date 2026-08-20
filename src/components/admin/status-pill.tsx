import { STATUS_LABELS, type DisplayStatus } from "@/lib/auction/status";
import { cn } from "@/lib/utils";

/**
 * Compact status marker for dense admin tables.
 *
 * Colour is doubled by the written label, never carried alone — the same rule
 * the charts follow.
 */
const STYLES: Record<DisplayStatus, string> = {
  DRAFT: "border-line-strong text-faint",
  UPCOMING: "border-line-strong text-ink-soft",
  LIVE: "border-positive/35 bg-positive-wash text-positive",
  ENDING_SOON: "border-live/30 bg-live-wash text-live",
  EXTENDED: "border-caution/35 bg-caution-wash text-caution",
  ENDED: "border-line-strong text-muted",
  SOLD: "border-accent/40 bg-accent-wash text-accent-deep",
  UNSOLD: "border-line-strong text-muted",
  CANCELLED: "border-line-strong text-faint line-through",
};

export function StatusPill({
  status,
  className,
}: {
  status: DisplayStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] border px-2 py-1 text-[0.6875rem] font-medium",
        STYLES[status],
        className,
      )}
    >
      {status === "LIVE" || status === "ENDING_SOON" ? (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-current animate-[pulse-live_2s_ease-in-out_infinite]"
        />
      ) : null}
      {STATUS_LABELS[status]}
    </span>
  );
}
