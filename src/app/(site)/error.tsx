"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Public error boundary.
 *
 * Shows the bidder something calm and actionable and never the underlying
 * message — a stack trace or a database error on a saleroom page destroys
 * exactly the confidence the product depends on. The digest is surfaced so
 * support can correlate a report with the server log.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[site] render error", error);
  }, [error]);

  return (
    <div className="gutter mx-auto flex max-w-lg flex-col items-center py-28 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-line bg-surface text-caution">
        <TriangleAlert className="size-5" strokeWidth={1.5} />
      </span>

      <h1 className="mt-6 font-display text-3xl tracking-tight text-ink text-balance">
        Something went wrong
      </h1>

      <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted text-pretty">
        We could not load this page. Nothing you have bid on is affected — bids
        are recorded on our servers, not in your browser. Please try again.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button onClick={reset} variant="primary">
          <RotateCw className="size-4" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/auctions">Back to the catalogue</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="mt-8 font-mono text-[0.6875rem] text-faint">
          Reference {error.digest}
        </p>
      ) : null}
    </div>
  );
}
