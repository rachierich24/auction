import Link from "next/link";

/**
 * Split-screen frame shared by every credential page: the form on the left,
 * an editorial panel on the right that reinforces what registration is for.
 */
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-10 sm:px-12 lg:px-16">
        <Link
          href="/"
          className="font-display text-[1.375rem] leading-none tracking-tight text-ink"
        >
          Groovy&rsquo;s
          <span className="ml-1.5 align-super text-[0.5rem] uppercase tracking-[0.22em] text-accent">
            Auction
          </span>
        </Link>

        <div className="flex flex-1 items-center py-12">
          <div className="w-full max-w-sm">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-4 font-display text-[2.5rem] leading-[1.05] tracking-tight text-ink text-balance">
              {title}
            </h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted text-pretty">
              {description}
            </p>

            <div className="mt-8">{children}</div>

            {footer ? (
              <div className="mt-8 border-t border-line pt-6 text-[0.8125rem] text-muted">
                {footer}
              </div>
            ) : null}
          </div>
        </div>

        <p className="text-xs text-faint">
          © {new Date().getFullYear()} Groovy's Auction. All rights reserved.
        </p>
      </div>

      <aside className="relative hidden overflow-hidden bg-ink lg:block">
        {/* Editorial panel — typographic rather than photographic, so it never
            competes with the form for attention. */}
        <div className="absolute inset-0 flex flex-col justify-between p-16">
          <div />
          <blockquote className="max-w-lg">
            <p className="font-display text-[2.5rem] leading-[1.12] tracking-tight text-white text-balance">
              Every bid is timestamped by the server, recorded in full, and
              visible to every bidder in the room.
            </p>
            <footer className="mt-8 text-[0.8125rem] uppercase tracking-[0.14em] text-white/50">
              Conditions of sale, clause 4
            </footer>
          </blockquote>

          <dl className="grid grid-cols-3 gap-8 border-t border-white/12 pt-8">
            {[
              ["Server-timed", "Bidding windows"],
              ["Anti-snipe", "Automatic extensions"],
              ["Full ledger", "Public bid history"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-[0.625rem] uppercase tracking-[0.14em] text-white/40">
                  {label}
                </dt>
                <dd className="mt-1.5 font-display text-lg text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  );
}
