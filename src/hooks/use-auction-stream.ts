"use client";

import * as React from "react";

export type LiveState = {
  currentBid: number | null;
  bidCount: number;
  minimumNextBid: number;
  endAt: string;
  status: string;
  /** Set when the last change came from another bidder, for the flash animation. */
  lastEventAt: number;
  lastBidderId: string | null;
  lastBidderLabel: string | null;
  connected: boolean;
};

type Options = {
  auctionId: string;
  initial: Omit<LiveState, "lastEventAt" | "lastBidderId" | "lastBidderLabel" | "connected">;
  onBid?: (event: { bidderId: string; bidderLabel: string; amount: number }) => void;
  onExtended?: (endAt: string) => void;
  onStatus?: (status: string) => void;
  /** Stop listening once the lot is settled. */
  enabled?: boolean;
};

/**
 * Subscribes to the lot's SSE feed and mirrors the server's authoritative
 * figures. State only ever moves forward from what the server sends; the hook
 * never computes a price or a status itself.
 */
export function useAuctionStream({
  auctionId,
  initial,
  onBid,
  onExtended,
  onStatus,
  enabled = true,
}: Options) {
  const [state, setState] = React.useState<LiveState>({
    ...initial,
    lastEventAt: 0,
    lastBidderId: null,
    lastBidderLabel: null,
    connected: false,
  });

  // Callbacks are held in a ref so a parent re-render does not tear down and
  // rebuild the EventSource on every keystroke.
  const handlers = React.useRef({ onBid, onExtended, onStatus });
  React.useEffect(() => {
    handlers.current = { onBid, onExtended, onStatus };
  }, [onBid, onExtended, onStatus]);

  React.useEffect(() => {
    if (!enabled) return;

    const source = new EventSource(`/api/auctions/${auctionId}/stream`);

    const onOpen = () => setState((s) => ({ ...s, connected: true }));
    const onError = () => setState((s) => ({ ...s, connected: false }));

    const onSync = (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data);
      setState((s) => ({
        ...s,
        currentBid: data.currentBid,
        bidCount: data.bidCount,
        minimumNextBid: data.minimumNextBid,
        endAt: data.endAt,
        status: data.status,
        connected: true,
      }));
    };

    const onBidEvent = (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data);
      setState((s) => ({
        ...s,
        currentBid: data.currentBid,
        bidCount: data.bidCount,
        minimumNextBid: data.minimumNextBid,
        endAt: data.endAt,
        status: data.status,
        lastEventAt: Date.now(),
        lastBidderId: data.bidderId,
        lastBidderLabel: data.bidderLabel,
        connected: true,
      }));
      handlers.current.onBid?.({
        bidderId: data.bidderId,
        bidderLabel: data.bidderLabel,
        amount: data.currentBid,
      });
    };

    const onExtendedEvent = (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data);
      setState((s) => ({ ...s, endAt: data.endAt, status: data.status }));
      handlers.current.onExtended?.(data.endAt);
    };

    const onStatusEvent = (event: MessageEvent<string>) => {
      const data = JSON.parse(event.data);
      setState((s) => ({ ...s, status: data.status, endAt: data.endAt }));
      handlers.current.onStatus?.(data.status);
    };

    source.addEventListener("open", onOpen);
    source.addEventListener("error", onError);
    source.addEventListener("sync", onSync as EventListener);
    source.addEventListener("bid", onBidEvent as EventListener);
    source.addEventListener("extended", onExtendedEvent as EventListener);
    source.addEventListener("status", onStatusEvent as EventListener);

    return () => {
      source.removeEventListener("open", onOpen);
      source.removeEventListener("error", onError);
      source.removeEventListener("sync", onSync as EventListener);
      source.removeEventListener("bid", onBidEvent as EventListener);
      source.removeEventListener("extended", onExtendedEvent as EventListener);
      source.removeEventListener("status", onStatusEvent as EventListener);
      source.close();
    };
  }, [auctionId, enabled]);

  /** Applied after this viewer's own bid, so the panel updates without waiting. */
  const applyLocal = React.useCallback(
    (patch: Partial<Omit<LiveState, "connected">>) => {
      setState((s) => ({ ...s, ...patch }));
    },
    [],
  );

  return { state, applyLocal };
}
