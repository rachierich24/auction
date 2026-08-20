"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldCheck } from "lucide-react";

import { confirmPayment, createCheckout } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/money";

/**
 * Gateway-agnostic checkout.
 *
 * The panel asks the server for a checkout session and then hands control to
 * whichever provider is configured. With the development gateway it simulates
 * the callback locally; with Razorpay or Cashfree this is where their widget
 * is mounted. Either way the browser never states the amount — the server
 * computes it from the winner record and verifies the callback signature.
 */
export function CheckoutPanel({
  auctionId,
  totalDue,
  currency,
  alreadyPaid,
  lotNumber,
}: {
  auctionId: string;
  totalDue: number;
  currency: string;
  alreadyPaid: boolean;
  lotNumber: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [stage, setStage] = React.useState<
    "idle" | "creating" | "confirming" | "done"
  >("idle");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (alreadyPaid) {
    return (
      <div className="rounded-sm border border-positive/25 bg-positive-wash p-6">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-positive text-white">
          <Check className="size-4" />
        </span>
        <h2 className="mt-4 font-display text-xl tracking-tight text-positive">
          Payment received
        </h2>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-positive/85">
          Settlement for Lot {lotNumber} is complete. The saleroom will be in
          touch to arrange delivery or collection.
        </p>
      </div>
    );
  }

  async function pay() {
    setError(null);
    setStage("creating");

    const session = await createCheckout(auctionId);

    if (!session.ok || !session.paymentId || !session.orderId) {
      setStage("idle");
      setError(session.message ?? "Could not start checkout.");
      return;
    }

    if (!session.isMock) {
      // Real gateway: mount the provider's widget here with session.checkout,
      // then call confirmPayment with whatever it returns.
      setStage("idle");
      setError(
        `The ${session.provider} gateway is configured but its checkout widget is not mounted in this build.`,
      );
      return;
    }

    setStage("confirming");

    const result = await confirmPayment(session.paymentId, {
      orderId: session.orderId,
      paymentId: `mock_pay_${session.paymentId}`,
      signature: session.mockSignature ?? "",
    });

    if (!result.ok) {
      setStage("idle");
      setError(result.message);
      toast.error("Payment not completed", result.message);
      return;
    }

    setStage("done");
    setConfirmOpen(false);
    toast.success("Payment received", result.message);
    router.refresh();
  }

  const busy = stage === "creating" || stage === "confirming";

  return (
    <>
      <div className="rounded-sm border border-line bg-surface p-6 shadow-card">
        <p className="text-[0.6875rem] uppercase tracking-[0.11em] text-faint">
          Amount payable
        </p>
        <p className="mt-2 font-display text-[2.5rem] leading-none tracking-tight text-ink tabular">
          {formatMoney(totalDue, currency)}
        </p>

        <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted">
          Payment is due within 5 business days of the sale closing. The
          invoice above itemises the hammer price and buyer&rsquo;s premium
          separately.
        </p>

        {error ? (
          <Alert tone="critical" role="alert" className="mt-5">
            {error}
          </Alert>
        ) : null}

        <Button
          variant="accent"
          size="lg"
          className="mt-6 w-full"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {stage === "creating" ? "Preparing…" : "Confirming…"}
            </>
          ) : (
            "Pay now"
          )}
        </Button>

        <p className="mt-4 flex items-start gap-2 text-[0.75rem] leading-relaxed text-faint">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Card details are handled by the payment gateway and never reach this
          server.
        </p>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Confirm payment</DialogTitle>
            <DialogDescription>
              You are about to pay{" "}
              <strong className="font-medium text-ink tabular">
                {formatMoney(totalDue, currency)}
              </strong>{" "}
              in settlement of Lot {lotNumber}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button variant="accent" onClick={pay} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing…
                </>
              ) : (
                "Confirm and pay"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
