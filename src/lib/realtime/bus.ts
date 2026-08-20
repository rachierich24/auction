import "server-only";

/**
 * In-process pub/sub backing the Server-Sent Events stream at
 * /api/auctions/[id]/stream.
 *
 * A single Node process needs nothing more than this. When the app is scaled
 * across instances, replace the two functions below with a Redis pub/sub or
 * Supabase Realtime channel — every caller goes through `publish`/`subscribe`,
 * so nothing else in the codebase changes.
 */

export type AuctionEvent =
  | {
      type: "bid";
      auctionId: string;
      currentBid: number;
      bidCount: number;
      minimumNextBid: number;
      endAt: string;
      status: string;
      bidderLabel: string;
      bidderId: string;
      isAutoBid: boolean;
      at: string;
    }
  | {
      type: "extended";
      auctionId: string;
      endAt: string;
      status: string;
      extensionCount: number;
      at: string;
    }
  | {
      type: "status";
      auctionId: string;
      status: string;
      endAt: string;
      at: string;
    };

type Listener = (event: AuctionEvent) => void;

const globalForBus = globalThis as unknown as {
  __auctionBus?: Map<string, Set<Listener>>;
};

const channels: Map<string, Set<Listener>> =
  globalForBus.__auctionBus ?? new Map();
globalForBus.__auctionBus = channels;

export function subscribe(auctionId: string, listener: Listener): () => void {
  let set = channels.get(auctionId);
  if (!set) {
    set = new Set();
    channels.set(auctionId, set);
  }
  set.add(listener);

  return () => {
    const current = channels.get(auctionId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) channels.delete(auctionId);
  };
}

export function publish(event: AuctionEvent): void {
  const set = channels.get(event.auctionId);
  if (!set) return;
  for (const listener of set) {
    // One broken stream must never stop the others from being notified.
    try {
      listener(event);
    } catch {
      /* the listener's own cleanup will drop it */
    }
  }
}

export function subscriberCount(auctionId: string): number {
  return channels.get(auctionId)?.size ?? 0;
}
