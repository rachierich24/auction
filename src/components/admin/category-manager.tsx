"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { deleteCategory, saveCategory } from "@/app/actions/admin/content";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  Alert,
  Badge,
  Field,
  Input,
  NativeSelect,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { parseJson } from "@/lib/db/json";
import type { CategoryField } from "@/lib/validation/auction";
import { cn, slugify } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  status: string;
  sortOrder: number;
  fieldSchema: string;
  auctionCount: number;
};

type Draft = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  status: "ACTIVE" | "HIDDEN";
  sortOrder: string;
  fieldSchema: CategoryField[];
};

function toDraft(category?: Category): Draft {
  if (!category) {
    return {
      name: "",
      slug: "",
      description: "",
      image: "",
      status: "ACTIVE",
      sortOrder: "0",
      fieldSchema: [],
    };
  }
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    image: category.image ?? "",
    status: category.status === "HIDDEN" ? "HIDDEN" : "ACTIVE",
    sortOrder: String(category.sortOrder),
    fieldSchema: parseJson<CategoryField[]>(category.fieldSchema, []),
  };
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const toast = useToast();

  const [selected, setSelected] = React.useState<string | "new" | null>(null);
  const [draft, setDraft] = React.useState<Draft>(toDraft());
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<Category | null>(null);

  function open(category?: Category) {
    setSelected(category?.id ?? "new");
    setDraft(toDraft(category));
    setErrors({});
  }

  async function save() {
    setPending(true);
    setErrors({});

    const result = await saveCategory(
      {
        name: draft.name,
        slug: draft.slug || slugify(draft.name),
        description: draft.description,
        image: draft.image,
        status: draft.status,
        sortOrder: Number(draft.sortOrder || 0),
        fieldSchema: draft.fieldSchema,
      },
      draft.id,
    );

    setPending(false);

    if (!result.ok) {
      setErrors(result.errors ?? {});
      toast.error("Not saved", result.message ?? "Check the highlighted fields.");
      return;
    }

    toast.success(result.message ?? "Saved.");
    setSelected(null);
    router.refresh();
  }

  async function remove(category: Category) {
    setPending(true);
    const result = await deleteCategory(category.id);
    setPending(false);
    setConfirmDelete(null);

    if (result.ok) {
      toast.success(result.message ?? "Deleted.");
      router.refresh();
    } else {
      toast.error("Not deleted", result.message ?? "");
    }
  }

  function updateField(index: number, patch: Partial<CategoryField>) {
    setDraft((current) => ({
      ...current,
      fieldSchema: current.fieldSchema.map((field, i) =>
        i === index ? { ...field, ...patch } : field,
      ),
    }));
  }

  return (
    <div className="space-y-6">
      {/* List */}
      <div className="overflow-hidden rounded-sm border border-line bg-surface">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[0.9375rem] font-semibold text-ink">
            {categories.length} departments
          </h2>
          <Button variant="primary" size="sm" onClick={() => open()}>
            <Plus className="size-4" />
            New department
          </Button>
        </header>

        <ul className="divide-y divide-line">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => open(category)}
                className={cn(
                  "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-raised",
                  selected === category.id && "bg-raised",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[0.875rem] font-medium text-ink">
                    {category.name}
                    {category.status === "HIDDEN" ? (
                      <Badge tone="neutral">hidden</Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-[0.75rem] text-faint">
                    /{category.slug} ·{" "}
                    {parseJson<CategoryField[]>(category.fieldSchema, []).length}{" "}
                    specification fields
                  </p>
                </div>
                <span className="shrink-0 text-[0.8125rem] text-muted tabular">
                  {category.auctionCount} lots
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Editor */}
      {selected ? (
        <div className="rounded-sm border border-line bg-surface p-6">
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-ink">
                {draft.id ? `Edit ${draft.name || "department"}` : "New department"}
              </h2>
              <p className="mt-1 text-[0.8125rem] text-muted">
                Specification fields defined here appear on the create-auction
                form and in each lot&rsquo;s specifications table.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-[0.75rem] text-muted hover:text-ink"
            >
              Close
            </button>
          </header>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="cat-name" required error={errors.name}>
              <Input
                id="cat-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((c) => ({
                    ...c,
                    name: event.target.value,
                    slug: c.id ? c.slug : slugify(event.target.value),
                  }))
                }
              />
            </Field>

            <Field label="Slug" htmlFor="cat-slug" error={errors.slug}>
              <Input
                id="cat-slug"
                value={draft.slug}
                onChange={(event) =>
                  setDraft((c) => ({ ...c, slug: event.target.value }))
                }
              />
            </Field>

            <Field label="Status" htmlFor="cat-status">
              <NativeSelect
                id="cat-status"
                value={draft.status}
                onChange={(event) =>
                  setDraft((c) => ({
                    ...c,
                    status: event.target.value as "ACTIVE" | "HIDDEN",
                  }))
                }
              >
                <option value="ACTIVE">Active — visible on the site</option>
                <option value="HIDDEN">Hidden — not shown publicly</option>
              </NativeSelect>
            </Field>

            <Field label="Sort order" htmlFor="cat-order" error={errors.sortOrder}>
              <Input
                id="cat-order"
                inputMode="numeric"
                className="tabular"
                value={draft.sortOrder}
                onChange={(event) =>
                  setDraft((c) => ({
                    ...c,
                    sortOrder: event.target.value.replace(/\D/g, ""),
                  }))
                }
              />
            </Field>

            <Field
              label="Description"
              htmlFor="cat-description"
              className="sm:col-span-2"
              error={errors.description}
            >
              <Textarea
                id="cat-description"
                rows={2}
                value={draft.description}
                onChange={(event) =>
                  setDraft((c) => ({ ...c, description: event.target.value }))
                }
              />
            </Field>

            <Field
              label="Image URL"
              htmlFor="cat-image"
              className="sm:col-span-2"
              error={errors.image}
              hint="Used on department listings."
            >
              <Input
                id="cat-image"
                value={draft.image}
                onChange={(event) =>
                  setDraft((c) => ({ ...c, image: event.target.value }))
                }
                placeholder="https://…"
              />
            </Field>
          </div>

          {/* Specification fields */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[0.875rem] font-semibold text-ink">
                Specification fields
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((c) => ({
                    ...c,
                    fieldSchema: [
                      ...c.fieldSchema,
                      { key: "", label: "", type: "text" },
                    ],
                  }))
                }
              >
                <Plus className="size-3.5" />
                Add field
              </Button>
            </div>

            {errors.fieldSchema ? (
              <Alert tone="critical" className="mb-3">
                {errors.fieldSchema}
              </Alert>
            ) : null}

            {draft.fieldSchema.length === 0 ? (
              <p className="rounded-sm border border-dashed border-line-strong p-6 text-center text-[0.8125rem] text-faint">
                No specification fields yet. Lots in this department will show
                only their description.
              </p>
            ) : (
              <ul className="space-y-2">
                {draft.fieldSchema.map((field, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 rounded-sm border border-line bg-raised p-3"
                  >
                    <GripVertical className="mt-2.5 size-3.5 shrink-0 text-faint" />

                    <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1fr_8rem_5rem]">
                      <Input
                        aria-label={`Field ${index + 1} label`}
                        placeholder="Label — e.g. Artist"
                        value={field.label}
                        onChange={(event) =>
                          updateField(index, {
                            label: event.target.value,
                            // The key is derived until it is edited directly.
                            key:
                              field.key ||
                              slugify(event.target.value).replace(/-/g, "_"),
                          })
                        }
                        className="h-9 text-[0.8125rem]"
                      />
                      <Input
                        aria-label={`Field ${index + 1} key`}
                        placeholder="key"
                        value={field.key}
                        onChange={(event) =>
                          updateField(index, { key: event.target.value })
                        }
                        className="h-9 font-mono text-[0.75rem]"
                      />
                      <NativeSelect
                        aria-label={`Field ${index + 1} type`}
                        value={field.type ?? "text"}
                        onChange={(event) =>
                          updateField(index, {
                            type: event.target.value as CategoryField["type"],
                          })
                        }
                        className="h-9 text-[0.8125rem]"
                      >
                        <option value="text">Text</option>
                        <option value="textarea">Long text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                      </NativeSelect>
                      <label className="flex h-9 items-center gap-1.5 text-[0.75rem] text-muted">
                        <input
                          type="checkbox"
                          checked={field.required ?? false}
                          onChange={(event) =>
                            updateField(index, { required: event.target.checked })
                          }
                          className="size-3.5 accent-[var(--color-accent)]"
                        />
                        Required
                      </label>
                    </div>

                    <button
                      type="button"
                      aria-label={`Remove field ${index + 1}`}
                      onClick={() =>
                        setDraft((c) => ({
                          ...c,
                          fieldSchema: c.fieldSchema.filter((_, i) => i !== index),
                        }))
                      }
                      className="mt-1.5 shrink-0 p-1 text-faint transition-colors hover:text-live"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
            {draft.id ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-live hover:bg-live-wash"
                onClick={() => {
                  const category = categories.find((c) => c.id === draft.id);
                  if (category) setConfirmDelete(category);
                }}
              >
                <Trash2 className="size-3.5" />
                Delete department
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={save} disabled={pending}>
                {pending ? "Saving…" : draft.id ? "Save changes" : "Create department"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name}?`}
        description={
          confirmDelete && confirmDelete.auctionCount > 0 ? (
            <>
              This department still holds {confirmDelete.auctionCount} lots and
              cannot be deleted. Move those lots to another department first, or
              set this one to hidden.
            </>
          ) : (
            <>
              The department will be removed permanently. This cannot be undone.
            </>
          )
        }
        confirmLabel="Delete department"
        destructive
        pending={pending}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </div>
  );
}
