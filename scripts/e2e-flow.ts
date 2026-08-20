/**
 * End-to-end verification of the auction lifecycle.
 *
 * Drives the real domain layer — the same bidding engine and settlement code
 * the web app calls — rather than a stub, so a pass here means the flow the
 * product depends on genuinely works:
 *
 *   admin creates a lot → publishes it → bidders register → bids are placed
 *   → invalid bids are refused → a simultaneous bid race is resolved to a
 *   single winner → a late bid extends the close → a proxy ceiling executes
 *   → the lot settles → the winner, reserve outcome and notifications are
 *   correct → bidding after the hammer is refused.
 *
 * Run with:  npm run test:e2e-flow
 *
 * Works against the live dev database and cleans up everything it creates.
 */

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";
import { placeBid, minimumNextBid } from "../src/lib/bidding/engine";
import { settleAuction } from "../src/lib/auction/settlement";
import { effectiveStatus, canTransition } from "../src/lib/auction/status";
import { formatMoney, minor } from "../src/lib/money";

const prisma = new PrismaClient();

const inr = (rupees: number) => rupees * 100;
const TAG = `e2e-${Date.now().toString(36)}`;

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `\n      ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

async function main() {
  console.log(`\n\x1b[1mAuction lifecycle — end-to-end\x1b[0m  (run ${TAG})`);

  // ---------------------------------------------------------------------
  section("1. Admin creates and publishes a lot");
  // ---------------------------------------------------------------------

  const category = await prisma.category.create({
    data: {
      name: `E2E Department ${TAG}`,
      slug: `e2e-department-${TAG}`,
      status: "HIDDEN",
      fieldSchema: JSON.stringify([
        { key: "condition", label: "Condition", type: "text" },
      ]),
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "E2E Administrator",
      email: `admin-${TAG}@e2e.test`,
      passwordHash: await hashPassword("Saleroom!2026"),
      role: "AUCTION_MANAGER",
      emailVerifiedAt: new Date(),
    },
  });

  const RESERVE = inr(60_000);

  let auction = await prisma.auction.create({
    data: {
      lotNumber: `E2E-${TAG}`,
      title: "E2E Test Lot",
      slug: `e2e-test-lot-${TAG}`,
      categoryId: category.id,
      shortDescription: "A lot created by the end-to-end verification script.",
      description: "Created by scripts/e2e-flow.ts and removed when it finishes.",
      startingPrice: inr(50_000),
      minimumIncrement: inr(1_000),
      reservePrice: RESERVE,
      buyerPremiumBps: 1200,
      currency: "INR",
      startAt: new Date(Date.now() - 60_000),
      endAt: new Date(Date.now() + 60 * 60_000),
      originalEndAt: new Date(Date.now() + 60 * 60_000),
      status: "DRAFT",
      extensionEnabled: true,
      extensionThresholdSec: 120,
      extensionDurationSec: 120,
      proxyBiddingEnabled: true,
      createdById: admin.id,
      images: {
        create: [{ url: "/uploads/e2e.jpg", sortOrder: 0, isPrimary: true }],
      },
    },
  });

  check("lot is created as a DRAFT", auction.status === "DRAFT");
  check(
    "a DRAFT lot is not publicly biddable",
    effectiveStatus(auction) === "DRAFT",
  );

  // A draft must not accept bids even if someone knows its id.
  const bidder0 = await prisma.user.create({
    data: {
      name: "Probe Bidder",
      email: `probe-${TAG}@e2e.test`,
      passwordHash: await hashPassword("Collector!2026"),
      emailVerifiedAt: new Date(),
    },
  });

  const draftBid = await placeBid({
    auctionId: auction.id,
    userId: bidder0.id,
    amount: inr(50_000),
  });
  check(
    "a bid on a DRAFT lot is refused",
    !draftBid.ok,
    draftBid.ok ? "the engine accepted it" : undefined,
  );

  check(
    "the state machine forbids DRAFT → SOLD",
    !canTransition("DRAFT", "SOLD"),
  );
  check(
    "the state machine forbids ENDED → LIVE",
    !canTransition("ENDED", "LIVE"),
  );

  auction = await prisma.auction.update({
    where: { id: auction.id },
    data: { status: "LIVE", publishedAt: new Date() },
  });
  check("lot is published and live", effectiveStatus(auction) === "LIVE");

  // ---------------------------------------------------------------------
  section("2. Bidders register");
  // ---------------------------------------------------------------------

  // One hash, reused: scrypt is deliberately slow and this is not what the
  // script is testing.
  const bidderHash = await hashPassword("Collector!2026");

  const [alia, ben, chandra] = await Promise.all(
    ["alia", "ben", "chandra"].map((name) =>
      prisma.user.create({
        data: {
          name: `${name[0].toUpperCase()}${name.slice(1)} Tester`,
          email: `${name}-${TAG}@e2e.test`,
          passwordHash: bidderHash,
          emailVerifiedAt: new Date(),
        },
      }),
    ),
  );
  check("three bidders registered", Boolean(alia && ben && chandra));

  // ---------------------------------------------------------------------
  section("3. Bidding and validation");
  // ---------------------------------------------------------------------

  const first = await placeBid({
    auctionId: auction.id,
    userId: alia.id,
    amount: inr(50_000),
  });
  check(
    "first bid at the starting price is accepted",
    first.ok && first.currentBid === inr(50_000),
    first.ok ? undefined : first.message,
  );

  const belowStart = await placeBid({
    auctionId: auction.id,
    userId: ben.id,
    amount: inr(50_500),
  });
  check(
    "a bid below the next increment is refused",
    !belowStart.ok && belowStart.code === "BID_TOO_LOW",
    belowStart.ok ? "it was accepted" : `code ${belowStart.code}`,
  );

  const selfBid = await placeBid({
    auctionId: auction.id,
    userId: alia.id,
    amount: inr(52_000),
  });
  check(
    "the leading bidder cannot bid against themselves",
    !selfBid.ok && selfBid.code === "ALREADY_LEADING",
    selfBid.ok ? "it was accepted" : `code ${selfBid.code}`,
  );

  const second = await placeBid({
    auctionId: auction.id,
    userId: ben.id,
    amount: inr(51_000),
  });
  check(
    "a valid higher bid is accepted",
    second.ok && second.currentBid === inr(51_000),
    second.ok ? undefined : second.message,
  );

  const outbidNotice = await prisma.notification.findFirst({
    where: { userId: alia.id, type: "OUTBID" },
  });
  check("the outbid bidder is notified", outbidNotice !== null);

  const negative = await placeBid({
    auctionId: auction.id,
    userId: chandra.id,
    amount: -100,
  });
  check(
    "a negative bid is refused",
    !negative.ok && negative.code === "INVALID_AMOUNT",
  );

  const suspended = await prisma.user.create({
    data: {
      name: "Suspended Tester",
      email: `suspended-${TAG}@e2e.test`,
      passwordHash: await hashPassword("Collector!2026"),
      status: "SUSPENDED",
      emailVerifiedAt: new Date(),
    },
  });
  const suspendedBid = await placeBid({
    auctionId: auction.id,
    userId: suspended.id,
    amount: inr(80_000),
  });
  check(
    "a suspended account cannot bid",
    !suspendedBid.ok && suspendedBid.code === "ACCOUNT_SUSPENDED",
  );

  // ---------------------------------------------------------------------
  section("4. Simultaneous bids — the race");
  // ---------------------------------------------------------------------

  const current = await prisma.auction.findUniqueOrThrow({
    where: { id: auction.id },
    select: { currentBid: true, startingPrice: true, minimumIncrement: true },
  });
  const contested = minimumNextBid({
    currentBid: minor(current.currentBid),
    startingPrice: minor(current.startingPrice),
    minimumIncrement: minor(current.minimumIncrement),
  });

  // Two bidders fire the identical amount at the same instant.
  const race = await Promise.all([
    placeBid({ auctionId: auction.id, userId: alia.id, amount: contested }),
    placeBid({ auctionId: auction.id, userId: chandra.id, amount: contested }),
  ]);

  const winners = race.filter((result) => result.ok);
  const losers = race.filter((result) => !result.ok);

  check(
    "exactly one of two simultaneous equal bids is accepted",
    winners.length === 1,
    `accepted ${winners.length}`,
  );
  check(
    "the loser is told the price moved, not silently dropped",
    losers.length === 1 &&
      !losers[0].ok &&
      ["CONCURRENT_UPDATE", "BID_TOO_LOW", "ALREADY_LEADING"].includes(
        losers[0].code,
      ),
    losers.length === 1 && !losers[0].ok ? `code ${losers[0].code}` : undefined,
  );

  const afterRace = await prisma.auction.findUniqueOrThrow({
    where: { id: auction.id },
    select: { currentBid: true, bidCount: true, highestBidderId: true },
  });
  const bidRows = await prisma.bid.count({ where: { auctionId: auction.id } });
  check(
    "bidCount matches the number of bid rows",
    afterRace.bidCount === bidRows,
    `counter ${afterRace.bidCount}, rows ${bidRows}`,
  );
  check(
    "the standing bid equals the highest bid on record",
    minor(afterRace.currentBid) === contested,
  );

  const duplicateAmounts = await prisma.bid.groupBy({
    by: ["amount"],
    where: { auctionId: auction.id },
    _count: { _all: true },
    having: { amount: { _count: { gt: 1 } } },
  });
  check(
    "no two bids share an amount on the same lot",
    duplicateAmounts.length === 0,
  );

  // ---------------------------------------------------------------------
  section("5. Proxy bidding");
  // ---------------------------------------------------------------------

  const leaderBefore = afterRace.highestBidderId;
  const challenger = leaderBefore === alia.id ? ben : alia;
  const ceilingHolder = leaderBefore === alia.id ? chandra : ben;

  // The ceiling holder leaves a maximum well above the current price.
  const stateBefore = await prisma.auction.findUniqueOrThrow({
    where: { id: auction.id },
    select: { currentBid: true, startingPrice: true, minimumIncrement: true },
  });
  const nextNow = minimumNextBid({
    currentBid: minor(stateBefore.currentBid),
    startingPrice: minor(stateBefore.startingPrice),
    minimumIncrement: minor(stateBefore.minimumIncrement),
  });

  if (ceilingHolder.id !== leaderBefore) {
    const withCeiling = await placeBid({
      auctionId: auction.id,
      userId: ceilingHolder.id,
      amount: nextNow,
      maxAmount: inr(70_000),
    });
    check(
      "a bid with a standing maximum is accepted",
      withCeiling.ok,
      withCeiling.ok ? undefined : withCeiling.message,
    );

    const stateMid = await prisma.auction.findUniqueOrThrow({
      where: { id: auction.id },
      select: { currentBid: true, startingPrice: true, minimumIncrement: true },
    });
    const challengeAmount = minimumNextBid({
      currentBid: minor(stateMid.currentBid),
      startingPrice: minor(stateMid.startingPrice),
      minimumIncrement: minor(stateMid.minimumIncrement),
    });

    // A challenger bids below the ceiling; the proxy should reclaim the lead.
    const challenge = await placeBid({
      auctionId: auction.id,
      userId: challenger.id,
      amount: challengeAmount,
    });

    const afterProxy = await prisma.auction.findUniqueOrThrow({
      where: { id: auction.id },
      select: { currentBid: true, highestBidderId: true },
    });

    check(
      "a challenge below a standing maximum is answered automatically",
      afterProxy.highestBidderId === ceilingHolder.id,
      `leader is ${afterProxy.highestBidderId}, expected ${ceilingHolder.id}`,
    );
    const proxyPrice = minor(afterProxy.currentBid) ?? 0;
    check(
      "the proxy bids the smallest winning step, not its ceiling",
      proxyPrice < inr(70_000),
      `price is ${formatMoney(proxyPrice)}`,
    );
    check(
      "the challenger is told they were outbid by the proxy",
      challenge.ok && challenge.outbidByProxy,
    );

    const autoBid = await prisma.bid.findFirst({
      where: { auctionId: auction.id, isAutoBid: true },
    });
    check("the automatic bid is recorded in the ledger", autoBid !== null);
  }

  // ---------------------------------------------------------------------
  section("6. Anti-snipe extension");
  // ---------------------------------------------------------------------

  // Move the close to 30 seconds away — inside the 120s trigger window.
  const closeSoon = new Date(Date.now() + 30_000);
  await prisma.auction.update({
    where: { id: auction.id },
    data: { endAt: closeSoon, originalEndAt: closeSoon },
  });

  const beforeExtension = await prisma.auction.findUniqueOrThrow({
    where: { id: auction.id },
    select: {
      endAt: true,
      currentBid: true,
      startingPrice: true,
      minimumIncrement: true,
      highestBidderId: true,
      extensionCount: true,
    },
  });

  const lateBidder =
    beforeExtension.highestBidderId === alia.id ? ben : alia;
  const lateAmount = minimumNextBid({
    currentBid: minor(beforeExtension.currentBid),
    startingPrice: minor(beforeExtension.startingPrice),
    minimumIncrement: minor(beforeExtension.minimumIncrement),
  });

  const lateBid = await placeBid({
    auctionId: auction.id,
    userId: lateBidder.id,
    amount: lateAmount,
  });

  const afterExtension = await prisma.auction.findUniqueOrThrow({
    where: { id: auction.id },
    select: { endAt: true, status: true, extensionCount: true, originalEndAt: true },
  });

  check(
    "a bid inside the closing window extends the lot",
    afterExtension.endAt.getTime() > beforeExtension.endAt.getTime(),
    `${beforeExtension.endAt.toISOString()} → ${afterExtension.endAt.toISOString()}`,
  );
  check(
    "the extension is reported to the bidder",
    lateBid.ok && lateBid.extended,
  );
  check(
    "the lot is marked EXTENDED",
    afterExtension.status === "EXTENDED",
    `status is ${afterExtension.status}`,
  );
  check(
    "the extension counter increments",
    afterExtension.extensionCount === beforeExtension.extensionCount + 1,
  );
  check(
    "the originally scheduled close is preserved",
    afterExtension.originalEndAt.getTime() === closeSoon.getTime(),
  );

  // ---------------------------------------------------------------------
  section("7. Settlement — reserve met");
  // ---------------------------------------------------------------------

  // Drive bidding past the reserve so this section exercises a *sold* lot.
  // (The unsold path is covered separately in section 9.)
  for (let round = 0; round < 40; round++) {
    const state = await prisma.auction.findUniqueOrThrow({
      where: { id: auction.id },
      select: {
        currentBid: true,
        startingPrice: true,
        minimumIncrement: true,
        highestBidderId: true,
      },
    });
    if ((minor(state.currentBid) ?? 0) >= RESERVE) break;

    const next = minimumNextBid({
      currentBid: minor(state.currentBid),
      startingPrice: minor(state.startingPrice),
      minimumIncrement: minor(state.minimumIncrement),
    });
    // Alternate bidders — the engine refuses a bidder who already leads.
    const bidder = state.highestBidderId === alia.id ? ben : alia;
    const result = await placeBid({
      auctionId: auction.id,
      userId: bidder.id,
      amount: next,
    });
    if (!result.ok) break;
  }

  const preSettle = await prisma.auction.findUniqueOrThrow({
    where: { id: auction.id },
    select: { currentBid: true, highestBidderId: true, buyerPremiumBps: true },
  });
  const hammer = minor(preSettle.currentBid) ?? 0;

  check(
    "the standing bid has cleared the reserve",
    hammer >= RESERVE,
    `${formatMoney(hammer)} vs reserve ${formatMoney(RESERVE)}`,
  );

  // Closing early is exactly what the admin "Close now" control does.
  const outcome = await settleAuction(auction.id, { force: true });

  check("the lot settles as SOLD", outcome.status === "SOLD", `got ${outcome.status}`);
  check(
    "the winner is the highest bidder",
    outcome.winnerId === preSettle.highestBidderId,
  );

  const winner = await prisma.winner.findUnique({
    where: { auctionId: auction.id },
  });
  check("a winner record is created", winner !== null);

  if (winner) {
    const premium = Math.round((hammer * preSettle.buyerPremiumBps) / 10_000);
    check(
      "the winning amount matches the hammer price",
      minor(winner.winningAmount) === hammer,
    );
    check(
      "the buyer's premium is calculated correctly",
      minor(winner.buyerPremium) === premium,
      `${minor(winner.buyerPremium)} vs expected ${premium}`,
    );
    check(
      "the total due is hammer plus premium",
      minor(winner.totalDue) === hammer + premium,
    );
    check(
      "the settlement starts as payment pending",
      winner.status === "PAYMENT_PENDING",
    );
  }

  const winningBid = await prisma.bid.findFirst({
    where: { auctionId: auction.id, status: "WON" },
  });
  check("exactly the winning bid is marked WON", winningBid !== null);

  const stillWinning = await prisma.bid.count({
    where: { auctionId: auction.id, status: "WINNING" },
  });
  check("no bid is left in a WINNING state after settlement", stillWinning === 0);

  const wonNotice = outcome.winnerId
    ? await prisma.notification.findFirst({
        where: { userId: outcome.winnerId, type: "AUCTION_WON" },
      })
    : null;
  check("the winner is notified", wonNotice !== null);
  check(
    "the win notification links to the payment page",
    wonNotice?.href === `/payment/${auction.id}`,
  );

  const lostNotices = await prisma.notification.count({
    where: { type: "AUCTION_LOST", user: { email: { contains: TAG } } },
  });
  check("underbidders are notified", lostNotices > 0);

  const activeProxies = await prisma.proxyBid.count({
    where: { auctionId: auction.id, active: true },
  });
  check("standing maximums are retired on settlement", activeProxies === 0);

  // ---------------------------------------------------------------------
  section("8. After the hammer");
  // ---------------------------------------------------------------------

  const lateAttempt = await placeBid({
    auctionId: auction.id,
    userId: chandra.id,
    amount: inr(500_000),
  });
  check(
    "a bid after the lot closes is refused",
    !lateAttempt.ok && ["CLOSED", "NOT_LIVE"].includes(lateAttempt.code),
    lateAttempt.ok ? "it was accepted" : `code ${lateAttempt.code}`,
  );

  const doubleSettle = await settleAuction(auction.id, { force: true });
  check(
    "settling an already-settled lot is a no-op",
    doubleSettle.status === "SKIPPED",
    `got ${doubleSettle.status}`,
  );

  const winnerCount = await prisma.winner.count({
    where: { auctionId: auction.id },
  });
  check("settlement is idempotent — one winner only", winnerCount === 1);

  // ---------------------------------------------------------------------
  section("9. Settlement — reserve not met");
  // ---------------------------------------------------------------------

  const unsoldLot = await prisma.auction.create({
    data: {
      lotNumber: `E2E-U-${TAG}`,
      title: "E2E Unsold Lot",
      slug: `e2e-unsold-lot-${TAG}`,
      categoryId: category.id,
      shortDescription: "Reserve deliberately above what bidding will reach.",
      description: "Created by the end-to-end script.",
      startingPrice: inr(10_000),
      minimumIncrement: inr(1_000),
      reservePrice: inr(100_000),
      currency: "INR",
      startAt: new Date(Date.now() - 60_000),
      endAt: new Date(Date.now() + 60 * 60_000),
      originalEndAt: new Date(Date.now() + 60 * 60_000),
      status: "LIVE",
      extensionEnabled: false,
      createdById: admin.id,
    },
  });

  const lowBid = await placeBid({
    auctionId: unsoldLot.id,
    userId: alia.id,
    amount: inr(10_000),
  });
  check("a bid below the reserve is still accepted", lowBid.ok);

  const unsoldOutcome = await settleAuction(unsoldLot.id, { force: true });
  check(
    "a lot closing below its reserve is UNSOLD",
    unsoldOutcome.status === "UNSOLD",
    `got ${unsoldOutcome.status}`,
  );
  check("no winner is recorded for an unsold lot", !unsoldOutcome.winnerId);

  const unsoldWinner = await prisma.winner.findUnique({
    where: { auctionId: unsoldLot.id },
  });
  check("no settlement row exists for an unsold lot", unsoldWinner === null);

  const noReserveLot = await prisma.auction.create({
    data: {
      lotNumber: `E2E-N-${TAG}`,
      title: "E2E No-Reserve Lot",
      slug: `e2e-no-reserve-lot-${TAG}`,
      categoryId: category.id,
      shortDescription: "No reserve — the first valid bid takes it.",
      description: "Created by the end-to-end script.",
      startingPrice: inr(5_000),
      minimumIncrement: inr(500),
      reservePrice: null,
      currency: "INR",
      startAt: new Date(Date.now() - 60_000),
      endAt: new Date(Date.now() + 60 * 60_000),
      originalEndAt: new Date(Date.now() + 60 * 60_000),
      status: "LIVE",
      extensionEnabled: false,
      createdById: admin.id,
    },
  });

  await placeBid({
    auctionId: noReserveLot.id,
    userId: ben.id,
    amount: inr(5_000),
  });
  const noReserveOutcome = await settleAuction(noReserveLot.id, { force: true });
  check(
    "a no-reserve lot with a bid sells",
    noReserveOutcome.status === "SOLD",
    `got ${noReserveOutcome.status}`,
  );

  const noBidsLot = await prisma.auction.create({
    data: {
      lotNumber: `E2E-Z-${TAG}`,
      title: "E2E No-Bids Lot",
      slug: `e2e-no-bids-lot-${TAG}`,
      categoryId: category.id,
      shortDescription: "Closes without a single bid.",
      description: "Created by the end-to-end script.",
      startingPrice: inr(5_000),
      minimumIncrement: inr(500),
      currency: "INR",
      startAt: new Date(Date.now() - 60_000),
      endAt: new Date(Date.now() + 60 * 60_000),
      originalEndAt: new Date(Date.now() + 60 * 60_000),
      status: "LIVE",
      extensionEnabled: false,
      createdById: admin.id,
    },
  });
  const noBidsOutcome = await settleAuction(noBidsLot.id, { force: true });
  check(
    "a lot that receives no bids closes UNSOLD",
    noBidsOutcome.status === "UNSOLD",
    `got ${noBidsOutcome.status}`,
  );

  // ---------------------------------------------------------------------
  section("10. Cleanup");
  // ---------------------------------------------------------------------

  const auctionIds = [auction.id, unsoldLot.id, noReserveLot.id, noBidsLot.id];
  await prisma.notification.deleteMany({
    where: { user: { email: { contains: TAG } } },
  });
  await prisma.payment.deleteMany({ where: { auctionId: { in: auctionIds } } });
  await prisma.winner.deleteMany({ where: { auctionId: { in: auctionIds } } });
  await prisma.bid.deleteMany({ where: { auctionId: { in: auctionIds } } });
  await prisma.proxyBid.deleteMany({ where: { auctionId: { in: auctionIds } } });
  await prisma.watchlist.deleteMany({ where: { auctionId: { in: auctionIds } } });
  await prisma.auctionImage.deleteMany({ where: { auctionId: { in: auctionIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: auctionIds } } });
  await prisma.auction.deleteMany({ where: { id: { in: auctionIds } } });
  await prisma.user.deleteMany({ where: { email: { contains: TAG } } });
  await prisma.category.delete({ where: { id: category.id } });

  const leftover = await prisma.auction.count({
    where: { lotNumber: { contains: TAG } },
  });
  check("test data is removed", leftover === 0);

  // ---------------------------------------------------------------------
  console.log(
    `\n${"─".repeat(52)}\n` +
      `  \x1b[32m${passed} passed\x1b[0m` +
      (failed > 0 ? `   \x1b[31m${failed} failed\x1b[0m` : "") +
      `\n${"─".repeat(52)}\n`,
  );

  if (failed > 0) {
    console.log("Failures:");
    for (const failure of failures) console.log(`  · ${failure}`);
    console.log("");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("\n\x1b[31mThe run aborted:\x1b[0m", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
