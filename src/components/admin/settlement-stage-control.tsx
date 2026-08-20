"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

import { setSettlementStatus } from "@/app/actions/admin/users";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  SETTLEMENT_STAGES,
  STAGE_LABELS,
  type SettlementStage,
} from "@/lib/admin/settlement-stages";
import { cn } from "@/lib/utils";

const TONE: Record<SettlementStage, string> = {
  PAYMENT_PENDING: "border-caution/35 bg-caution-wash text-caution",
  PAYMENT_COMPLETED: "border-positive/35 bg-positive-wash text-positive",
  ORDER_PROCESSING: "border-line-strong text-ink-soft",
  COMPLETED: "border-accent/40 bg-accent-wash text-accent-deep",
  CANCELLED: "border-line-strong text-faint line-through",
};

/**
 * Advances a settlement through the fulfilment pipeline.
 *
 * Marking a lot paid by hand, or cancelling a sale, are consequential enough
 * to confirm — the first can release goods against money that never arrived,
 * the second unwinds a completed sale.
 */
export function SettlementStageControl({
  winnerId,
  status,
  lotNumber,
}: {
  winnerId: string;
  status: SettlementStage;
  lotNumber: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);
  const [target, setTarget] = React.useState<SettlementStage | null>(null);

  async function apply(stage: SettlementStage) {
    setPending(true);
    const result = await setSettlementStatus({ winnerId, status: stage });
    setPending(false);
    setTarget(null);

    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error("Not applied", result.message);
    }
  }

  const needsConfirmation = (stage: SettlementStage) =>
    stage === "PAYMENT_COMPLETED" || stage === "CANCELLED";

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          disabled={pending}
          aria-label={`Change stage for lot ${lotNumber}`}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] border px-2 py-1 text-[0.6875rem] font-medium transition-opacity hover:opacity-80 disabled:opacity-50",
            TONE[status],
          )}
        >
          {STAGE_LABELS[status]}
          <ChevronDown className="size-3" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 min-w-52 overflow-hidden rounded-sm border border-line bg-surface py-1 shadow-lift"
          >
            {SETTLEMENT_STAGES.map((stage) => (
              <DropdownMenu.Item
                key={stage}
                disabled={stage === status}
                onSelect={() =>
                  needsConfirmation(stage) ? setTarget(stage) : apply(stage)
                }
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[0.8125rem] outline-none transition-colors",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
                  stage === "CANCELLED"
                    ? "text-live data-[highlighted]:bg-live-wash"
                    : "text-ink-soft data-[highlighted]:bg-sunken data-[highlighted]:text-ink",
                )}
              >
                {stage === status ? (
                  <Check className="size-3.5" />
                ) : (
                  <span className="size-3.5" />
                )}
                {STAGE_LABELS[stage]}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={
          target === "CANCELLED"
            ? `Cancel the sale of lot ${lotNumber}?`
            : `Mark lot ${lotNumber} as paid?`
        }
        description={
          target === "CANCELLED" ? (
            <>
              The sale will be recorded as cancelled and the buyer will no longer
              be able to settle it. The lot is not automatically re-offered. This
              is written to the audit log.
            </>
          ) : (
            <>
              Only do this once funds have actually cleared. Marking a lot paid
              releases it for collection and despatch, and the buyer&rsquo;s
              outstanding balance is cleared.
            </>
          )
        }
        confirmLabel={target === "CANCELLED" ? "Cancel the sale" : "Mark as paid"}
        destructive={target === "CANCELLED"}
        pending={pending}
        onConfirm={() => target && apply(target)}
      />
    </>
  );
}
