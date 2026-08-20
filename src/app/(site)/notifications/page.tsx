import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";

import { NotificationActions } from "@/components/account/notification-actions";
import { EmptyState, SectionHeading } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/guards";
import { getNotifications } from "@/lib/account/queries";
import type { NotificationType } from "@/lib/validation/enums";
import { cn, relativeTime, safePage } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TONE: Record<NotificationType, string> = {
  BID_PLACED: "bg-positive",
  OUTBID: "bg-live",
  ENDING_SOON: "bg-caution",
  AUCTION_WON: "bg-accent",
  AUCTION_LOST: "bg-line-strong",
  PAYMENT_REMINDER: "bg-caution",
  AUCTION_STARTING: "bg-accent",
  SYSTEM: "bg-line-strong",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser("/notifications");
  const page = safePage(params.page);

  const { notifications, total, unread, pageCount } = await getNotifications(
    user.id,
    page,
  );

  return (
    <div className="gutter mx-auto max-w-4xl py-12 md:py-16">
      <SectionHeading
        eyebrow="Your account"
        title="Notifications"
        description={
          unread > 0
            ? `${unread} unread of ${total}.`
            : "You are up to date."
        }
        action={unread > 0 ? <NotificationActions /> : null}
      />

      <div className="mt-10">
        {notifications.length === 0 ? (
          <EmptyState
            icon={<BellOff className="size-7" strokeWidth={1.25} />}
            title="Nothing yet"
            description="Bid confirmations, outbid alerts and closing reminders will appear here."
          />
        ) : (
          <ol className="overflow-hidden rounded-sm border border-line bg-surface">
            {notifications.map((notification, index) => {
              const body = (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      TONE[notification.type as NotificationType] ?? "bg-line-strong",
                      notification.readAt && "opacity-30",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[0.875rem]",
                        notification.readAt
                          ? "text-ink-soft"
                          : "font-medium text-ink",
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted text-pretty">
                      {notification.message}
                    </p>
                    <p className="mt-1.5 text-[0.75rem] text-faint">
                      {relativeTime(notification.createdAt)}
                    </p>
                  </div>
                </>
              );

              return (
                <li
                  key={notification.id}
                  className={cn(
                    "flex gap-3.5 px-4 py-4 sm:px-5",
                    index > 0 && "border-t border-line",
                    !notification.readAt && "bg-accent-wash/35",
                  )}
                >
                  {notification.href ? (
                    <Link
                      href={notification.href}
                      className="flex flex-1 gap-3.5 transition-opacity hover:opacity-80"
                    >
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <Pagination
          className="mt-4"
          page={page}
          pageCount={pageCount}
          total={total}
          buildHref={(next) => `/notifications?page=${next}`}
        />
      </div>
    </div>
  );
}
