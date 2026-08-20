import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Gavel, Heart, ScrollText, Trophy } from "lucide-react";

import { ChangePasswordForm, ProfileDetailsForm } from "@/components/auth/auth-forms";
import { Countdown } from "@/components/auction/countdown";
import { StatusBadge } from "@/components/auction/status-badge";
import { Button } from "@/components/ui/button";
import {
  Alert,
  Badge,
  EmptyState,
  SectionHeading,
} from "@/components/ui/primitives";
import { Pagination, Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VerifyEmailPrompt } from "@/components/account/verify-email-prompt";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  getAccountSummary,
  getActiveBids,
  getBidLedger,
  getLostLots,
  getWatchlist,
  getWonLots,
  type AccountLot,
} from "@/lib/account/queries";
import { formatMoney } from "@/lib/money";
import { cn, formatDateTime, safePage } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TABS = {
  activity: "Bidding activity",
  won: "Won lots",
  lost: "Closed lots",
  watchlist: "Watchlist",
  history: "Bid history",
  details: "Personal details",
} as const;

type Tab = keyof typeof TABS;

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser("/profile");

  const tab: Tab = params.tab && params.tab in TABS ? (params.tab as Tab) : "activity";
  const page = safePage(params.page);

  const [summary, profile] = await Promise.all([
    getAccountSummary(user.id),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, phone: true, createdAt: true, emailVerifiedAt: true },
    }),
  ]);

  return (
    <div className="gutter mx-auto max-w-[110rem] py-12 md:py-16">
      {params.welcome ? (
        <Alert tone="positive" title="Welcome to the saleroom" className="mb-8">
          Your account is created. Confirm your email address to complete
          registration — the link is in your inbox.
        </Alert>
      ) : null}

      {params.reset ? (
        <Alert tone="positive" className="mb-8">
          Your password has been changed and other devices were signed out.
        </Alert>
      ) : null}

      {!user.emailVerified ? <VerifyEmailPrompt className="mb-8" /> : null}

      <SectionHeading
        eyebrow="Account"
        title={profile?.name ?? user.name}
        description={`Registered ${formatDateTime(profile?.createdAt ?? new Date(), { dateStyle: "long" })}`}
        action={
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        }
      />

      {/* Summary tiles */}
      <dl className="mt-10 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        <Tile
          icon={<Gavel className="size-4" />}
          label="Active lots"
          value={String(summary.activeCount)}
        />
        <Tile
          icon={<Trophy className="size-4" />}
          label="Lots won"
          value={String(summary.wonCount)}
        />
        <Tile
          icon={<Heart className="size-4" />}
          label="Watching"
          value={String(summary.watchCount)}
        />
        <Tile
          icon={<ScrollText className="size-4" />}
          label="Bids placed"
          value={String(summary.bidCount)}
        />
        <Tile
          label="Outstanding"
          value={formatMoney(summary.outstanding, "INR")}
          tone={summary.outstanding > 0 ? "caution" : "default"}
        />
      </dl>

      {/* Tabs */}
      <nav className="hide-scrollbar mt-10 flex gap-1 overflow-x-auto border-b border-line">
        {(Object.entries(TABS) as [Tab, string][]).map(([key, label]) => (
          <Link
            key={key}
            href={`/profile?tab=${key}`}
            scroll={false}
            className={cn(
              "relative shrink-0 px-4 py-3 text-[0.8125rem] transition-colors",
              tab === key
                ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent"
                : "text-muted hover:text-ink",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-10">
        {tab === "activity" ? <ActivityTab userId={user.id} /> : null}
        {tab === "won" ? <WonTab userId={user.id} /> : null}
        {tab === "lost" ? <LostTab userId={user.id} /> : null}
        {tab === "watchlist" ? <WatchlistTab userId={user.id} /> : null}
        {tab === "history" ? <HistoryTab userId={user.id} page={page} /> : null}
        {tab === "details" ? (
          <DetailsTab
            name={profile?.name ?? user.name}
            email={profile?.email ?? user.email}
            phone={profile?.phone ?? ""}
          />
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Tile({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "caution";
}) {
  return (
    <div className="bg-surface p-5">
      <dt className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-[0.1em] text-faint">
        {icon}
        {label}
      </dt>
      <dd
        className={cn(
          "mt-2 font-display text-2xl leading-none tracking-tight tabular",
          tone === "caution" ? "text-caution" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

async function ActivityTab({ userId }: { userId: string }) {
  const bids = await getActiveBids(userId);

  if (bids.length === 0) {
    return (
      <EmptyState
        icon={<Gavel className="size-7" strokeWidth={1.25} />}
        title="No active bids"
        description="You are not currently bidding on any open lot."
        action={
          <Button asChild variant="primary">
            <Link href="/auctions?status=live">Browse live lots</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="space-y-3">
      {bids.map((bid) => (
        <li
          key={bid.id}
          className="flex flex-col gap-4 rounded-sm border border-line bg-surface p-4 sm:flex-row sm:items-center"
        >
          <LotThumb lot={bid} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={bid.status} />
              {bid.leading ? (
                <Badge tone="positive">Leading</Badge>
              ) : (
                <Badge tone="live">Outbid</Badge>
              )}
              {bid.maximum ? (
                <Badge tone="outline">
                  Max {formatMoney(bid.maximum, bid.currency)}
                </Badge>
              ) : null}
            </div>
            <h3 className="mt-2 font-display text-lg leading-snug text-ink">
              <Link href={`/auction/${bid.slug}`} className="hover:text-accent-deep">
                {bid.title}
              </Link>
            </h3>
            <p className="mt-1 text-[0.75rem] text-faint">Lot {bid.lotNumber}</p>
          </div>

          <div className="flex shrink-0 items-end gap-8 sm:flex-col sm:items-end sm:gap-1">
            <div className="text-right">
              <p className="text-[0.625rem] uppercase tracking-[0.1em] text-faint">
                Your bid
              </p>
              <p className="font-display text-lg leading-none text-ink tabular">
                {formatMoney(bid.myBid, bid.currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.625rem] uppercase tracking-[0.1em] text-faint">
                Current
              </p>
              <p className="text-[0.875rem] text-ink-soft tabular">
                {formatMoney(bid.currentBid, bid.currency)}
              </p>
            </div>
            <Countdown endAt={bid.endAt} className="text-[0.75rem]" prefix="Closes in" />
          </div>
        </li>
      ))}
    </ul>
  );
}

async function WonTab({ userId }: { userId: string }) {
  const wins = await getWonLots(userId);

  if (wins.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="size-7" strokeWidth={1.25} />}
        title="No lots won yet"
        description="Lots you win will appear here with their invoice and settlement status."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {wins.map((win) => (
        <li
          key={win.id}
          className="flex flex-col gap-4 rounded-sm border border-line bg-surface p-4 sm:flex-row sm:items-center"
        >
          <LotThumb lot={win} />

          <div className="min-w-0 flex-1">
            <Badge tone={win.paid ? "positive" : "caution"}>
              {win.settlementStatus.replace(/_/g, " ").toLowerCase()}
            </Badge>
            <h3 className="mt-2 font-display text-lg leading-snug text-ink">
              <Link href={`/auction/${win.slug}`} className="hover:text-accent-deep">
                {win.title}
              </Link>
            </h3>
            <p className="mt-1 text-[0.75rem] text-faint">
              Lot {win.lotNumber} · Hammer {formatMoney(win.winningAmount, win.currency)}{" "}
              · Premium {formatMoney(win.buyerPremium, win.currency)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-6">
            <div className="text-right">
              <p className="text-[0.625rem] uppercase tracking-[0.1em] text-faint">
                Total due
              </p>
              <p className="font-display text-xl leading-none text-ink tabular">
                {formatMoney(win.totalDue, win.currency)}
              </p>
            </div>
            {win.paid ? (
              <Badge tone="positive">Settled</Badge>
            ) : (
              <Button asChild variant="accent" size="sm">
                <Link href={`/payment/${win.id}`}>Pay now</Link>
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

async function LostTab({ userId }: { userId: string }) {
  const lots = await getLostLots(userId);

  if (lots.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        description="Closed lots you bid on without winning will be listed here."
      />
    );
  }

  return (
    <TableWrap>
      <Table>
        <THead>
          <TR>
            <TH>Lot</TH>
            <TH>Status</TH>
            <TH align="right">Your highest bid</TH>
            <TH align="right">Hammer</TH>
            <TH align="right">Closed</TH>
          </TR>
        </THead>
        <TBody>
          {lots.map((lot) => (
            <TR key={lot.id}>
              <TD>
                <Link
                  href={`/auction/${lot.slug}`}
                  className="font-medium text-ink hover:text-accent-deep"
                >
                  {lot.title}
                </Link>
                <span className="ml-2 text-[0.75rem] text-faint">
                  Lot {lot.lotNumber}
                </span>
              </TD>
              <TD>
                <StatusBadge status={lot.status} />
              </TD>
              <TD align="right" className="tabular">
                {formatMoney(lot.myBid, lot.currency)}
              </TD>
              <TD align="right" className="tabular">
                {formatMoney(lot.hammer, lot.currency)}
              </TD>
              <TD align="right" className="text-[0.75rem] text-faint">
                {formatDateTime(lot.endAt, { dateStyle: "medium" })}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}

async function WatchlistTab({ userId }: { userId: string }) {
  const lots = await getWatchlist(userId);

  if (lots.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="size-7" strokeWidth={1.25} />}
        title="Your watchlist is empty"
        description="Add lots to your watchlist and we will notify you when they open and before they close."
        action={
          <Button asChild variant="primary">
            <Link href="/auctions">Browse the catalogue</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {lots.map((lot) => (
        <li
          key={lot.id}
          className="flex items-center gap-4 rounded-sm border border-line bg-surface p-4"
        >
          <LotThumb lot={lot} />
          <div className="min-w-0 flex-1">
            <StatusBadge status={lot.status} />
            <h3 className="mt-2 truncate font-display text-base text-ink">
              <Link href={`/auction/${lot.slug}`} className="hover:text-accent-deep">
                {lot.title}
              </Link>
            </h3>
            <p className="mt-1 text-[0.75rem] text-faint tabular">
              {formatMoney(lot.currentBid, lot.currency)} ·{" "}
              <Countdown endAt={lot.endAt} className="text-[0.75rem]" />
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

async function HistoryTab({ userId, page }: { userId: string; page: number }) {
  const ledger = await getBidLedger(userId, page);

  if (ledger.entries.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText className="size-7" strokeWidth={1.25} />}
        title="No bids yet"
        description="Every bid you place will be recorded here."
      />
    );
  }

  return (
    <>
      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Placed</TH>
              <TH>Lot</TH>
              <TH align="right">Amount</TH>
              <TH>Outcome</TH>
            </TR>
          </THead>
          <TBody>
            {ledger.entries.map((entry) => (
              <TR key={entry.id}>
                <TD className="whitespace-nowrap text-[0.75rem] text-faint">
                  {formatDateTime(entry.createdAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </TD>
                <TD>
                  <Link
                    href={`/auction/${entry.lot.slug}`}
                    className="font-medium text-ink hover:text-accent-deep"
                  >
                    {entry.lot.title}
                  </Link>
                  <span className="ml-2 text-[0.75rem] text-faint">
                    Lot {entry.lot.lotNumber}
                  </span>
                  {entry.isAutoBid ? (
                    <Badge tone="outline" className="ml-2">
                      Auto
                    </Badge>
                  ) : null}
                </TD>
                <TD align="right" className="tabular">
                  {formatMoney(entry.amount, entry.currency)}
                </TD>
                <TD>
                  <Badge
                    tone={
                      entry.status === "WON"
                        ? "positive"
                        : entry.status === "WINNING"
                          ? "accent"
                          : "neutral"
                    }
                  >
                    {entry.status.toLowerCase()}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>

      <Pagination
        className="mt-4"
        page={page}
        pageCount={ledger.pageCount}
        total={ledger.total}
        buildHref={(next) => `/profile?tab=history&page=${next}`}
      />
    </>
  );
}

function DetailsTab({
  name,
  email,
  phone,
}: {
  name: string;
  email: string;
  phone: string;
}) {
  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <section>
        <h2 className="font-display text-xl tracking-tight text-ink">
          Personal details
        </h2>
        <p className="mt-2 text-[0.8125rem] text-muted">
          Used on invoices and for saleroom correspondence.
        </p>
        <div className="mt-6">
          <ProfileDetailsForm name={name} email={email} phone={phone} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl tracking-tight text-ink">Password</h2>
        <p className="mt-2 text-[0.8125rem] text-muted">
          Changing your password signs out every other device on your account.
        </p>
        <div className="mt-6">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}

function LotThumb({ lot }: { lot: AccountLot }) {
  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-sm bg-sunken">
      {lot.image ? (
        <Image src={lot.image} alt="" fill sizes="4rem" className="object-cover" />
      ) : null}
    </div>
  );
}
