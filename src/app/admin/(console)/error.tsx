"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Console error boundary.
 *
 * Operators get more than bidders do — the digest and the message — because
 * they are staff, they are the ones who will report it, and the console is
 * already behind an authorisation check.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[admin] render error", error);
  }, [error]);

  return (
    <div className="flex flex-col items-start py-16">
      <span className="flex size-10 items-center justify-center rounded-sm border border-line bg-surface text-caution">
        <TriangleAlert className="size-4" strokeWidth={1.5} />
      </span>

      <h1 className="mt-5 font-display text-2xl tracking-tight text-ink">
        This screen failed to load
      </h1>

      <p className="mt-2 max-w-xl text-[0.875rem] leading-relaxed text-muted text-pretty">
        No changes were saved. Retry the screen; if it keeps failing, quote the
        reference below when reporting it.
      </p>

      <div className="mt-6 flex gap-2">
        <Button onClick={reset} variant="primary" size="sm">
          <RotateCw className="size-4" />
          Retry
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">Back to the dashboard</Link>
        </Button>
      </div>

      <pre className="mt-8 max-w-full overflow-x-auto rounded-sm border border-line bg-surface p-4 text-[0.75rem] text-muted">
        {error.message}
        {error.digest ? `\n\nReference ${error.digest}` : ""}
      </pre>
    </div>
  );
}
