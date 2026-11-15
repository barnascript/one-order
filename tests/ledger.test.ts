import { describe, expect, it } from "vitest";
import { GENESIS, canonical, seal, verify } from "@/lib/ledger";
import type { Actor, LedgerEvent } from "@/lib/types";

const sanne: Actor = { companyId: "delta", person: "Sanne de Vries", role: "shipper" };

async function sample(): Promise<LedgerEvent[]> {
  const rec: LedgerEvent[] = [];
  rec.push(
    await seal(rec, "rfq.published", sanne, {
      ref: "RFQ-26-1000", origin: "Rotterdam", destination: "Berlin", cargo: "Veg", weightT: 22, pallets: 33,
      vehicle: "Reefer", pickupDate: "2026-11-16", deliverBy: "2026-11-17", targetPriceEur: null,
    }, 1),
  );
  rec.push(await seal(rec, "quote.submitted", { companyId: "vandijk", person: "Ruud", role: "carrier" },
    { quoteId: "Q-1", carrierId: "vandijk", priceEur: 1320, transitH: 10, note: "" }, 2));
  rec.push(await seal(rec, "quote.accepted", sanne, { quoteId: "Q-1" }, 3));
  return rec;
}

describe("canonical JSON", () => {
  it("does not depend on key order", () => {
    expect(canonical({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe(canonical({ a: { c: [3, { e: 0, f: 1 }], d: 2 }, b: 1 }));
  });
});

describe("hash chain", () => {
  it("links every event to the one before it", async () => {
    const rec = await sample();
    expect(rec[0]!.prevHash).toBe(GENESIS);
    expect(rec[1]!.prevHash).toBe(rec[0]!.hash);
    expect(rec[2]!.prevHash).toBe(rec[1]!.hash);
    expect(await verify(rec)).toEqual({ ok: true });
  });

  it("catches a changed price", async () => {
    const rec = structuredClone(await sample());
    (rec[1]!.data as { priceEur: number }).priceEur = 1720;
    expect(await verify(rec)).toMatchObject({ ok: false, seq: 2, reason: "contents changed after it was recorded" });
  });

  it("catches a deleted event", async () => {
    const rec = await sample();
    const cut = [rec[0]!, { ...rec[2]!, seq: 2 }];
    expect((await verify(cut)).ok).toBe(false);
  });

  it("catches a re-hashed forgery that does not point at the real previous event", async () => {
    const rec = await sample();
    const forged = await seal([rec[0]!], "quote.submitted", { companyId: "vandijk", person: "Ruud", role: "carrier" },
      { quoteId: "Q-1", carrierId: "vandijk", priceEur: 1720, transitH: 10, note: "" }, 2);
    // forged event is valid on its own, but event 3 still points at the ORIGINAL event 2
    expect(await verify([rec[0]!, forged, rec[2]!])).toMatchObject({ ok: false, seq: 3 });
  });
});
