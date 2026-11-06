/**
 * Shop pictures, against the real database and Storage (part of `npm run test:db`).
 * Owners may only put files in their own shop's folder; anyone can see them;
 * a shop has at most 6 photos.
 */
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, testOwners, type TestOwner } from "./helpers";

const BUCKET = "shop-media";
const anon = client();
let a: TestOwner;
let b: TestOwner;
let picture: Buffer;
const uploaded: string[] = [];
const name = () => `test-${randomBytes(4).toString("hex")}.webp`;

const upload = (db: ReturnType<typeof client>, path: string, body: Buffer = picture, contentType = "image/webp") =>
  db.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });

async function cleanUp() {
  await a.db.from("shop_photos").delete().eq("shop_id", a.shopId);
  await a.db.from("shops").update({ logo_path: null }).eq("id", a.shopId);
  if (uploaded.length) await a.db.storage.from(BUCKET).remove(uploaded);
}

beforeAll(async () => {
  ({ a, b } = await testOwners());
  picture = await sharp({ create: { width: 8, height: 6, channels: 3, background: "#9184d9" } }).webp().toBuffer();
  await a.db.from("shop_photos").delete().eq("shop_id", a.shopId);
}, 40_000);

afterAll(cleanUp);

describe("picture files", () => {
  it("can be added by the owner in their own folder, and seen by anyone", async () => {
    const path = `${a.shopId}/${name()}`;
    const res = await upload(a.db, path);
    expect(res.error).toBeNull();
    uploaded.push(path);
    const publicUrl = anon.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    expect((await fetch(publicUrl)).status).toBe(200);
  });

  it("can't be put in another shop's folder, or the shared demo folder", async () => {
    expect((await upload(a.db, `${b.shopId}/${name()}`)).error).not.toBeNull();
    expect((await upload(a.db, `demo/${name()}`)).error).not.toBeNull();
  });

  it("can't be added by strangers", async () => {
    expect((await upload(anon, `${a.shopId}/${name()}`)).error).not.toBeNull();
  });

  it("refuses SVG pictures (they could carry a script)", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect((await upload(a.db, `${a.shopId}/${name().replace(".webp", ".svg")}`, svg, "image/svg+xml")).error).not.toBeNull();
  });

  it("can't be removed by another owner", async () => {
    const path = uploaded[0];
    await b.db.storage.from(BUCKET).remove([path]);
    const publicUrl = anon.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    expect((await fetch(`${publicUrl}?t=${Date.now()}`)).status).toBe(200);
  });
});

describe("logo", () => {
  it("must be in the shop's own folder or the demo folder", async () => {
    expect((await a.db.from("shops").update({ logo_path: `${a.shopId}/logo.webp` }).eq("id", a.shopId)).error).toBeNull();
    expect((await a.db.from("shops").update({ logo_path: "demo/logo.webp" }).eq("id", a.shopId)).error).toBeNull();
    expect((await a.db.from("shops").update({ logo_path: `${b.shopId}/logo.webp` }).eq("id", a.shopId)).error).not.toBeNull();
  });
});

describe("photos", () => {
  it("are public to read but only the owner adds them", async () => {
    expect((await b.db.from("shop_photos").insert({ shop_id: a.shopId, path: `${a.shopId}/x.webp` })).error).not.toBeNull();
    expect((await anon.from("shop_photos").insert({ shop_id: a.shopId, path: `${a.shopId}/x.webp` })).error).not.toBeNull();
    expect((await a.db.from("shop_photos").insert({ shop_id: a.shopId, path: `${b.shopId}/x.webp` })).error).not.toBeNull();
  });

  it("stop at 6 a shop", async () => {
    for (let i = 0; i < 6; i++) {
      expect((await a.db.from("shop_photos").insert({ shop_id: a.shopId, path: `${a.shopId}/photo-${i}.webp`, position: i })).error).toBeNull();
    }
    const seventh = await a.db.from("shop_photos").insert({ shop_id: a.shopId, path: `${a.shopId}/photo-7.webp` });
    expect(seventh.error?.message).toBe("too_many_photos");
    expect((await anon.from("shop_photos").select("path").eq("shop_id", a.shopId)).data).toHaveLength(6);
  });
});
