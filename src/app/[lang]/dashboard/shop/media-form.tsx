"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { CircleNotchIcon, ImageSquareIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";
import { LOGO_SIZE, MAX_PHOTOS, MAX_UPLOAD_BYTES, MEDIA_BUCKET, PHOTO_WIDTH } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import { addPhoto, removeLogo, removePhoto, setLogo } from "../actions/media";
import { useOwnerT } from "@/lib/i18n/client";

type Photo = { id: string; url: string };
type Props = { shopId: string; logoUrl: string | null; photos: Photo[] };

/**
 * Shrinks a picture in the browser: photos to 1600 px wide, the logo to a
 * 512 px square (cut from the middle). WebP where the browser can make it,
 * JPEG otherwise (older Safari).
 */
async function shrink(file: File, kind: "logo" | "photo"): Promise<{ blob: Blob; ext: string }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  if (kind === "logo") {
    const side = Math.min(bitmap.width, bitmap.height);
    canvas.width = canvas.height = Math.min(LOGO_SIZE, side);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  } else {
    const scale = Math.min(1, PHOTO_WIDTH / bitmap.width);
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  bitmap.close();
  const make = (type: string, quality: number) => new Promise<Blob | null>((done) => canvas.toBlob(done, type, quality));
  for (const quality of [0.82, 0.7, 0.55]) {
    const webp = await make("image/webp", quality);
    const blob = webp?.type === "image/webp" ? webp : await make("image/jpeg", quality);
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return { blob, ext: blob.type === "image/webp" ? "webp" : "jpg" };
  }
  throw new Error("too_big");
}

export function MediaForm({ shopId, logoUrl, photos }: Props) {
  const o = useOwnerT();
  const [busy, setBusy] = useState<"logo" | "photo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined, kind: "logo" | "photo") {
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError(o("Please pick a JPEG, PNG or WebP picture."));
      return;
    }
    setBusy(kind);
    try {
      const { blob, ext } = await shrink(file, kind);
      const path = `${shopId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await createClient().storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
      if (uploadError) throw uploadError;
      const result = kind === "logo" ? await setLogo(path) : await addPhoto(path);
      if (result.error) setError(result.error);
    } catch {
      setError(o("Could not upload that picture. Please try another one."));
    } finally {
      setBusy(null);
      if (logoInput.current) logoInput.current.value = "";
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  const run = (action: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (result.error) setError(result.error);
    });

  const spinner = <CircleNotchIcon aria-hidden className="size-4 motion-safe:animate-spin" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-raised shadow-card">
          {logoUrl ? (
            <Image src={logoUrl} alt={o("Your logo")} fill sizes="64px" unoptimized className="object-cover" />
          ) : (
            <ImageSquareIcon aria-hidden className="absolute inset-0 m-auto size-6 text-neutral-500" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={logoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id="logo-file"
            onChange={(e) => upload(e.target.files?.[0], "logo")}
          />
          <label htmlFor="logo-file" className={`${buttonClass("secondary", { size: "sm" })} cursor-pointer`} aria-disabled={busy !== null}>
            {busy === "logo" ? spinner : null}
            {logoUrl ? o("Change logo") : o("Add logo")}
          </label>
          {logoUrl ? (
            <button type="button" onClick={() => run(removeLogo)} className={buttonClass("ghost", { size: "sm" })}>
              {o("Remove")}
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">
          {o("Photos")} <span className="font-normal text-neutral-400">({o("{count} of {max}", { count: photos.length, max: MAX_PHOTOS })})</span>
        </p>
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <li key={p.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-raised">
              <Image src={p.url} alt={`Photo ${i + 1}`} fill sizes="(min-width: 640px) 200px, 33vw" unoptimized className="object-cover" />
              <button
                type="button"
                onClick={() => run(() => removePhoto(p.id))}
                aria-label={o("Remove photo {n}", { n: i + 1 })}
                className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-md bg-ground/80 text-neutral-200 backdrop-blur transition-colors duration-150 hover:bg-danger-soft hover:text-danger-ink"
              >
                <TrashIcon aria-hidden className="size-4" />
              </button>
            </li>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <li>
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                id="photo-file"
                onChange={(e) => upload(e.target.files?.[0], "photo")}
              />
              <label
                htmlFor="photo-file"
                className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-[13px] text-neutral-400 transition-colors duration-150 hover:border-accent hover:text-ink"
              >
                {busy === "photo" ? spinner : <PlusIcon aria-hidden className="size-5" />}
                {busy === "photo" ? o("Uploading…") : o("Add photo")}
              </label>
            </li>
          ) : null}
        </ul>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {error}
        </p>
      ) : (
        <p className="text-[13px] text-neutral-400">{o("Pictures are made smaller before they upload, so phone photos are fine.")}</p>
      )}
    </div>
  );
}
