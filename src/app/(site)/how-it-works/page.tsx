import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DescriptionList, SectionHeading } from "@/components/ui/primitives";
import { getContent } from "@/lib/content/site-content";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How bidding, increments, reserves, anti-snipe extensions, buyer's premium and settlement work at Groovy's Auction.",
  alternates: { canonical: "/how-it-works" },
};

export default async function HowItWorksPage() {
  const [howItWorks, trust] = await Promise.all([
    getContent("howItWorks"),
    getContent("trust"),
  ]);

  const faqs = [
    {
      q: "How is the minimum next bid decided?",
      a: "The first bid on a lot must meet its starting price. After that, every bid must clear the standing bid by at least one full increment, which is published on each lot. The server recalculates this on every bid; a lower figure is rejected outright.",
    },
    {
      q: "What is a maximum bid?",
      a: "Instead of watching a lot, you can leave a ceiling. The saleroom then bids on your behalf by the smallest step needed to keep you in front, and stops at your ceiling. If someone leaves a higher ceiling than yours, they take the lead — at one increment above your maximum, not at their own.",
    },
    {
      q: "What happens if someone bids in the last few seconds?",
      a: "On lots with extensions enabled, a bid inside the closing window pushes the close out — typically by two minutes. This repeats for as long as bidding continues, so a lot is decided by the highest bidder rather than the fastest connection.",
    },
    {
      q: "What is a reserve?",
      a: "A confidential minimum agreed with the consignor. Whether a lot carries a reserve is disclosed before bidding opens, and whether it has been met is shown live. If bidding closes below the reserve, the lot is unsold and no sale takes place.",
    },
    {
      q: "What is the buyer's premium?",
      a: "A percentage added to the hammer price, stated on every lot before you bid. Your invoice itemises the hammer price and the premium separately.",
    },
    {
      q: "Can I retract a bid?",
      a: "No. Bids are binding once placed, which is why every bid is confirmed in a dialog showing the exact amount before it is submitted.",
    },
    {
      q: "Are bidder identities public?",
      a: "No. The bid history on every lot is public and complete, but identities are masked — a bidder appears as a first name and four asterisks. Your full details are visible only to you and to saleroom staff.",
    },
    {
      q: "When is payment due?",
      a: "Within five business days of the sale closing. Winning bidders receive an invoice and can settle from their account. Shipping or collection is arranged once payment clears.",
    },
  ];

  return (
    <>
      <section className="gutter mx-auto max-w-[110rem] py-12 md:py-20">
        <p className="eyebrow">Guide</p>
        <h1 className="mt-4 max-w-3xl font-display text-[2.75rem] leading-[1.02] tracking-tight text-ink sm:text-[4rem] text-balance">
          {howItWorks.heading}
        </h1>
        <p className="mt-6 max-w-2xl text-[1.0625rem] leading-relaxed text-muted text-pretty">
          {howItWorks.body}
        </p>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title} className="bg-surface p-7">
              <span className="font-display text-3xl leading-none text-accent tabular">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-5 font-display text-xl tracking-tight text-ink">
                {step.title}
              </h2>
              <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-muted text-pretty">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="gutter mx-auto max-w-[110rem] py-20">
          <SectionHeading
            eyebrow="The mechanics"
            title="Questions bidders ask"
            description="If something is not covered here, the saleroom will answer it before you bid."
          />

          <dl className="mt-12 grid gap-x-16 gap-y-10 lg:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.q}>
                <dt className="font-display text-xl leading-snug tracking-tight text-ink text-balance">
                  {faq.q}
                </dt>
                <dd className="mt-3 text-[0.9375rem] leading-[1.7] text-muted text-pretty">
                  {faq.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="gutter mx-auto max-w-[110rem] py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">At a glance</p>
            <h2 className="mt-4 font-display text-[2.25rem] leading-[1.05] tracking-tight text-ink text-balance">
              {trust.heading}
            </h2>
            <p className="mt-5 text-[0.9375rem] leading-relaxed text-muted text-pretty">
              {trust.body}
            </p>

            <Button asChild variant="primary" size="lg" className="mt-8">
              <Link href="/auctions">
                Explore auctions
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div>
            <DescriptionList
              items={[
                { label: "Currency", value: "Indian Rupees (₹)" },
                { label: "Registration", value: "Free" },
                { label: "Bid increments", value: "Published per lot" },
                { label: "Buyer's premium", value: "Stated per lot" },
                { label: "Anti-snipe extension", value: "Typically 2 minutes" },
                { label: "Payment terms", value: "5 business days" },
                { label: "Bid retraction", value: "Not permitted" },
                { label: "Bidder identities", value: "Masked in public history" },
              ]}
            />
          </div>
        </div>
      </section>
    </>
  );
}
