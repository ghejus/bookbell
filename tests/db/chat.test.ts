/**
 * Chat helper limits against the real database (part of `npm run test:db`).
 * A stranger calls take_chat_turn directly, the way a hand-made request would.
 *
 * Each run uses about 22 of test shop A's 300 daily turns. If a busy day of
 * test runs uses them all up, the limit tests skip instead of failing.
 */
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { client, testOwners, type TestOwner } from "./helpers";

const anon = client();
let a: TestOwner;
const visitor = `test-${randomUUID()}`;
const take = (who = visitor, shopId = a.shopId) => anon.rpc("take_chat_turn", { p_shop_id: shopId, p_visitor: who });

beforeAll(async () => {
  ({ a } = await testOwners());
}, 30_000);

describe("chat limits", () => {
  it("lets a visitor send 20 messages an hour, then says wait", async (ctx) => {
    const first = await take();
    expect(first.error).toBeNull();
    if (first.data === "shop_limit") ctx.skip(); // test shop used up today's turns
    expect(first.data).toBe("ok");
    for (let i = 2; i <= 20; i++) expect((await take()).data).toBe("ok");
    expect((await take()).data).toBe("visitor_limit");
    expect((await take()).data).toBe("visitor_limit");
  }, 60_000);

  it("counts each visitor on their own", async (ctx) => {
    const res = await take(`test-${randomUUID()}`);
    if (res.data === "shop_limit") ctx.skip();
    expect(res.data).toBe("ok");
  });

  it("says when the shop doesn't exist", async () => {
    expect((await take(visitor, randomUUID())).data).toBe("shop_not_found");
  });

  it("refuses a missing or too-short visitor code", async () => {
    expect((await take("short")).error?.message).toBe("invalid_visitor");
    expect((await take("")).error?.message).toBe("invalid_visitor");
  });

  it("keeps the turns table closed to strangers and owners", async () => {
    const asStranger = await anon.from("chat_turns").select("*").limit(1);
    expect(asStranger.data ?? []).toEqual([]);
    const asOwner = await a.db.from("chat_turns").select("*").limit(1);
    expect(asOwner.data ?? []).toEqual([]);
    const write = await anon.from("chat_turns").insert({ shop_id: a.shopId, visitor: "test-write-attempt" });
    expect(write.error).not.toBeNull();
  });
});
