// Uploads the demo shop's pictures (scripts/demo-media/*.webp) to the shared
// "demo/" folder of the shop-media bucket. Every "Try a demo shop" points at
// these same files, so they are uploaded once, not per visitor.
// Run: node scripts/upload-demo-media.mjs   (needs SUPABASE_SECRET_KEY in .env.local)
//
// The pictures were made with an AI image tool (Higgsfield, model Z Image) for
// this demo; they show no real shop or person.
import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local first.");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const dir = "scripts/demo-media";
for (const file of readdirSync(dir).filter((f) => f.endsWith(".webp"))) {
  const { error } = await admin.storage
    .from("shop-media")
    .upload(`demo/${file}`, readFileSync(`${dir}/${file}`), { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
  console.log(error ? `could not upload ${file}: ${error.message}` : `uploaded demo/${file}`);
}
