"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Ban,
  Copy,
  ExternalLink,
  Gavel,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Send,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";

import {
  auctionLifecycle,
  deleteAuction,
  duplicateAuction,
  reconcileAuction,
} from "@/app/actions/admin/auctions";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { Permission } from "@/lib/auth/rbac";
import type { AuctionStatus } from "@/lib/validation/enums";
import { cn } from "@/lib/utils";

type Confirmation = {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  run: () => Promise<{ ok: boolean; message?: string }>;
};

/**
 * Row-level operations.
 *
 * The menu only offers transitions the state machine actually permits, so an
 * operator is never presented with an action the server will refuse. Anything
 * irreversible — cancelling a live sale, deleting a lot, closing early —
 * passes through a confirmation naming the consequence.
 */
export function AuctionRowActions({
  auction,
  permissions,
  align = "end",
}: {
  auction: {
    id: string;
    slug: string;
    lotNumber: string;
    title: string;
    status: string;
    bidCount: number;
    featured: boolean;
  };
  permissions: Permission[];
  align?: "start" | "end";
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirmation, setConfirmation] = React.useState<Confirmation | null>(null);
  const [pending, setPending] = React.useState(false);

  const status = auction.status as AuctionStatus;
  const may = (permission: Permission) => permissions.includes(permission);

  async function run(
    task: () => Promise<{ ok: boolean; message?: string }>,
    fallback = "Done.",
  ) {
    setPending(true);
    const result = await task();
    setPending(false);
    setConfirmation(null);

    if (result.ok) {
      toast.success(result.message ?? fallback);
      router.refresh();
    } else {
      toast.error("Not applied", result.message ?? "That action was refused.");
    }
  }

  const canPublish = status === "DRAFT" && may("auction.publish");
  const canUnpublish =
    status === "UPCOMING" && auction.bidCount === 0 && may("auction.publish");
  const canStart = status === "UPCOMING" && may("auction.lifecycle");
  const canEnd =
    (status === "LIVE" || status === "EXTENDED") && may("auction.lifecycle");
  const canCancel =
    !["SOLD", "UNSOLD", "CANCELLED", "ENDED"].includes(status) &&
    may("auction.lifecycle");
  const canDelete =
    auction.bidCount === 0 &&
    ["DRAFT", "UPCOMING", "CANCELLED"].includes(status) &&
    may("auction.delete");
  const canEdit =
    !["SOLD", "UNSOLD", "CANCELLED"].includes(status) && may("auction.update");

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={`Actions for lot ${auction.lotNumber}`}
          className="inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align={align}
            sideOffset={6}
            className={cn(
              "z-50 min-w-56 overflow-hidden rounded-sm border border-line bg-surface py-1 shadow-lift",
              "data-[state=open]:animate-[fade-in_0.14s_ease-out]",
            )}
          >
            <Item asChild>
              <Link href={`/admin/auctions/${auction.id}`}>
                <Pencil className="size-3.5" />
                {canEdit ? "Edit lot" : "View lot"}
              </Link>
            </Item>

            <Item asChild>
              <Link href={`/auction/${auction.slug}`} target="_blank">
                <ExternalLink className="size-3.5" />
                View on site
              </Link>
            </Item>

            <Separator />

            {canPublish ? (
              <Item onSelect={() => run(() => auctionLifecycle({ id: auction.id, action: "publish" }))}>
                <Send className="size-3.5" />
                Publish
              </Item>
            ) : null}

            {canUnpublish ? (
              <Item onSelect={() => run(() => auctionLifecycle({ id: auction.id, action: "unpublish" }))}>
                <Undo2 className="size-3.5" />
                Return to draft
              </Item>
            ) : null}

            {canStart ? (
              <Item
                onSelect={() =>
                  setConfirmation({
                    title: "Open bidding now?",
                    description: (
                      <>
                        Lot {auction.lotNumber} will open immediately and its
                        scheduled start time will be moved to now. Bidders
                        watching the lot will be notified.
                      </>
                    ),
                    confirmLabel: "Open bidding",
                    run: () => auctionLifecycle({ id: auction.id, action: "start" }),
                  })
                }
              >
                <Gavel className="size-3.5" />
                Open bidding now
              </Item>
            ) : null}

            {canEnd ? (
              <Item
                onSelect={() =>
                  setConfirmation({
                    title: "Close this lot now?",
                    description: (
                      <>
                        Bidding on lot {auction.lotNumber} closes immediately.
                        The highest valid bid wins if the reserve is met; if not,
                        the lot closes unsold. This cannot be undone.
                      </>
                    ),
                    confirmLabel: "Close the lot",
                    destructive: true,
                    run: () => auctionLifecycle({ id: auction.id, action: "end" }),
                  })
                }
              >
                <Gavel className="size-3.5" />
                Close now
              </Item>
            ) : null}

            {may("auction.update") ? (
              <Item
                onSelect={() =>
                  run(() =>
                    auctionLifecycle({
                      id: auction.id,
                      action: auction.featured ? "unfeature" : "feature",
                    }),
                  )
                }
              >
                <Star className={cn("size-3.5", auction.featured && "fill-accent text-accent")} />
                {auction.featured ? "Remove from featured" : "Mark as featured"}
              </Item>
            ) : null}

            {may("auction.view") ? (
              <Item onSelect={() => run(() => reconcileAuction(auction.id))}>
                <RefreshCw className="size-3.5" />
                Refresh status
              </Item>
            ) : null}

            {may("auction.create") ? (
              <Item onSelect={() => run(() => duplicateAuction(auction.id))}>
                <Copy className="size-3.5" />
                Duplicate
              </Item>
            ) : null}

            {canCancel || canDelete ? <Separator /> : null}

            {canCancel ? (
              <Item
                destructive
                onSelect={() =>
                  setConfirmation({
                    title: "Withdraw this lot from sale?",
                    description: (
                      <>
                        Lot {auction.lotNumber} — {auction.title} will be
                        cancelled and removed from the public catalogue.
                        {auction.bidCount > 0
                          ? ` Its ${auction.bidCount} bids are retained for the record, and no sale will be made.`
                          : ""}{" "}
                        A cancelled lot cannot be reopened.
                      </>
                    ),
                    confirmLabel: "Withdraw lot",
                    destructive: true,
                    run: () => auctionLifecycle({ id: auction.id, action: "cancel" }),
                  })
                }
              >
                <Ban className="size-3.5" />
                Withdraw from sale
              </Item>
            ) : null}

            {canDelete ? (
              <Item
                destructive
                onSelect={() =>
                  setConfirmation({
                    title: "Delete this lot permanently?",
                    description: (
                      <>
                        Lot {auction.lotNumber} — {auction.title} and its images
                        will be removed. This cannot be undone.
                      </>
                    ),
                    confirmLabel: "Delete permanently",
                    destructive: true,
                    run: () => deleteAuction(auction.id),
                  })
                }
              >
                <Trash2 className="size-3.5" />
                Delete
              </Item>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => !open && setConfirmation(null)}
        title={confirmation?.title ?? ""}
        description={confirmation?.description ?? ""}
        confirmLabel={confirmation?.confirmLabel}
        destructive={confirmation?.destructive}
        pending={pending}
        onConfirm={() => confirmation && run(confirmation.run)}
      />
    </>
  );
}

function Item({
  children,
  destructive,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.Item> & {
  destructive?: boolean;
}) {
  return (
    <DropdownMenu.Item
      {...props}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[0.8125rem] outline-none transition-colors",
        destructive
          ? "text-live data-[highlighted]:bg-live-wash"
          : "text-ink-soft data-[highlighted]:bg-sunken data-[highlighted]:text-ink",
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}

function Separator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}
