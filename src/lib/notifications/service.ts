import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { Tx } from "@/lib/db/prisma";
import type { NotificationType } from "@/lib/validation/enums";
import { sendEmail } from "@/lib/email/mailer";
import { formatMoney } from "@/lib/money";

type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  href?: string;
  /** Also deliver by email. In-app only when false. */
  email?: { subject: string; body: string };
  tx?: Tx;
};

export async function notify(input: NotifyInput): Promise<void> {
  const client = input.tx ?? prisma;

  await client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      href: input.href ?? null,
    },
  });

  if (input.email) {
    const user = await client.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true },
    });
    if (user) {
      // Fire-and-forget: a mail provider outage must not roll back a bid.
      void sendEmail({
        to: user.email,
        subject: input.email.subject,
        text: input.email.body,
      }).catch((error) =>
        console.error("[notifications] email delivery failed", error),
      );
    }
  }
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  for (const input of inputs) await notify(input);
}

// -- Typed helpers for each moment in the auction lifecycle ------------------

export async function notifyBidPlaced(args: {
  userId: string;
  auctionId: string;
  slug: string;
  lotNumber: string;
  title: string;
  amount: number;
  currency: string;
  tx?: Tx;
}) {
  return notify({
    userId: args.userId,
    type: "BID_PLACED",
    title: "Bid placed",
    message: `Your bid of ${formatMoney(args.amount, args.currency)} on Lot ${args.lotNumber} — ${args.title} is now the leading bid.`,
    href: `/auction/${args.slug}`,
    tx: args.tx,
  });
}

export async function notifyOutbid(args: {
  userId: string;
  slug: string;
  lotNumber: string;
  title: string;
  newAmount: number;
  currency: string;
  tx?: Tx;
}) {
  return notify({
    userId: args.userId,
    type: "OUTBID",
    title: "You have been outbid",
    message: `Lot ${args.lotNumber} — ${args.title} is now at ${formatMoney(args.newAmount, args.currency)}. Place a higher bid to lead again.`,
    href: `/auction/${args.slug}`,
    tx: args.tx,
    email: {
      subject: `You have been outbid on Lot ${args.lotNumber}`,
      body: `${args.title} has moved to ${formatMoney(args.newAmount, args.currency)}.\n\nView the lot: ${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auction/${args.slug}`,
    },
  });
}

export async function notifyWon(args: {
  userId: string;
  slug: string;
  auctionId: string;
  lotNumber: string;
  title: string;
  amount: number;
  currency: string;
  tx?: Tx;
}) {
  return notify({
    userId: args.userId,
    type: "AUCTION_WON",
    title: `Congratulations — you won Lot ${args.lotNumber}`,
    message: `You won ${args.title} with a bid of ${formatMoney(args.amount, args.currency)}. Complete payment to proceed.`,
    href: `/payment/${args.auctionId}`,
    tx: args.tx,
    email: {
      subject: `Congratulations! You won Lot ${args.lotNumber}`,
      body: `You are the successful bidder for ${args.title} at ${formatMoney(args.amount, args.currency)}.\n\nComplete payment: ${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/payment/${args.auctionId}`,
    },
  });
}

export async function notifyLost(args: {
  userId: string;
  slug: string;
  lotNumber: string;
  title: string;
  tx?: Tx;
}) {
  return notify({
    userId: args.userId,
    type: "AUCTION_LOST",
    title: `Lot ${args.lotNumber} closed`,
    message: `Bidding on ${args.title} has closed and your bid was not successful.`,
    href: `/auction/${args.slug}`,
    tx: args.tx,
  });
}

export async function notifyEndingSoon(args: {
  userId: string;
  slug: string;
  lotNumber: string;
  title: string;
  minutes: number;
  tx?: Tx;
}) {
  return notify({
    userId: args.userId,
    type: "ENDING_SOON",
    title: "A lot you are watching is closing",
    message: `Lot ${args.lotNumber} — ${args.title} closes in about ${args.minutes} minutes.`,
    href: `/auction/${args.slug}`,
    tx: args.tx,
  });
}

export async function notifyStartingSoon(args: {
  userId: string;
  slug: string;
  lotNumber: string;
  title: string;
  tx?: Tx;
}) {
  return notify({
    userId: args.userId,
    type: "AUCTION_STARTING",
    title: "A lot you are watching is opening",
    message: `Lot ${args.lotNumber} — ${args.title} is now open for bidding.`,
    href: `/auction/${args.slug}`,
    tx: args.tx,
  });
}

export async function notifyPaymentReminder(args: {
  userId: string;
  auctionId: string;
  lotNumber: string;
  title: string;
  totalDue: number;
  currency: string;
  tx?: Tx;
}) {
  return notify({
    userId: args.userId,
    type: "PAYMENT_REMINDER",
    title: "Payment pending",
    message: `${formatMoney(args.totalDue, args.currency)} is due for Lot ${args.lotNumber} — ${args.title}.`,
    href: `/payment/${args.auctionId}`,
    tx: args.tx,
  });
}

// -- Reads ------------------------------------------------------------------

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, ids?: string[]): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return count;
}
