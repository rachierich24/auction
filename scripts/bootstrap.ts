/**
 * Minimal first-run setup for an empty database.
 *
 * Creates one Super Admin with a generated email and password, and a single
 * department so the first lot has somewhere to live. Everything else is
 * created through the console.
 *
 * Unlike `prisma/seed.ts`, this script is **additive** — it deletes nothing and
 * is safe to point at a live database. It refuses to run if an administrator
 * already exists, so it cannot quietly mint a second one.
 *
 *   npm run bootstrap
 *   npm run bootstrap -- --force     # add another admin anyway
 */

import { randomBytes, randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

/**
 * Password built from an explicit charset rather than base64, so it always
 * satisfies the strength rules the sign-up form enforces and contains no
 * characters that get mangled when pasted out of a terminal.
 */
function generatePassword(length = 20): string {
  const lower = "abcdefghijkmnopqrstuvwxyz"; // no l
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
  const digits = "23456789"; // no 0, 1
  const all = lower + upper + digits;

  const chars = [
    lower[randomInt(lower.length)],
    upper[randomInt(upper.length)],
    digits[randomInt(digits.length)],
  ];
  while (chars.length < length) chars.push(all[randomInt(all.length)]);

  // Fisher–Yates, so the guaranteed characters are not always in front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function main() {
  const force = process.argv.includes("--force");

  const existing = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
    select: { email: true },
  });

  if (existing && !force) {
    console.log(`
An administrator already exists: ${existing.email}

Nothing was changed. To add another anyway:
  npm run bootstrap -- --force
`);
    return;
  }

  const email = `admin-${randomBytes(4).toString("hex")}@groovy.auction`;
  const password = generatePassword();

  const admin = await prisma.user.create({
    data: {
      name: "Saleroom Admin",
      email,
      passwordHash: await hashPassword(password),
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      // Self-created by the operator, so there is nothing to confirm.
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });

  // One department so the create-auction form has something to select.
  // More can be added at /admin/categories.
  const category = await prisma.category.upsert({
    where: { slug: "general" },
    create: {
      name: "General",
      slug: "general",
      description: "Uncategorised lots.",
      status: "ACTIVE",
      sortOrder: 0,
      fieldSchema: JSON.stringify([
        { key: "condition", label: "Condition", type: "text" },
        { key: "year", label: "Year", type: "text" },
      ]),
    },
    update: {},
    select: { name: true },
  });

  console.log(`
──────────────────────────────────────────────────────
  Setup complete
──────────────────────────────────────────────────────

  Sign in at /admin

    Email     ${email}
    Password  ${password}

  This password is shown once and is not stored anywhere
  in readable form. Save it now, then change it under
  Account → Password.

  Department created: ${category.name}
──────────────────────────────────────────────────────
`);

  void admin;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
