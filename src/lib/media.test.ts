import { describe, expect, it } from "vitest";
import { isShopMediaPath, mediaUrl } from "./media";

const shop = "11111111-1111-4111-8111-111111111111";

describe("isShopMediaPath", () => {
  it("accepts files in the shop's own folder or the demo folder", () => {
    expect(isShopMediaPath(`${shop}/abc123.webp`, shop)).toBe(true);
    expect(isShopMediaPath("demo/logo.webp", shop)).toBe(true);
  });

  it("refuses other shops' folders, deeper folders and odd names", () => {
    expect(isShopMediaPath("22222222-2222-4222-8222-222222222222/a.webp", shop)).toBe(false);
    expect(isShopMediaPath(`${shop}/../other/a.webp`, shop)).toBe(false);
    expect(isShopMediaPath(`${shop}/sub/a.webp`, shop)).toBe(false);
    expect(isShopMediaPath(`${shop}/a b.webp`, shop)).toBe(false);
    expect(isShopMediaPath("a.webp", shop)).toBe(false);
  });
});

describe("mediaUrl", () => {
  it("points at the public bucket", () => {
    expect(mediaUrl("demo/logo.webp")).toMatch(/\/storage\/v1\/object\/public\/shop-media\/demo\/logo\.webp$/);
  });
});
