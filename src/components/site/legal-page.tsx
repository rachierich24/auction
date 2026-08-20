export type Clause = { heading: string; body: string[] };

/**
 * Shared frame for the legal pages: a numbered clause list with a contents
 * rail. Long-form prose is set narrower than the rest of the site, because a
 * comfortable measure matters more here than filling the viewport.
 */
export function LegalPage({
  eyebrow,
  title,
  intro,
  clauses,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  clauses: Clause[];
}) {
  const updated = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="gutter mx-auto max-w-[110rem] py-12 md:py-20">
      <header className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 font-display text-[2.75rem] leading-[1.02] tracking-tight text-ink sm:text-[3.5rem] text-balance">
          {title}
        </h1>
        <p className="mt-5 text-[1.0625rem] leading-relaxed text-muted text-pretty">
          {intro}
        </p>
        <p className="mt-4 text-[0.75rem] text-faint">Last updated {updated}</p>
      </header>

      <div className="mt-14 grid gap-12 lg:grid-cols-[16rem_minmax(0,42rem)] lg:gap-20">
        <nav aria-label="Contents" className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow mb-4">Contents</p>
          <ol className="space-y-2">
            {clauses.map((clause, index) => (
              <li key={clause.heading}>
                <a
                  href={`#clause-${index + 1}`}
                  className="flex gap-2.5 text-[0.8125rem] text-muted transition-colors hover:text-ink"
                >
                  <span className="tabular text-faint">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {clause.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div>
          {clauses.map((clause, index) => (
            <section
              key={clause.heading}
              id={`clause-${index + 1}`}
              className="scroll-mt-28 border-t border-line py-8 first:border-t-0 first:pt-0"
            >
              <h2 className="flex gap-3 font-display text-2xl leading-tight tracking-tight text-ink">
                <span className="tabular text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {clause.heading}
              </h2>
              <div className="mt-4 space-y-4 text-[0.9375rem] leading-[1.75] text-ink-soft text-pretty">
                {clause.body.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
