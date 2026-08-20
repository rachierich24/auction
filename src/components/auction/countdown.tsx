"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Countdown to a server-supplied instant.
 *
 * The browser clock is used only to animate between ticks — it never decides
 * anything. The moment the timer reaches zero it stops rendering a live figure
 * and asks the server for the truth (`onExpire`), because a skewed client clock
 * must never be able to show a lot as open or closed when it is not.
 */

type Parts = {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function partsFor(target: number, now: number): Parts {
  const total = Math.max(0, target - now);
  const seconds = Math.floor(total / 1000);
  return {
    total,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

export function useCountdown(endAt: string | Date, onExpire?: () => void) {
  const target = React.useMemo(
    () => new Date(endAt).getTime(),
    [endAt],
  );

  // Start from the target itself so server and first client render agree;
  // the real remaining time lands on the first effect tick.
  const [parts, setParts] = React.useState<Parts | null>(null);
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    firedRef.current = false;

    const tick = () => {
      const next = partsFor(target, Date.now());
      setParts(next);
      if (next.total <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, onExpire]);

  return parts;
}

export function Countdown({
  endAt,
  onExpire,
  variant = "default",
  prefix,
  className,
}: {
  endAt: string | Date;
  onExpire?: () => void;
  variant?: "default" | "compact" | "large";
  prefix?: string;
  className?: string;
}) {
  const parts = useCountdown(endAt, onExpire);

  if (!parts) {
    // Server render and first paint: reserve the space, no misleading figure.
    return (
      <span
        className={cn("tabular text-muted", className)}
        suppressHydrationWarning
      >
        {variant === "large" ? "—— : —— : ——" : "—"}
      </span>
    );
  }

  if (parts.total <= 0) {
    return (
      <span className={cn("tabular font-medium text-muted", className)}>
        Closed
      </span>
    );
  }

  const urgent = parts.total <= 5 * 60 * 1000;
  const soon = parts.total <= 60 * 60 * 1000;

  if (variant === "large") {
    const segments: [string, number][] = parts.days
      ? [
          ["Days", parts.days],
          ["Hrs", parts.hours],
          ["Min", parts.minutes],
          ["Sec", parts.seconds],
        ]
      : [
          ["Hrs", parts.hours],
          ["Min", parts.minutes],
          ["Sec", parts.seconds],
        ];

    return (
      <div className={cn("flex items-start gap-3", className)}>
        {segments.map(([label, value], index) => (
          <React.Fragment key={label}>
            {index > 0 ? (
              <span className="pt-1 font-display text-2xl leading-none text-line-strong">
                :
              </span>
            ) : null}
            <div className="text-center">
              <div
                key={`${label}-${value}`}
                className={cn(
                  "tabular font-display text-3xl leading-none tracking-tight",
                  urgent ? "text-live" : "text-ink",
                  label === "Sec" && "animate-[tick_0.32s_cubic-bezier(0.22,1,0.36,1)]",
                )}
              >
                {String(value).padStart(2, "0")}
              </div>
              <div className="mt-1.5 text-[0.625rem] uppercase tracking-[0.14em] text-faint">
                {label}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  }

  const text = parts.days
    ? `${parts.days}d ${parts.hours}h`
    : parts.hours
      ? `${parts.hours}h ${String(parts.minutes).padStart(2, "0")}m`
      : `${parts.minutes}m ${String(parts.seconds).padStart(2, "0")}s`;

  return (
    <span
      className={cn(
        "tabular",
        urgent ? "font-medium text-live" : soon ? "text-live" : "text-ink-soft",
        className,
      )}
    >
      {prefix ? <span className="text-faint">{prefix} </span> : null}
      {text}
    </span>
  );
}
