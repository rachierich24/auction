import Link from "next/link";

import { getContent } from "@/lib/content/site-content";
import { getCategories } from "@/lib/auction/queries";
import { NewsletterForm } from "@/components/site/newsletter-form";

export async function SiteFooter() {
  const [footer, newsletter, categories] = await Promise.all([
    getContent("footer"),
    getContent("newsletter"),
    getCategories(),
  ]);

  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="gutter mx-auto max-w-[110rem]">
        <div className="grid gap-12 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <p className="font-display text-2xl leading-none tracking-tight text-ink">
              Groovy
              <span className="ml-1.5 align-super text-[0.5rem] uppercase tracking-[0.22em] text-accent">
                Auction
              </span>
            </p>
            <p className="mt-5 max-w-sm text-[0.8125rem] leading-relaxed text-muted text-pretty">
              {footer.blurb}
            </p>
            <address className="mt-6 space-y-1 text-[0.8125rem] not-italic text-muted">
              <p>{footer.address}</p>
              <p>
                <a
                  href={`mailto:${footer.email}`}
                  className="underline-offset-4 hover:text-ink hover:underline"
                >
                  {footer.email}
                </a>
              </p>
              <p className="tabular">{footer.phone}</p>
            </address>
          </div>

          <FooterColumn
            title="Saleroom"
            links={[
              { href: "/auctions", label: "All lots" },
              { href: "/auctions?status=live", label: "Live now" },
              { href: "/auctions?status=upcoming", label: "Upcoming" },
              { href: "/auctions?status=ended", label: "Past results" },
            ]}
          />

          <FooterColumn
            title="Departments"
            links={categories.slice(0, 6).map((category) => ({
              href: `/auctions?category=${category.slug}`,
              label: category.name,
            }))}
          />

          <div>
            <p className="eyebrow mb-4">{newsletter.heading}</p>
            <p className="mb-5 text-[0.8125rem] leading-relaxed text-muted text-pretty">
              {newsletter.body}
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-faint">
            © {year} {footer.legalName}. All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { href: "/how-it-works", label: "How it works" },
              { href: "/terms", label: "Conditions of sale" },
              { href: "/privacy", label: "Privacy" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-faint underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="eyebrow mb-4">{title}</p>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link
              href={link.href}
              className="text-[0.8125rem] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
