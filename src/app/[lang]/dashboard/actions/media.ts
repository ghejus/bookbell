"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isShopMediaPath, MEDIA_BUCKET } from "@/lib/media";
import { requireShop } from "@/lib/shop";
import { getActionOwnerT } from "@/lib/i18n/server";
import { mark } from "@/lib/i18n/owner";

// The shop's logo and photos. The browser uploads the (already shrunk)
// picture straight to Storage, into the shop's own folder; these actions then
// record it, or remove it again.
// Every action checks who is logged in and which shop they own. The database
// locks (RLS) check again, so a trick request still can't touch another shop.

type Result = { error?: string };

const pathSchema = z.string().min(3).max(200);
const OOPS = mark("Could not save the picture. Please try again.");

/** Removes a file, but only one in this shop's own folder (never the shared demo pictures). */
async function removeFile(supabase: Awaited<ReturnType<typeof requireShop>>["supabase"], shopId: string, path: string | null) {
  if (path && path.startsWith(`${shopId}/`)) await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}

export async function setLogo(path: string): Promise<Result> {
  const o = await getActionOwnerT();
  const { supabase, shop } = await requireShop();
  const parsed = pathSchema.safeParse(path);
  if (!parsed.success || !parsed.data.startsWith(`${shop.id}/`) || !isShopMediaPath(parsed.data, shop.id)) return { error: o(OOPS) };
  const { data: before } = await supabase.from("shops").select("logo_path").eq("id", shop.id).single<{ logo_path: string | null }>();
  const { error } = await supabase.from("shops").update({ logo_path: parsed.data }).eq("id", shop.id);
  if (error) {
    await removeFile(supabase, shop.id, parsed.data);
    return { error: o(OOPS) };
  }
  if (before?.logo_path !== parsed.data) await removeFile(supabase, shop.id, before?.logo_path ?? null);
  refresh();
  return {};
}

export async function removeLogo(): Promise<Result> {
  const o = await getActionOwnerT();
  const { supabase, shop } = await requireShop();
  const { data: before } = await supabase.from("shops").select("logo_path").eq("id", shop.id).single<{ logo_path: string | null }>();
  const { error } = await supabase.from("shops").update({ logo_path: null }).eq("id", shop.id);
  if (error) return { error: o("Could not remove the logo. Please try again.") };
  await removeFile(supabase, shop.id, before?.logo_path ?? null);
  refresh();
  return {};
}

export async function addPhoto(path: string): Promise<Result> {
  const o = await getActionOwnerT();
  const { supabase, shop } = await requireShop();
  const parsed = pathSchema.safeParse(path);
  if (!parsed.success || !parsed.data.startsWith(`${shop.id}/`) || !isShopMediaPath(parsed.data, shop.id)) return { error: o(OOPS) };
  const { count } = await supabase.from("shop_photos").select("id", { count: "exact", head: true }).eq("shop_id", shop.id);
  const { error } = await supabase.from("shop_photos").insert({ shop_id: shop.id, path: parsed.data, position: count ?? 0 });
  if (error) {
    await removeFile(supabase, shop.id, parsed.data);
    return { error: error.message === "too_many_photos" ? o("You already have 6 photos. Remove one to add another.") : o(OOPS) };
  }
  refresh();
  return {};
}

export async function removePhoto(id: string): Promise<Result> {
  const o = await getActionOwnerT();
  const { supabase, shop } = await requireShop();
  if (!z.uuid().safeParse(id).success) return { error: o("Could not remove the photo.") };
  const { data, error } = await supabase
    .from("shop_photos")
    .delete()
    .eq("id", id)
    .eq("shop_id", shop.id)
    .select("path")
    .maybeSingle<{ path: string }>();
  if (error) return { error: o("Could not remove the photo. Please try again.") };
  await removeFile(supabase, shop.id, data?.path ?? null);
  refresh();
  return {};
}
