"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  createAuction,
  updateAuction,
  type AdminActionResult,
} from "@/app/actions/admin/auctions";
import { ImageUploader } from "@/components/admin/image-uploader";
import { Button } from "@/components/ui/button";
import {
  Alert,
  Field,
  Input,
  NativeSelect,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { AuctionFormValues } from "@/lib/admin/auction-form-values";
import { parseJson } from "@/lib/db/json";
import { currencySymbol } from "@/lib/money";
import type { CategoryField } from "@/lib/validation/auction";
import { cn, slugify } from "@/lib/utils";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  fieldSchema: string;
  status: string;
};

/* -------------------------------------------------------------------------- */

export function AuctionForm({
  categories,
  initial,
  mode,
  pricingLocked,
}: {
  categories: CategoryOption[];
  initial: AuctionFormValues;
  mode: "create" | "edit";
  /** True once the lot has bids: its economics can no longer be changed. */
  pricingLocked?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit");

  function set<K extends keyof AuctionFormValues>(
    key: K,
    value: AuctionFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  // The slug tracks the title until an operator edits it by hand.
  React.useEffect(() => {
    if (slugTouched) return;
    setValues((current) => ({ ...current, slug: slugify(current.title) }));
  }, [values.title, slugTouched]);

  const category = categories.find((option) => option.id === values.categoryId);
  const specFields = React.useMemo<CategoryField[]>(
    () => (category ? parseJson<CategoryField[]>(category.fieldSchema, []) : []),
    [category],
  );

  const symbol = currencySymbol(values.currency);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setMessage(null);

    const payload = {
      title: values.title,
      lotNumber: values.lotNumber,
      slug: values.slug,
      categoryId: values.categoryId,
      shortDescription: values.shortDescription,
      description: values.description,
      startingPrice: values.startingPrice,
      minimumIncrement: values.minimumIncrement,
      reservePrice: values.reservePrice,
      // Stored as basis points; entered as a percentage.
      buyerPremiumBps: Math.round(Number(values.buyerPremiumBps || 0) * 100),
      currency: values.currency,
      startAt: values.startAt,
      endAt: values.endAt,
      extensionEnabled: values.extensionEnabled,
      extensionThresholdSec: Number(values.extensionThresholdSec || 0),
      extensionDurationSec: Number(values.extensionDurationSec || 0),
      proxyBiddingEnabled: values.proxyBiddingEnabled,
      watchlistEnabled: values.watchlistEnabled,
      featured: values.featured,
      location: values.location,
      shippingNote: values.shippingNote,
      paymentNote: values.paymentNote,
      attributes: values.attributes,
      images: values.images
        .filter((image) => !image.uploading && !image.error)
        .map((image, index) => ({
          id: image.id,
          url: image.url,
          altText: image.altText,
          sortOrder: index,
          isPrimary: image.isPrimary,
        })),
    };

    const result: AdminActionResult =
      mode === "create"
        ? await createAuction(payload)
        : await updateAuction(values.id!, payload);

    setPending(false);

    if (!result.ok) {
      setErrors(result.errors ?? {});
      setMessage(result.message ?? "Please correct the highlighted fields.");
      toast.error("Not saved", result.message ?? "Some fields need attention.");
      // Take the operator to the first problem rather than leaving them to hunt.
      const firstKey = Object.keys(result.errors ?? {})[0];
      if (firstKey) {
        document
          .querySelector(`[name="${firstKey}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    toast.success(result.message ?? "Saved.");
    if (mode === "create" && result.id) {
      router.push(`/admin/auctions/${result.id}`);
    } else {
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      {message ? (
        <Alert tone="critical" role="alert">
          {message}
        </Alert>
      ) : null}

      {/* -- Basic information ------------------------------------------- */}
      <Section
        title="Basic information"
        description="How the lot is identified and catalogued."
      >
        <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
          <Field label="Item title" htmlFor="title" required error={errors.title}>
            <Input
              id="title"
              name="title"
              value={values.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Voclain Type XX Flyback Chronograph, circa 1958"
              aria-invalid={Boolean(errors.title)}
            />
          </Field>

          <Field label="Lot number" htmlFor="lotNumber" required error={errors.lotNumber}>
            <Input
              id="lotNumber"
              name="lotNumber"
              value={values.lotNumber}
              onChange={(event) => set("lotNumber", event.target.value)}
              className="tabular"
              aria-invalid={Boolean(errors.lotNumber)}
            />
          </Field>
        </div>

        <Field
          label="URL slug"
          htmlFor="slug"
          error={errors.slug}
          hint={
            <span className="text-[0.75rem] text-faint">
              /auction/{values.slug || "…"}
            </span>
          }
        >
          <Input
            id="slug"
            name="slug"
            value={values.slug}
            onChange={(event) => {
              setSlugTouched(true);
              set("slug", event.target.value);
            }}
            aria-invalid={Boolean(errors.slug)}
          />
        </Field>

        <Field label="Department" htmlFor="categoryId" required error={errors.categoryId}>
          <NativeSelect
            id="categoryId"
            name="categoryId"
            value={values.categoryId}
            onChange={(event) => set("categoryId", event.target.value)}
            aria-invalid={Boolean(errors.categoryId)}
          >
            <option value="">Choose a department…</option>
            {categories.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.status === "HIDDEN" ? " (hidden)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field
          label="Short description"
          htmlFor="shortDescription"
          required
          error={errors.shortDescription}
          hint="One or two lines. Appears on catalogue cards and in search results."
        >
          <Textarea
            id="shortDescription"
            name="shortDescription"
            rows={2}
            value={values.shortDescription}
            onChange={(event) => set("shortDescription", event.target.value)}
            aria-invalid={Boolean(errors.shortDescription)}
          />
        </Field>

        <Field
          label="Full catalogue entry"
          htmlFor="description"
          required
          error={errors.description}
          hint="Condition, provenance, servicing history. Blank lines separate paragraphs."
        >
          <Textarea
            id="description"
            name="description"
            rows={10}
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            aria-invalid={Boolean(errors.description)}
          />
        </Field>
      </Section>

      {/* -- Media --------------------------------------------------------- */}
      <Section
        title="Media"
        description="High-resolution photography. The lead image is used on cards, the hero and social previews."
      >
        {errors.images ? (
          <Alert tone="critical" className="mb-4">
            {errors.images}
          </Alert>
        ) : null}
        <ImageUploader
          images={values.images}
          onChange={(next) => set("images", next)}
          disabled={pending}
        />
      </Section>

      {/* -- Pricing ------------------------------------------------------- */}
      <Section
        title="Pricing"
        description="All figures in the lot's currency. Stored to the paise."
      >
        {pricingLocked ? (
          <Alert tone="caution" className="mb-5">
            This lot already has bids. Starting price, increment and reserve are
            locked — bidders committed against these terms.
          </Alert>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Currency" htmlFor="currency" error={errors.currency}>
            <NativeSelect
              id="currency"
              name="currency"
              value={values.currency}
              onChange={(event) => set("currency", event.target.value)}
              disabled={pricingLocked}
            >
              {["INR", "USD", "EUR", "GBP", "AED"].map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <MoneyField
            label="Starting price"
            name="startingPrice"
            symbol={symbol}
            required
            value={values.startingPrice}
            error={errors.startingPrice}
            disabled={pricingLocked}
            onChange={(value) => set("startingPrice", value)}
          />

          <MoneyField
            label="Bid increment"
            name="minimumIncrement"
            symbol={symbol}
            required
            value={values.minimumIncrement}
            error={errors.minimumIncrement}
            disabled={pricingLocked}
            onChange={(value) => set("minimumIncrement", value)}
          />

          <MoneyField
            label="Reserve price"
            name="reservePrice"
            symbol={symbol}
            hint="Leave blank to sell without reserve"
            value={values.reservePrice}
            error={errors.reservePrice}
            disabled={pricingLocked}
            onChange={(value) => set("reservePrice", value)}
          />
        </div>

        <Field
          label="Buyer's premium"
          htmlFor="buyerPremiumBps"
          error={errors.buyerPremiumBps}
          hint="Percentage added to the hammer price on the invoice."
          className="max-w-48"
        >
          <div className="relative">
            <Input
              id="buyerPremiumBps"
              name="buyerPremiumBps"
              inputMode="decimal"
              value={values.buyerPremiumBps}
              onChange={(event) =>
                set("buyerPremiumBps", event.target.value.replace(/[^\d.]/g, ""))
              }
              className="pr-8 tabular"
              aria-invalid={Boolean(errors.buyerPremiumBps)}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">
              %
            </span>
          </div>
        </Field>
      </Section>

      {/* -- Schedule ------------------------------------------------------ */}
      <Section
        title="Schedule"
        description="Opens the moment you publish it. Change the start time only if the lot should open later. You can close a lot early at any point from its actions menu."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Opens"
            htmlFor="startAt"
            required
            error={errors.startAt}
            hint="Leave as-is to open on publish"
          >
            <Input
              id="startAt"
              name="startAt"
              type="datetime-local"
              value={values.startAt}
              onChange={(event) => set("startAt", event.target.value)}
              aria-invalid={Boolean(errors.startAt)}
            />
          </Field>

          <Field label="Closes" htmlFor="endAt" required error={errors.endAt}>
            <Input
              id="endAt"
              name="endAt"
              type="datetime-local"
              value={values.endAt}
              onChange={(event) => set("endAt", event.target.value)}
              aria-invalid={Boolean(errors.endAt)}
            />
          </Field>
        </div>

        <p className="text-[0.75rem] text-faint">
          Your timezone:{" "}
          {Intl.DateTimeFormat().resolvedOptions().timeZone ?? "local"}
        </p>
      </Section>

      {/* -- Behaviour ----------------------------------------------------- */}
      <Section
        title="Auction settings"
        description="How the lot behaves while it is open."
      >
        <div className="space-y-3">
          <Toggle
            label="Anti-snipe extension"
            description="A bid placed close to the hammer pushes the closing time out."
            checked={values.extensionEnabled}
            onChange={(checked) => set("extensionEnabled", checked)}
          />

          {values.extensionEnabled ? (
            <div className="ml-0 grid gap-5 rounded-sm border border-line bg-raised p-4 sm:ml-12 sm:grid-cols-2">
              <Field
                label="Trigger window"
                htmlFor="extensionThresholdSec"
                error={errors.extensionThresholdSec}
                hint="Seconds before close that arm the extension"
              >
                <Input
                  id="extensionThresholdSec"
                  name="extensionThresholdSec"
                  inputMode="numeric"
                  value={values.extensionThresholdSec}
                  onChange={(event) =>
                    set("extensionThresholdSec", event.target.value.replace(/\D/g, ""))
                  }
                  className="tabular"
                />
              </Field>

              <Field
                label="Extend by"
                htmlFor="extensionDurationSec"
                error={errors.extensionDurationSec}
                hint="Seconds added to the closing time"
              >
                <Input
                  id="extensionDurationSec"
                  name="extensionDurationSec"
                  inputMode="numeric"
                  value={values.extensionDurationSec}
                  onChange={(event) =>
                    set("extensionDurationSec", event.target.value.replace(/\D/g, ""))
                  }
                  className="tabular"
                />
              </Field>
            </div>
          ) : null}

          <Toggle
            label="Proxy bidding"
            description="Bidders may leave a maximum and have the saleroom bid for them."
            checked={values.proxyBiddingEnabled}
            onChange={(checked) => set("proxyBiddingEnabled", checked)}
          />
          <Toggle
            label="Watchlist"
            description="Bidders can follow the lot and be notified before it closes."
            checked={values.watchlistEnabled}
            onChange={(checked) => set("watchlistEnabled", checked)}
          />
          <Toggle
            label="Featured lot"
            description="Eligible for the homepage hero and the featured rail."
            checked={values.featured}
            onChange={(checked) => set("featured", checked)}
          />
        </div>
      </Section>

      {/* -- Specifications ------------------------------------------------ */}
      <Section
        title="Item information"
        description={
          category
            ? `Specification fields for ${category.name}. These appear in the lot's specifications table.`
            : "Choose a department to see its specification fields."
        }
      >
        {specFields.length === 0 ? (
          <p className="text-[0.8125rem] text-faint">
            {category
              ? "This department has no specification fields yet. Add them under Departments."
              : "No department selected."}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {specFields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                htmlFor={`attr-${field.key}`}
                required={field.required}
                className={field.type === "textarea" ? "sm:col-span-2" : undefined}
              >
                {field.type === "textarea" ? (
                  <Textarea
                    id={`attr-${field.key}`}
                    rows={3}
                    value={values.attributes[field.key] ?? ""}
                    onChange={(event) =>
                      set("attributes", {
                        ...values.attributes,
                        [field.key]: event.target.value,
                      })
                    }
                  />
                ) : (
                  <Input
                    id={`attr-${field.key}`}
                    type={field.type === "date" ? "date" : "text"}
                    value={values.attributes[field.key] ?? ""}
                    onChange={(event) =>
                      set("attributes", {
                        ...values.attributes,
                        [field.key]: event.target.value,
                      })
                    }
                  />
                )}
              </Field>
            ))}
          </div>
        )}

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Location" htmlFor="location" error={errors.location}>
            <Input
              id="location"
              name="location"
              value={values.location}
              onChange={(event) => set("location", event.target.value)}
              placeholder="Mumbai"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Shipping note" htmlFor="shippingNote">
            <Textarea
              id="shippingNote"
              name="shippingNote"
              rows={3}
              value={values.shippingNote}
              onChange={(event) => set("shippingNote", event.target.value)}
              placeholder="Leave blank to use the saleroom default."
            />
          </Field>
          <Field label="Payment note" htmlFor="paymentNote">
            <Textarea
              id="paymentNote"
              name="paymentNote"
              rows={3}
              value={values.paymentNote}
              onChange={(event) => set("paymentNote", event.target.value)}
              placeholder="Leave blank to use the saleroom default."
            />
          </Field>
        </div>
      </Section>

      {/* -- Submit -------------------------------------------------------- */}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-line bg-canvas/95 px-1 py-4 backdrop-blur-sm">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : mode === "create" ? (
            "Create draft"
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-line bg-surface p-6">
      <header className="mb-6">
        <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted text-pretty">
            {description}
          </p>
        ) : null}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function MoneyField({
  label,
  name,
  symbol,
  value,
  error,
  hint,
  required,
  disabled,
  onChange,
}: {
  label: string;
  name: string;
  symbol: string;
  value: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={name} required={required} error={error} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
          {symbol}
        </span>
        <Input
          id={name}
          name={name}
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ""))}
          aria-invalid={Boolean(error)}
          className="pl-8 tabular"
        />
      </div>
    </Field>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-line p-4 transition-colors hover:border-line-strong">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[0.875rem] text-ink">{label}</span>
        <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-muted">
          {description}
        </span>
      </span>
    </label>
  );
}
