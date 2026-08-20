"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/auth/guards";
import { destroyAllSessions } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { UserRole } from "@/lib/validation/enums";

export type UserActionResult = { ok: boolean; message: string };

/* -------------------------------------------------------------------------- */
/* Account status                                                              */
/* -------------------------------------------------------------------------- */

export async function setUserStatus(
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<UserActionResult> {
  const actor = await assertPermission("user.manage");

  if (userId === actor.id) {
    return { ok: false, message: "You cannot change your own account status." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!target) return { ok: false, message: "That account no longer exists." };

  // Only a Super Admin may act on another administrator.
  if (target.role !== "BIDDER" && actor.role !== "SUPER_ADMIN") {
    return {
      ok: false,
      message: "Only a Super Admin can change an administrator's account.",
    };
  }

  await prisma.user.update({ where: { id: userId }, data: { status } });

  // Suspension must take effect immediately, not when the cookie expires.
  if (status === "SUSPENDED") await destroyAllSessions(userId);

  await recordAudit({
    actorId: actor.id,
    action: status === "SUSPENDED" ? "user.suspend" : "user.reactivate",
    entityType: "user",
    entityId: userId,
    metadata: { email: target.email, from: target.status, to: status },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);

  return {
    ok: true,
    message:
      status === "SUSPENDED"
        ? `${target.name} has been suspended and signed out everywhere.`
        : `${target.name} has been reactivated.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Roles                                                                       */
/* -------------------------------------------------------------------------- */

const roleInput = z.object({
  userId: z.string().min(1),
  role: UserRole,
});

export async function setUserRole(
  raw: z.input<typeof roleInput>,
): Promise<UserActionResult> {
  // Granting privilege is the most sensitive action in the console, so it is
  // restricted to Super Admins regardless of `user.manage`.
  const actor = await assertPermission("user.manage");
  if (actor.role !== "SUPER_ADMIN") {
    return { ok: false, message: "Only a Super Admin can change roles." };
  }

  const parsed = roleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Unrecognised role." };
  const { userId, role } = parsed.data;

  if (userId === actor.id) {
    return { ok: false, message: "You cannot change your own role." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true },
  });
  if (!target) return { ok: false, message: "That account no longer exists." };

  if (target.role === role) {
    return { ok: true, message: "No change — already that role." };
  }

  // Never let the last Super Admin be demoted; that locks everyone out.
  if (target.role === "SUPER_ADMIN") {
    const remaining = await prisma.user.count({
      where: { role: "SUPER_ADMIN", status: "ACTIVE", id: { not: userId } },
    });
    if (remaining === 0) {
      return {
        ok: false,
        message: "This is the only active Super Admin — promote someone else first.",
      };
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  // A role change alters capabilities, so existing sessions are re-established.
  await destroyAllSessions(userId);

  await recordAudit({
    actorId: actor.id,
    action: "user.role_change",
    entityType: "user",
    entityId: userId,
    metadata: { email: target.email, from: target.role, to: role },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);

  return { ok: true, message: `${target.name} is now a ${role.replace(/_/g, " ").toLowerCase()}.` };
}

/* -------------------------------------------------------------------------- */
/* Settlement status                                                           */
/* -------------------------------------------------------------------------- */

const settlementInput = z.object({
  winnerId: z.string().min(1),
  status: z.enum([
    "PAYMENT_PENDING",
    "PAYMENT_COMPLETED",
    "ORDER_PROCESSING",
    "COMPLETED",
    "CANCELLED",
  ]),
});

export async function setSettlementStatus(
  raw: z.input<typeof settlementInput>,
): Promise<UserActionResult> {
  const actor = await assertPermission("settlement.manage");

  const parsed = settlementInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Unrecognised status." };

  const winner = await prisma.winner.findUnique({
    where: { id: parsed.data.winnerId },
    select: { id: true, status: true, auctionId: true, auction: { select: { lotNumber: true } } },
  });
  if (!winner) return { ok: false, message: "That settlement no longer exists." };

  await prisma.winner.update({
    where: { id: winner.id },
    data: { status: parsed.data.status },
  });

  await recordAudit({
    actorId: actor.id,
    action: "winner.status_change",
    entityType: "winner",
    entityId: winner.id,
    metadata: {
      lotNumber: winner.auction.lotNumber,
      from: winner.status,
      to: parsed.data.status,
    },
  });

  revalidatePath("/admin/settlements");
  revalidatePath(`/payment/${winner.auctionId}`);

  return { ok: true, message: "Settlement status updated." };
}
