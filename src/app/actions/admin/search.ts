"use server";

import { assertPermission } from "@/lib/auth/guards";
import { adminSearch } from "@/lib/admin/queries";
import { can } from "@/lib/auth/rbac";

/**
 * Console search. Re-authorises on every call — being able to render the
 * palette is not authority to read its results — and returns only the
 * entity types the caller is actually allowed to open.
 */
export async function runAdminSearch(query: string) {
  const user = await assertPermission("admin.access");
  const results = await adminSearch(query.slice(0, 80));

  return {
    auctions: can(user.role, "auction.view") ? results.auctions : [],
    users: can(user.role, "user.view") ? results.users : [],
  };
}
