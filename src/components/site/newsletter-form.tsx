"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";

import { subscribeToNewsletter } from "@/app/actions/newsletter";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function NewsletterForm() {
  const [state, setState] = React.useState<{
    status: "idle" | "pending" | "done" | "error";
    message?: string;
  }>({ status: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = new FormData(form).get("email");
    if (typeof email !== "string") return;

    setState({ status: "pending" });
    const result = await subscribeToNewsletter(email);

    if (result.ok) {
      form.reset();
      setState({ status: "done", message: result.message });
    } else {
      setState({ status: "error", message: result.message });
    }
  }

  if (state.status === "done") {
    return (
      <p className="rounded-sm border border-positive/25 bg-positive-wash px-4 py-3 text-[0.8125rem] text-positive">
        {state.message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex items-center gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <Input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={state.status === "error"}
          disabled={state.status === "pending"}
          className="h-11"
        />
        <button
          type="submit"
          disabled={state.status === "pending"}
          aria-label="Subscribe"
          className={cn(
            "inline-flex h-11 shrink-0 items-center justify-center rounded-sm bg-ink px-4 text-white",
            "transition-colors hover:bg-ink-soft disabled:opacity-50",
          )}
        >
          <ArrowRight className="size-4" />
        </button>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="mt-2 text-xs text-live">
          {state.message}
        </p>
      ) : (
        <p className="mt-2 text-xs text-faint">
          Unsubscribe at any time. We never share your address.
        </p>
      )}
    </form>
  );
}
