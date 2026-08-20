"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { updateSiteContent } from "@/app/actions/admin/content";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type {
  CONTENT_DEFAULTS,
  ContentKey,
} from "@/lib/content/site-content";
import { cn } from "@/lib/utils";

type Content = typeof CONTENT_DEFAULTS;

const TABS: { key: ContentKey; label: string; description: string }[] = [
  { key: "hero", label: "Hero", description: "The headline at the top of the homepage." },
  { key: "announcement", label: "Announcement", description: "The bar above the site header." },
  { key: "howItWorks", label: "How it works", description: "The four steps, used on the homepage and the guide." },
  { key: "trust", label: "Trust & security", description: "The mechanisms the saleroom leads with." },
  { key: "newsletter", label: "Newsletter", description: "The sign-up block in the footer." },
  { key: "footer", label: "Footer", description: "Contact and legal details." },
];

export function ContentEditor({ content }: { content: Content }) {
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = React.useState<ContentKey>("hero");
  const [draft, setDraft] = React.useState<Content>(content);
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Tracks whether the visible tab differs from what is published.
  const dirty =
    JSON.stringify(draft[tab]) !== JSON.stringify(content[tab]);

  async function save() {
    setPending(true);
    setErrors({});

    const result = await updateSiteContent(tab, draft[tab]);
    setPending(false);

    if (!result.ok) {
      setErrors(result.errors ?? {});
      toast.error("Not saved", result.message ?? "Check the highlighted fields.");
      return;
    }

    toast.success(result.message ?? "Content updated.");
    router.refresh();
  }

  function patch<K extends ContentKey>(key: K, value: Partial<Content[K]>) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...value } }));
  }

  return (
    <div>
      <nav className="hide-scrollbar flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={cn(
              "relative shrink-0 px-4 py-3 text-[0.8125rem] transition-colors",
              tab === entry.key
                ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent"
                : "text-muted hover:text-ink",
            )}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <p className="mt-4 text-[0.8125rem] text-muted">
        {TABS.find((entry) => entry.key === tab)?.description}
      </p>

      <div className="mt-6 rounded-sm border border-line bg-surface p-6">
        {Object.keys(errors).length > 0 ? (
          <Alert tone="critical" className="mb-5">
            {Object.values(errors)[0]}
          </Alert>
        ) : null}

        {tab === "hero" ? (
          <div className="space-y-5">
            <Field label="Eyebrow" htmlFor="hero-eyebrow" error={errors.eyebrow}>
              <Input
                id="hero-eyebrow"
                value={draft.hero.eyebrow}
                onChange={(event) => patch("hero", { eyebrow: event.target.value })}
              />
            </Field>
            <Field label="Headline" htmlFor="hero-headline" error={errors.headline}>
              <Input
                id="hero-headline"
                value={draft.hero.headline}
                onChange={(event) => patch("hero", { headline: event.target.value })}
              />
            </Field>
            <Field label="Supporting text" htmlFor="hero-body" error={errors.body}>
              <Textarea
                id="hero-body"
                rows={3}
                value={draft.hero.body}
                onChange={(event) => patch("hero", { body: event.target.value })}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Primary button label" htmlFor="hero-cta1">
                <Input
                  id="hero-cta1"
                  value={draft.hero.primaryCta.label}
                  onChange={(event) =>
                    patch("hero", {
                      primaryCta: { ...draft.hero.primaryCta, label: event.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Primary button link" htmlFor="hero-cta1-href">
                <Input
                  id="hero-cta1-href"
                  value={draft.hero.primaryCta.href}
                  onChange={(event) =>
                    patch("hero", {
                      primaryCta: { ...draft.hero.primaryCta, href: event.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Secondary button label" htmlFor="hero-cta2">
                <Input
                  id="hero-cta2"
                  value={draft.hero.secondaryCta.label}
                  onChange={(event) =>
                    patch("hero", {
                      secondaryCta: { ...draft.hero.secondaryCta, label: event.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Secondary button link" htmlFor="hero-cta2-href">
                <Input
                  id="hero-cta2-href"
                  value={draft.hero.secondaryCta.href}
                  onChange={(event) =>
                    patch("hero", {
                      secondaryCta: { ...draft.hero.secondaryCta, href: event.target.value },
                    })
                  }
                />
              </Field>
            </div>
          </div>
        ) : null}

        {tab === "announcement" ? (
          <div className="space-y-5">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={draft.announcement.enabled}
                onChange={(event) =>
                  patch("announcement", { enabled: event.target.checked })
                }
                className="size-4 accent-[var(--color-accent)]"
              />
              <span className="text-[0.875rem] text-ink">
                Show the announcement bar
              </span>
            </label>

            <Field label="Message" htmlFor="ann-message" error={errors.message}>
              <Input
                id="ann-message"
                value={draft.announcement.message}
                onChange={(event) =>
                  patch("announcement", { message: event.target.value })
                }
              />
            </Field>

            <Field
              label="Link"
              htmlFor="ann-href"
              hint="Optional. Leave blank for plain text."
            >
              <Input
                id="ann-href"
                value={draft.announcement.href ?? ""}
                onChange={(event) =>
                  patch("announcement", { href: event.target.value })
                }
              />
            </Field>
          </div>
        ) : null}

        {tab === "howItWorks" || tab === "trust" ? (
          <StepsEditor
            heading={draft[tab].heading}
            body={draft[tab].body}
            items={
              tab === "howItWorks" ? draft.howItWorks.steps : draft.trust.points
            }
            itemNoun={tab === "howItWorks" ? "step" : "point"}
            onHeading={(value) =>
              tab === "howItWorks"
                ? patch("howItWorks", { heading: value })
                : patch("trust", { heading: value })
            }
            onBody={(value) =>
              tab === "howItWorks"
                ? patch("howItWorks", { body: value })
                : patch("trust", { body: value })
            }
            onItems={(items) =>
              tab === "howItWorks"
                ? patch("howItWorks", { steps: items })
                : patch("trust", { points: items })
            }
          />
        ) : null}

        {tab === "newsletter" ? (
          <div className="space-y-5">
            <Field label="Heading" htmlFor="nl-heading" error={errors.heading}>
              <Input
                id="nl-heading"
                value={draft.newsletter.heading}
                onChange={(event) =>
                  patch("newsletter", { heading: event.target.value })
                }
              />
            </Field>
            <Field label="Supporting text" htmlFor="nl-body" error={errors.body}>
              <Textarea
                id="nl-body"
                rows={3}
                value={draft.newsletter.body}
                onChange={(event) =>
                  patch("newsletter", { body: event.target.value })
                }
              />
            </Field>
          </div>
        ) : null}

        {tab === "footer" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="About text"
              htmlFor="footer-blurb"
              className="sm:col-span-2"
              error={errors.blurb}
            >
              <Textarea
                id="footer-blurb"
                rows={3}
                value={draft.footer.blurb}
                onChange={(event) => patch("footer", { blurb: event.target.value })}
              />
            </Field>
            <Field label="Legal name" htmlFor="footer-legal" error={errors.legalName}>
              <Input
                id="footer-legal"
                value={draft.footer.legalName}
                onChange={(event) =>
                  patch("footer", { legalName: event.target.value })
                }
              />
            </Field>
            <Field label="Email" htmlFor="footer-email" error={errors.email}>
              <Input
                id="footer-email"
                value={draft.footer.email}
                onChange={(event) => patch("footer", { email: event.target.value })}
              />
            </Field>
            <Field label="Phone" htmlFor="footer-phone" error={errors.phone}>
              <Input
                id="footer-phone"
                value={draft.footer.phone}
                onChange={(event) => patch("footer", { phone: event.target.value })}
              />
            </Field>
            <Field label="Address" htmlFor="footer-address" error={errors.address}>
              <Input
                id="footer-address"
                value={draft.footer.address}
                onChange={(event) => patch("footer", { address: event.target.value })}
              />
            </Field>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-end gap-3 border-t border-line pt-5">
          {dirty ? (
            <span className="mr-auto text-[0.75rem] text-caution">
              Unsaved changes
            </span>
          ) : null}
          <Button
            variant="outline"
            onClick={() => setDraft(content)}
            disabled={pending || !dirty}
          >
            Discard
          </Button>
          <Button variant="primary" onClick={save} disabled={pending || !dirty}>
            {pending ? "Publishing…" : "Publish changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type Item = { title: string; body: string };

function StepsEditor({
  heading,
  body,
  items,
  itemNoun,
  onHeading,
  onBody,
  onItems,
}: {
  heading: string;
  body: string;
  items: Item[];
  itemNoun: string;
  onHeading: (value: string) => void;
  onBody: (value: string) => void;
  onItems: (items: Item[]) => void;
}) {
  return (
    <div className="space-y-5">
      <Field label="Heading" htmlFor="steps-heading">
        <Input
          id="steps-heading"
          value={heading}
          onChange={(event) => onHeading(event.target.value)}
        />
      </Field>

      <Field label="Supporting text" htmlFor="steps-body">
        <Textarea
          id="steps-body"
          rows={2}
          value={body}
          onChange={(event) => onBody(event.target.value)}
        />
      </Field>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[0.875rem] font-semibold text-ink">
            {items.length} {items.length === 1 ? itemNoun : `${itemNoun}s`}
          </h3>
          <Button
            variant="outline"
            size="sm"
            disabled={items.length >= 6}
            onClick={() => onItems([...items, { title: "", body: "" }])}
          >
            <Plus className="size-3.5" />
            Add {itemNoun}
          </Button>
        </div>

        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={index} className="rounded-sm border border-line bg-raised p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[0.6875rem] uppercase tracking-[0.1em] text-faint">
                  {itemNoun} {index + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${itemNoun} ${index + 1}`}
                  onClick={() => onItems(items.filter((_, i) => i !== index))}
                  className="p-1 text-faint transition-colors hover:text-live"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              <Input
                aria-label={`${itemNoun} ${index + 1} title`}
                placeholder="Title"
                value={item.title}
                onChange={(event) =>
                  onItems(
                    items.map((entry, i) =>
                      i === index ? { ...entry, title: event.target.value } : entry,
                    ),
                  )
                }
                className="mb-2"
              />
              <Textarea
                aria-label={`${itemNoun} ${index + 1} text`}
                placeholder="Text"
                rows={2}
                value={item.body}
                onChange={(event) =>
                  onItems(
                    items.map((entry, i) =>
                      i === index ? { ...entry, body: event.target.value } : entry,
                    ),
                  )
                }
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
