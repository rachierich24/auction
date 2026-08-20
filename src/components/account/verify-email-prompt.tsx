"use client";

import * as React from "react";
import { MailWarning } from "lucide-react";

import { resendVerificationAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

/**
 * Soft prompt rather than a hard gate.
 *
 * Bidding is still permitted while unverified unless
 * REQUIRE_EMAIL_VERIFICATION=true, which the bidding engine enforces
 * server-side. This banner is the nudge, not the control.
 */
export function VerifyEmailPrompt({ className }: { className?: string }) {
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = React.useState<string | null>(null);

  async function resend() {
    setState("sending");
    const result = await resendVerificationAction();
    setMessage(result.message ?? null);
    setState(result.ok ? "sent" : "error");
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-sm border border-caution/25 bg-caution-wash px-4 py-3.5 sm:flex-row sm:items-center",
        className,
      )}
    >
      <MailWarning className="size-4 shrink-0 text-caution" />

      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-medium text-caution">
          Confirm your email address
        </p>
        <p className="mt-0.5 text-[0.75rem] leading-relaxed text-caution/85">
          {message ??
            "We sent a confirmation link when you registered. Confirming keeps your account and your bids recoverable."}
        </p>
      </div>

      {state !== "sent" ? (
        <button
          type="button"
          onClick={resend}
          disabled={state === "sending"}
          className="shrink-0 self-start rounded-sm border border-caution/40 px-3 py-1.5 text-[0.75rem] text-caution transition-colors hover:bg-caution/10 disabled:opacity-50 sm:self-auto"
        >
          {state === "sending" ? "Sending…" : "Resend link"}
        </button>
      ) : null}
    </div>
  );
}
