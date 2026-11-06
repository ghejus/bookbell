import { describe, expect, it } from "vitest";
import { averageText, replySchema, reviewAuthor, reviewCount, reviewSchema, starsLabel } from "./reviews";

describe("reviewAuthor", () => {
  it("keeps the first name and the first letter of the last name", () => {
    expect(reviewAuthor("Ana Popescu")).toBe("Ana P.");
    expect(reviewAuthor("  Ana   Maria  popescu ")).toBe("Ana P.");
    expect(reviewAuthor("Ștefan ionescu")).toBe("Ștefan I.");
  });
  it("keeps a single name as it is, and gives nothing for no name", () => {
    expect(reviewAuthor("Ana")).toBe("Ana");
    expect(reviewAuthor("   ")).toBe("");
  });
  it("cuts a very long first name", () => {
    expect(reviewAuthor(`${"A".repeat(60)} B`)).toBe(`${"A".repeat(40)} B.`);
  });
});

describe("words", () => {
  it("says stars and counts the right way", () => {
    expect(starsLabel(1)).toBe("1 out of 5 stars");
    expect(starsLabel(4)).toBe("4 out of 5 stars");
    expect(reviewCount(1)).toBe("1 review");
    expect(reviewCount(23)).toBe("23 reviews");
    expect(averageText(4.75)).toBe("4.8");
    expect(averageText(5)).toBe("5.0");
  });
});

describe("reviewSchema", () => {
  it("needs a star from 1 to 5", () => {
    expect(reviewSchema.safeParse({ stars: "4", body: " Nice " }).data).toEqual({ stars: 4, body: "Nice" });
    expect(reviewSchema.safeParse({ body: "No star" }).success).toBe(false);
    expect(reviewSchema.safeParse({ stars: "0" }).success).toBe(false);
    expect(reviewSchema.safeParse({ stars: "6" }).success).toBe(false);
  });
  it("lets the words be empty but not too long", () => {
    expect(reviewSchema.safeParse({ stars: "5" }).data).toEqual({ stars: 5, body: "" });
    expect(reviewSchema.safeParse({ stars: "5", body: "x".repeat(1001) }).success).toBe(false);
  });
  it("lets the owner's reply be empty (to remove it)", () => {
    expect(replySchema.safeParse({ id: "4b0a7c2e-8f8e-4c5b-9a43-2b1f3c4d5e6f", reply: "  " }).data?.reply).toBe("");
  });
});
