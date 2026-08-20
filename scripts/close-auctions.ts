/**
 * Manual runner for the scheduled settlement pass.
 *
 * Identical to what /api/cron executes, for use in development or from an
 * external scheduler that prefers a command to an HTTP call.
 *
 *   npm run close:auctions
 */

import { PrismaClient } from "@prisma/client";

import { runScheduledTasks } from "../src/lib/auction/settlement";

const prisma = new PrismaClient();

async function main() {
  const started = Date.now();
  const result = await runScheduledTasks(new Date());

  console.log(`
Scheduled tasks — ${result.at}
  Opened for bidding   ${result.opened}
  Closed and settled   ${result.closed.length}
  Closing warnings     ${result.warned}
  Duration             ${Date.now() - started}ms`);

  for (const outcome of result.closed) {
    console.log(
      `    Lot ${outcome.lotNumber}: ${outcome.status}` +
        (outcome.winningAmount
          ? ` at ${(outcome.winningAmount / 100).toLocaleString("en-IN")}`
          : ""),
    );
  }
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
