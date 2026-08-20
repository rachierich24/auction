import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Package, Receipt, Truck } from "lucide-react";

import { CheckoutPanel } from "@/components/payment/checkout-panel";
import { Badge, DescriptionList } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/guards";
import { getSettlement } from "@/lib/account/queries";
import { formatBps, formatMoney } from "@/lib/money";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Settlement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Settlement stages. The lot moves left to right and never back.
 */
const STAGES = [
  { key: "PAYMENT_PENDING", label: "Auction won" },
  { key: "PAYMENT_COMPLETED", label: "Payment completed" },
  { key: "ORDER_PROCESSING", label: "Order processing" },
  { key: "COMPLETED", label: "Completed" },
] as const;

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  const user = await requireUser(`/payment/${auctionId}`);

  // Scoped to the signed-in winner — anyone else gets a 404 rather than a
  // "forbidden", which would confirm the settlement exists.
  const settlement = await getSettlement(auctionId, user.id);
  if (!settlement) notFound();

  const currentStage = Math.max(
    0,
    STAGES.findIndex((stage) => stage.key === settlement.status),
  );
  const paid = settlement.status !== "PAYMENT_PENDING";

  return (
    <div className="gutter mx-auto max-w-5xl py-12 md:py-16">
      <nav aria-label="Breadcrumb" className="mb-8 text-[0.75rem] text-muted">
        <Link href="/profile?tab=won" className="hover:text-ink">
          My account
        </Link>
        <span className="mx-2 text-line-strong">/</span>
        <span className="text-faint">Settlement</span>
      </nav>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-sm bg-sunken">
          {settlement.auction.image ? (
            <Image
              src={settlement.auction.image}
              alt=""
              fill
              sizes="7rem"
              className="object-cover"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="eyebrow">Lot {settlement.auction.lotNumber}</p>
          <h1 className="mt-3 font-display text-[2rem] leading-[1.1] tracking-tight text-ink sm:text-[2.5rem] text-balance">
            {settlement.auction.title}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-3 text-[0.8125rem] text-muted">
            <Badge tone={paid ? "positive" : "caution"}>
              {settlement.status.replace(/_/g, " ").toLowerCase()}
            </Badge>
            <span>
              Won {formatDateTime(settlement.createdAt, { dateStyle: "long" })}
            </span>
          </p>
        </div>
      </div>

      {/* Progress */}
      <ol className="mt-12 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-4">
        {STAGES.map((stage, index) => {
          const done = index <= currentStage;
          const active = index === currentStage;
          return (
            <li
              key={stage.key}
              className={cn(
                "flex items-center gap-3 bg-surface px-4 py-4",
                active && "bg-accent-wash",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold tabular",
                  done
                    ? "bg-accent text-white"
                    : "border border-line-strong text-faint",
                )}
              >
                {done && index < currentStage ? (
                  <Check className="size-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "text-[0.8125rem]",
                  done ? "text-ink" : "text-faint",
                )}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        {/* Invoice */}
        <section>
          <h2 className="flex items-center gap-2 font-display text-xl tracking-tight text-ink">
            <Receipt className="size-4 text-accent" />
            Invoice
          </h2>

          <div className="mt-5 overflow-hidden rounded-sm border border-line bg-surface">
            <dl className="divide-y divide-line">
              <Row
                label="Hammer price"
                value={formatMoney(settlement.winningAmount, settlement.auction.currency)}
              />
              <Row
                label={`Buyer's premium (${formatBps(settlement.auction.buyerPremiumBps)})`}
                value={formatMoney(settlement.buyerPremium, settlement.auction.currency)}
              />
              <div className="flex items-baseline justify-between gap-4 bg-raised px-5 py-4">
                <dt className="font-display text-lg text-ink">Total due</dt>
                <dd className="font-display text-2xl leading-none text-ink tabular">
                  {formatMoney(settlement.totalDue, settlement.auction.currency)}
                </dd>
              </div>
            </dl>
          </div>

          {settlement.payments.length > 0 ? (
            <div className="mt-8">
              <h3 className="eyebrow mb-3">Payment history</h3>
              <ul className="overflow-hidden rounded-sm border border-line bg-surface">
                {settlement.payments.map((payment, index) => (
                  <li
                    key={payment.id}
                    className={cn(
                      "flex items-center justify-between gap-4 px-5 py-3.5",
                      index > 0 && "border-t border-line",
                    )}
                  >
                    <div>
                      <p className="text-[0.8125rem] text-ink tabular">
                        {formatMoney(payment.amount, settlement.auction.currency)}
                      </p>
                      <p className="mt-0.5 text-[0.75rem] text-faint">
                        {payment.provider} ·{" "}
                        {formatDateTime(payment.createdAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <Badge
                      tone={
                        payment.status === "PAID"
                          ? "positive"
                          : payment.status === "FAILED"
                            ? "live"
                            : "neutral"
                      }
                    >
                      {payment.status.toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <InfoCard
              icon={<Truck className="size-4" />}
              title="Delivery"
              body={
                settlement.auction.shippingNote ??
                "Once payment clears, the saleroom will contact you to arrange shipping or collection. Collection in person is free of charge."
              }
            />
            <InfoCard
              icon={<Package className="size-4" />}
              title="Collection"
              body={
                settlement.auction.location
                  ? `Held at our ${settlement.auction.location} premises. Collection by appointment, weekdays 10:00–18:00 IST.`
                  : "Collection by appointment, weekdays 10:00–18:00 IST."
              }
            />
          </div>
        </section>

        {/* Checkout */}
        <div>
          <CheckoutPanel
            auctionId={settlement.auction.id}
            totalDue={settlement.totalDue}
            currency={settlement.auction.currency}
            alreadyPaid={paid}
            lotNumber={settlement.auction.lotNumber}
          />

          <DescriptionList
            className="mt-8"
            items={[
              { label: "Lot", value: settlement.auction.lotNumber },
              {
                label: "Sale closed",
                value: formatDateTime(settlement.auction.endAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              },
              {
                label: "Payment terms",
                value: "Due within 5 business days",
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="text-[0.8125rem] text-muted">{label}</dt>
      <dd className="text-[0.9375rem] text-ink tabular">{value}</dd>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-sm border border-line bg-surface p-5">
      <p className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-[0.1em] text-faint">
        <span className="text-accent">{icon}</span>
        {title}
      </p>
      <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted text-pretty">
        {body}
      </p>
    </div>
  );
}
