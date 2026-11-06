import { describe, expect, it } from "vitest";
import { checkTicket, issueTicket, TICKET_LIFE_MS, TOO_FAST_MS } from "./form-guard";

const secret = "test-secret";
const shop = "11111111-1111-4111-8111-111111111111";
const t0 = 1_800_000_000_000;

describe("booking form ticket", () => {
  const ticket = issueTicket(secret, shop, t0);

  it("accepts a form sent back after a normal wait", () => {
    expect(checkTicket(secret, shop, ticket, t0 + 30_000)).toBe("ok");
  });

  it("stops forms sent back too fast", () => {
    expect(checkTicket(secret, shop, ticket, t0 + 300)).toBe("too_fast");
    expect(checkTicket(secret, shop, ticket, t0 + TOO_FAST_MS)).toBe("ok");
  });

  it("stops very old pages", () => {
    expect(checkTicket(secret, shop, ticket, t0 + TICKET_LIFE_MS + 1)).toBe("expired");
  });

  it("stops faked, changed or borrowed tickets", () => {
    expect(checkTicket(secret, shop, "", t0)).toBe("bad");
    expect(checkTicket(secret, shop, "nonsense", t0)).toBe("bad");
    expect(checkTicket(secret, shop, `${t0 - 60_000}.${ticket.split(".")[1]}`, t0)).toBe("bad");
    expect(checkTicket("other-secret", shop, ticket, t0 + 30_000)).toBe("bad");
    expect(checkTicket(secret, "22222222-2222-4222-8222-222222222222", ticket, t0 + 30_000)).toBe("bad");
    expect(checkTicket(secret, shop, `${ticket}.x`, t0 + 30_000)).toBe("bad");
  });

  it("stops tickets from the future", () => {
    expect(checkTicket(secret, shop, issueTicket(secret, shop, t0 + 60_000), t0)).toBe("bad");
  });
});
