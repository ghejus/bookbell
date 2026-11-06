// Shop pictures (logo and photos) in Supabase Storage. Files live in the
// public "shop-media" bucket, in a folder named after the shop's id; the demo
// shops share pictures in "demo/" (see scripts/upload-demo-media.mjs).

export const MEDIA_BUCKET = "shop-media";
export const MAX_PHOTOS = 6;
/** The bucket refuses bigger files; pictures are shrunk in the browser first. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const PHOTO_WIDTH = 1600;
export const LOGO_SIZE = 512;

/** The public web address of a stored picture. */
export function mediaUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/** A stored picture's path is only accepted inside the shop's own folder (or the shared demo folder). */
export function isShopMediaPath(path: string, shopId: string): boolean {
  return (
    path.length <= 200 &&
    (path.startsWith(`${shopId}/`) || path.startsWith("demo/")) &&
    /^[0-9a-z-]+\/[A-Za-z0-9._-]+$/.test(path)
  );
}
