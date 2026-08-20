import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * Also serves the `notFound()` thrown by a lot that is a draft, withdrawn, or
 * simply does not exist — deliberately the same page for all three, so a probe
 * cannot distinguish "no such lot" from "not yet published".
 */
export default function NotFound() {
  return (
    <div className="gutter mx-auto flex max-w-lg flex-col items-center py-28 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-line bg-surface text-muted">
        <SearchX className="size-5" strokeWidth={1.5} />
      </span>

      <h1 className="mt-6 font-display text-3xl tracking-tight text-ink">
        We can&rsquo;t find that page
      </h1>

      <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted text-pretty">
        The lot may have been withdrawn, or the address may be mistyped. The
        current catalogue is always up to date.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button asChild variant="primary">
          <Link href="/auctions">Browse the catalogue</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
