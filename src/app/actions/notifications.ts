"use server";

import { revalidatePath } from "next/cache";

import { assertUser } from "@/lib/auth/guards";
import { markRead } from "@/lib/notifications/service";

export async function markAllNotificationsRead(): Promise<{
  ok: boolean;
  count: number;
}> {
  const user = await assertUser();
  // Scoped to the caller inside markRead — a user can never mark someone
  // else's notifications read.
  const count = await markRead(user.id);
  revalidatePath("/notifications");
  return { ok: true, count };
}
