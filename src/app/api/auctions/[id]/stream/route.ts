import { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { subscribe, type AuctionEvent } from "@/lib/realtime/bus";
import { effectiveStatus } from "@/lib/auction/status";
import { minimumNextBid } from "@/lib/bidding/engine";
import { minor } from "@/lib/money";

// Server-Sent Events need a long-lived Node response, not the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

/**
 * Live bid feed for one lot.
 *
 * SSE rather than WebSockets: the traffic is one-directional (the server tells
 * viewers what happened), it survives proxies that mangle upgrades, and the
 * browser reconnects on its own. Bids themselves go through the server action,
 * so this channel is read-only by construction.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auction = await prisma.auction.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      currentBid: true,
      startingPrice: true,
      minimumIncrement: true,
      bidCount: true,
    },
  });

  if (!auction) {
    return new Response("Not found", { status: 404 });
  }

  const currentBid = minor(auction.currentBid);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      // Opening frame carries the authoritative state, so a client that
      // reconnects after a dropped connection re-syncs immediately.
      send("sync", {
        auctionId: auction.id,
        currentBid: currentBid,
        bidCount: auction.bidCount,
        minimumNextBid: minimumNextBid({
          currentBid,
          startingPrice: minor(auction.startingPrice),
          minimumIncrement: minor(auction.minimumIncrement),
        }),
        endAt: auction.endAt.toISOString(),
        status: effectiveStatus(auction),
        at: new Date().toISOString(),
      });

      const unsubscribe = subscribe(id, (event: AuctionEvent) => {
        send(event.type, event);
      });

      // Comment frames keep intermediaries from reaping an idle connection.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
        }
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed by the runtime */
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
