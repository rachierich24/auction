"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

import { cn } from "@/lib/utils";

type GalleryImage = { id: string; url: string; altText: string | null };

/**
 * Lot gallery. Desktop gets a large stage with a thumbnail rail; mobile gets a
 * swipeable, scroll-snapped carousel driven by native overflow so it stays
 * smooth without a gesture library.
 */
export function ImageGallery({
  images,
  title,
  className,
}: {
  images: GalleryImage[];
  title: string;
  className?: string;
}) {
  const [index, setIndex] = React.useState(0);
  const [zoomed, setZoomed] = React.useState(false);
  const trackRef = React.useRef<HTMLDivElement>(null);

  const count = images.length;
  const current = images[index];

  const go = React.useCallback(
    (next: number) => {
      if (count === 0) return;
      const wrapped = (next + count) % count;
      setIndex(wrapped);
      trackRef.current?.scrollTo({
        left: wrapped * (trackRef.current.clientWidth || 0),
        behavior: "smooth",
      });
    },
    [count],
  );

  // Arrow-key navigation, and Escape to leave the lightbox.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (zoomed && event.key === "Escape") setZoomed(false);
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, zoomed]);

  if (count === 0) {
    return (
      <div
        className={cn(
          "flex aspect-[4/3] items-center justify-center rounded-sm border border-dashed border-line-strong bg-raised",
          className,
        )}
      >
        <p className="text-sm text-faint">No images for this lot</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Mobile: swipeable track */}
      <div className="lg:hidden">
        <div
          ref={trackRef}
          onScroll={(event) => {
            const el = event.currentTarget;
            const next = Math.round(el.scrollLeft / (el.clientWidth || 1));
            if (next !== index) setIndex(next);
          }}
          className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-sm bg-sunken"
        >
          {images.map((image, i) => (
            <div
              key={image.id}
              className="relative aspect-[4/3] w-full shrink-0 snap-center"
            >
              <Image
                src={image.url}
                alt={image.altText ?? `${title} — view ${i + 1}`}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {count > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {images.map((image, i) => (
              <button
                key={image.id}
                type="button"
                aria-label={`View image ${i + 1}`}
                onClick={() => go(i)}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === index ? "w-6 bg-ink" : "w-1.5 bg-line-strong",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Desktop: stage + rail */}
      <div className="hidden lg:block">
        <div className="group relative aspect-[4/3] overflow-hidden rounded-sm bg-sunken">
          <Image
            key={current.id}
            src={current.url}
            alt={current.altText ?? title}
            fill
            priority
            sizes="(min-width: 1280px) 46rem, 50vw"
            className="animate-[fade-in_0.4s_ease-out] object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
          />

          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="View full size"
            className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-sm bg-surface/90 text-ink opacity-0 shadow-card backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Expand className="size-4" />
          </button>

          {count > 1 ? (
            <>
              <GalleryArrow side="left" onClick={() => go(index - 1)} />
              <GalleryArrow side="right" onClick={() => go(index + 1)} />
              <div className="absolute bottom-4 left-4 rounded-[2px] bg-ink/80 px-2 py-1 text-[0.625rem] font-medium tracking-[0.1em] text-white tabular backdrop-blur-sm">
                {index + 1} / {count}
              </div>
            </>
          ) : null}
        </div>

        {count > 1 ? (
          <div className="mt-3 grid grid-cols-6 gap-3">
            {images.map((image, i) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-sm border transition-all duration-200",
                  i === index
                    ? "border-ink opacity-100"
                    : "border-line opacity-60 hover:border-line-strong hover:opacity-100",
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="8rem"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Lightbox */}
      {zoomed ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — full size`}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/95 p-6 animate-[fade-in_0.2s_ease-out]"
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-6 top-6 inline-flex size-10 items-center justify-center rounded-sm text-white/70 transition-colors hover:text-white"
          >
            <X className="size-5" />
          </button>

          <div
            className="relative h-full w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={current.url}
              alt={current.altText ?? title}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>

          {count > 1 ? (
            <>
              <GalleryArrow
                side="left"
                dark
                onClick={(event) => {
                  event.stopPropagation();
                  go(index - 1);
                }}
              />
              <GalleryArrow
                side="right"
                dark
                onClick={(event) => {
                  event.stopPropagation();
                  go(index + 1);
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GalleryArrow({
  side,
  dark = false,
  onClick,
}: {
  side: "left" | "right";
  dark?: boolean;
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn(
        "absolute top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-sm transition-all duration-200",
        side === "left" ? "left-4" : "right-4",
        dark
          ? "text-white/70 hover:bg-white/10 hover:text-white"
          : "bg-surface/90 text-ink opacity-0 shadow-card backdrop-blur-sm group-hover:opacity-100 focus-visible:opacity-100",
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="size-5" />
      ) : (
        <ChevronRight className="size-5" />
      )}
    </button>
  );
}
