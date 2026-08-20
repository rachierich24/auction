"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";
import { stringifyJson } from "@/lib/db/json";
import { setContent, type ContentKey } from "@/lib/content/site-content";
import { categorySchema } from "@/lib/validation/auction";
import { slugify } from "@/lib/utils";

export type ContentResult = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  id?: string;
};

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[issue.path.join(".") || "form"] ??= issue.message;
  }
  return errors;
}

/* -------------------------------------------------------------------------- */
/* Homepage & marketing copy                                                   */
/* -------------------------------------------------------------------------- */

export async function updateSiteContent(
  key: ContentKey,
  value: unknown,
): Promise<ContentResult> {
  const actor = await assertPermission("content.manage");

  try {
    await setContent(key, value, actor.id);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, errors: fieldErrors(error) };
    }
    throw error;
  }

  await recordAudit({
    actorId: actor.id,
    action: "content.update",
    entityType: "site_content",
    entityId: key,
    metadata: { key },
  });

  // Content appears across the whole public site, so the shell is revalidated
  // rather than a single route.
  revalidatePath("/", "layout");

  return { ok: true, message: "Content updated. The site is live with it now." };
}

/* -------------------------------------------------------------------------- */
/* Departments                                                                 */
/* -------------------------------------------------------------------------- */

async function uniqueCategorySlug(base: string, excludeId?: string) {
  const root = slugify(base).slice(0, 70) || "department";
  let candidate = root;
  for (let attempt = 2; attempt < 40; attempt++) {
    const clash = await prisma.category.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash || clash.id === excludeId) return candidate;
    candidate = `${root}-${attempt}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function saveCategory(
  raw: unknown,
  id?: string,
): Promise<ContentResult> {
  const actor = await assertPermission("category.manage");

  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const data = parsed.data;

  // Specification keys must be unique within a department, or values collide.
  const keys = data.fieldSchema.map((field) => field.key);
  if (new Set(keys).size !== keys.length) {
    return {
      ok: false,
      errors: { fieldSchema: "Each specification key must be unique." },
    };
  }

  const slug = await uniqueCategorySlug(data.slug || data.name, id);

  const payload = {
    name: data.name,
    slug,
    description: data.description || null,
    image: data.image || null,
    status: data.status,
    sortOrder: data.sortOrder,
    fieldSchema: stringifyJson(data.fieldSchema),
  };

  const category = id
    ? await prisma.category.update({ where: { id }, data: payload, select: { id: true } })
    : await prisma.category.create({ data: payload, select: { id: true } });

  await recordAudit({
    actorId: actor.id,
    action: id ? "category.update" : "category.create",
    entityType: "category",
    entityId: category.id,
    metadata: { name: data.name, slug },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");

  return {
    ok: true,
    id: category.id,
    message: id ? "Department updated." : "Department created.",
  };
}

export async function deleteCategory(id: string): Promise<ContentResult> {
  const actor = await assertPermission("category.manage");

  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { auctions: true } } },
  });
  if (!category) return { ok: false, message: "That department no longer exists." };

  // Lots hold a required foreign key to their department, so deleting one that
  // is in use would orphan them. Hide it instead.
  if (category._count.auctions > 0) {
    return {
      ok: false,
      message: `${category.name} still holds ${category._count.auctions} lots. Move them first, or set the department to hidden.`,
    };
  }

  await prisma.category.delete({ where: { id } });

  await recordAudit({
    actorId: actor.id,
    action: "category.delete",
    entityType: "category",
    entityId: id,
    metadata: { name: category.name },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");

  return { ok: true, message: `${category.name} deleted.` };
}
