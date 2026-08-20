"use client";

import * as React from "react";
import Image from "next/image";
import { GripVertical, ImageUp, Loader2, Star, Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/primitives";
import { nextImageUid, type EditorImage } from "@/lib/admin/auction-form-values";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_FILES = 12;

/**
 * Lot media editor: drag-and-drop upload with per-file progress, reordering by
 * drag, primary selection and removal.
 *
 * Uploads go straight to the storage endpoint and only the returned URL is kept
 * in form state, so a large image never rides along in the form submission.
 */
export function ImageUploader({
  images,
  onChange,
  disabled,
}: {
  images: EditorImage[];
  onChange: (next: EditorImage[]) => void;
  disabled?: boolean;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Held in a ref so the async upload loop always appends to the latest list
  // rather than the snapshot it started with.
  const imagesRef = React.useRef(images);
  React.useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const upload = React.useCallback(
    async (files: File[]) => {
      setError(null);

      const room = MAX_FILES - imagesRef.current.length;
      if (room <= 0) {
        setError(`A lot can carry at most ${MAX_FILES} images.`);
        return;
      }

      const batch = files.slice(0, room);
      if (files.length > room) {
        setError(`Only the first ${room} of those files were added.`);
      }

      // Placeholders appear immediately so the operator sees progress.
      const placeholders = batch.map((file) => ({
        uid: nextImageUid(),
        url: URL.createObjectURL(file),
        altText: "",
        isPrimary: false,
        uploading: true,
        progress: 0,
      }));

      let working = [...imagesRef.current, ...placeholders];
      if (!working.some((image) => image.isPrimary) && working.length > 0) {
        working = working.map((image, index) => ({
          ...image,
          isPrimary: index === 0,
        }));
      }
      imagesRef.current = working;
      onChange(working);

      await Promise.all(
        batch.map(
          (file, index) =>
            new Promise<void>((resolve) => {
              const placeholder = placeholders[index];
              const body = new FormData();
              body.append("file", file);

              // XHR rather than fetch: it is the only way to get real upload
              // progress, which matters for high-resolution lot photography.
              const xhr = new XMLHttpRequest();
              xhr.open("POST", "/api/admin/upload");

              xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable) return;
                const progress = Math.round((event.loaded / event.total) * 100);
                imagesRef.current = imagesRef.current.map((image) =>
                  image.uid === placeholder.uid ? { ...image, progress } : image,
                );
                onChange(imagesRef.current);
              };

              xhr.onload = () => {
                let payload: { url?: string; error?: string } = {};
                try {
                  payload = JSON.parse(xhr.responseText);
                } catch {
                  payload = { error: "Unexpected response from the server." };
                }

                imagesRef.current = imagesRef.current.map((image) => {
                  if (image.uid !== placeholder.uid) return image;
                  if (xhr.status >= 200 && xhr.status < 300 && payload.url) {
                    URL.revokeObjectURL(image.url);
                    return {
                      ...image,
                      url: payload.url,
                      uploading: false,
                      progress: 100,
                    };
                  }
                  return {
                    ...image,
                    uploading: false,
                    error: payload.error ?? "Upload failed.",
                  };
                });
                onChange(imagesRef.current);
                resolve();
              };

              xhr.onerror = () => {
                imagesRef.current = imagesRef.current.map((image) =>
                  image.uid === placeholder.uid
                    ? { ...image, uploading: false, error: "Network error." }
                    : image,
                );
                onChange(imagesRef.current);
                resolve();
              };

              xhr.send(body);
            }),
        ),
      );
    },
    [onChange],
  );

  function remove(uid: string) {
    const image = images.find((candidate) => candidate.uid === uid);
    if (image?.url.startsWith("blob:")) URL.revokeObjectURL(image.url);

    let next = images.filter((candidate) => candidate.uid !== uid);
    // The lot must always have a lead image if it has any images at all.
    if (next.length > 0 && !next.some((candidate) => candidate.isPrimary)) {
      next = next.map((candidate, index) => ({
        ...candidate,
        isPrimary: index === 0,
      }));
    }
    onChange(next);
  }

  function setPrimary(uid: string) {
    onChange(
      images.map((image) => ({ ...image, isPrimary: image.uid === uid })),
    );
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (disabled) return;
          const files = [...event.dataTransfer.files].filter((file) =>
            file.type.startsWith("image/"),
          );
          if (files.length) void upload(files);
        }}
        className={cn(
          "rounded-sm border border-dashed p-8 text-center transition-colors",
          dragOver
            ? "border-accent bg-accent-wash"
            : "border-line-strong bg-raised",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <ImageUp className="mx-auto size-6 text-faint" strokeWidth={1.5} />
        <p className="mt-3 text-[0.875rem] text-ink">
          Drag images here, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-accent-deep underline underline-offset-4 hover:text-ink"
          >
            browse
          </button>
        </p>
        <p className="mt-1.5 text-[0.75rem] text-faint">
          JPEG, PNG, WebP or AVIF · up to 8 MB each · {MAX_FILES} maximum
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            if (files.length) void upload(files);
            event.target.value = "";
          }}
        />
      </div>

      {error ? (
        <Alert tone="caution" className="mt-3">
          {error}
        </Alert>
      ) : null}

      {/* Grid */}
      {images.length > 0 ? (
        <>
          <p className="mt-5 text-[0.75rem] text-faint">
            Drag to reorder. The starred image leads the lot everywhere it appears.
          </p>

          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image, index) => (
              <li
                key={image.uid}
                draggable={!image.uploading}
                onDragStart={() => setDragIndex(index)}
                onDragEnter={() => setOverIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDragEnd={() => {
                  if (dragIndex !== null && overIndex !== null) {
                    reorder(dragIndex, overIndex);
                  }
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={cn(
                  "group relative overflow-hidden rounded-sm border bg-surface transition-all",
                  image.isPrimary ? "border-accent" : "border-line",
                  dragIndex === index && "opacity-40",
                  overIndex === index && dragIndex !== index && "border-accent",
                )}
              >
                <div className="relative aspect-square bg-sunken">
                  {/* Local previews are blob: URLs, which next/image cannot
                      optimise — plain <img> until the upload resolves. */}
                  {image.url.startsWith("blob:") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.url}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <Image
                      src={image.url}
                      alt={image.altText || ""}
                      fill
                      sizes="12rem"
                      className="object-cover"
                    />
                  )}

                  {image.uploading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/55">
                      <Loader2 className="size-4 animate-spin text-white" />
                      <div className="h-1 w-16 overflow-hidden rounded-full bg-white/25">
                        <div
                          className="h-full bg-white transition-all duration-200"
                          style={{ width: `${image.progress ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {image.error ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-live/85 p-2 text-center">
                      <p className="text-[0.6875rem] text-white">{image.error}</p>
                    </div>
                  ) : null}

                  {!image.uploading ? (
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <span className="cursor-grab rounded-[3px] bg-surface/90 p-1 text-muted backdrop-blur-sm">
                        <GripVertical className="size-3.5" />
                      </span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setPrimary(image.uid)}
                          aria-label="Use as the lead image"
                          className="rounded-[3px] bg-surface/90 p-1 text-muted backdrop-blur-sm transition-colors hover:text-accent-deep"
                        >
                          <Star
                            className={cn(
                              "size-3.5",
                              image.isPrimary && "fill-accent text-accent",
                            )}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(image.uid)}
                          aria-label="Remove image"
                          className="rounded-[3px] bg-surface/90 p-1 text-muted backdrop-blur-sm transition-colors hover:text-live"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    </div>
                  ) : null}

                  {image.isPrimary ? (
                    <span className="absolute bottom-1.5 left-1.5 rounded-[3px] bg-accent px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wider text-white">
                      Lead
                    </span>
                  ) : null}
                </div>

                <input
                  value={image.altText}
                  onChange={(event) =>
                    onChange(
                      images.map((candidate) =>
                        candidate.uid === image.uid
                          ? { ...candidate, altText: event.target.value }
                          : candidate,
                      ),
                    )
                  }
                  placeholder="Alt text"
                  aria-label={`Alt text for image ${index + 1}`}
                  className="w-full border-t border-line bg-surface px-2.5 py-2 text-[0.75rem] text-ink outline-none placeholder:text-faint focus:bg-raised"
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
