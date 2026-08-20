import { Badge } from "@/components/ui/primitives";
import { STATUS_LABELS, type DisplayStatus } from "@/lib/auction/status";
import { cn } from "@/lib/utils";

const TONE: Record<DisplayStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  DRAFT: "neutral",
  UPCOMING: "outline",
  LIVE: "live",
  ENDING_SOON: "live",
  EXTENDED: "caution",
  ENDED: "neutral",
  SOLD: "ink",
  UNSOLD: "neutral",
  CANCELLED: "neutral",
};

export function StatusBadge({
  status,
  className,
}: {
  status: DisplayStatus;
  className?: string;
}) {
  const isLive = status === "LIVE" || status === "ENDING_SOON" || status === "EXTENDED";

  return (
    <Badge tone={TONE[status]} className={cn(className)}>
      {isLive ? (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            status === "EXTENDED" ? "bg-caution" : "bg-white",
            "animate-[pulse-live_2s_ease-in-out_infinite]",
          )}
        />
      ) : null}
      {STATUS_LABELS[status]}
    </Badge>
  );
}
