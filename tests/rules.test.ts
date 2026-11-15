import { describe, expect, it } from "vitest";
import { emptyRunKg, footprint } from "@/lib/carbon";
import { buildInvoice, deriveOrder } from "@/lib/order";
import { canApprove, releaseCheck } from "@/lib/payment";
import { BORDER_KM, TOTAL_KM, positionAt } from "@/lib/route";
import { seal } from "@/lib/ledger";
import type { LedgerEvent } from "@/lib/types";

describe("two-signature payments", () => {
  it("lets a payment inside the first signer's limit go with one signature", () => {
    expect(releaseCheck(900, ["anouk"]).canRelease).toBe(true);
  });
  it("holds a payment above the first signer's limit", () => {
    const c = releaseCheck(1320, ["anouk"]);
    expect(c.canRelease).toBe(false);
    expect(c.needs).toMatch(/second signer/);
  });
  it("releases once a second person with a high enough limit signs", () => {
    expect(releaseCheck(1320, ["anouk", "marco"]).canRelease).toBe(true);
  });
  it("never counts the same person twice", () => {
    expect(releaseCheck(1320, ["anouk", "anouk"]).canRelease).toBe(false);
    expect(canApprove("anouk", ["anouk"]).ok).toBe(false);
  });
});

describe("route", () => {
  it("is about as long as the real Rotterdam → Berlin drive (~690 km)", () => {
    expect(TOTAL_KM).toBeGreaterThan(650);
    expect(TOTAL_KM).toBeLessThan(730);
  });
  it("starts in Rotterdam, ends in Berlin, crosses the border on the way", () => {
    expect(positionAt(0).near).toBe("Rotterdam");
    expect(positionAt(1).near).toBe("Berlin");
    expect(BORDER_KM).toBeGreaterThan(0);
    expect(BORDER_KM).toBeLessThan(TOTAL_KM / 2);
  });
  it("clamps progress outside 0..1", () => {
    expect(positionAt(-1).km).toBe(0);
    expect(positionAt(2).km).toBeCloseTo(TOTAL_KM);
  });
});

describe("carbon (ISO 14083 style, default factors)", () => {
  it("well-to-wheel is always more than tank-to-wheel", () => {
    const f = footprint(690, 22);
    expect(f.wtwKg).toBeGreaterThan(f.ttwKg);
  });
  it("a full truckload carries all of the truck's emissions; half a load carries half", () => {
    expect(footprint(690, 24).allocation).toBe(1);
    expect(footprint(690, 12).wtwKg).toBeCloseTo(footprint(690, 24).wtwKg / 2);
  });
  it("lands in a believable range for a loaded 40 t truck", () => {
    const f = footprint(690, 22);
    expect(f.gramsPerTonneKm).toBeGreaterThan(30);
    expect(f.gramsPerTonneKm).toBeLessThan(80);
  });
  it("counts the empty run home", () => {
    expect(emptyRunKg(560)).toBeGreaterThan(300);
  });
});

describe("order state", () => {
  it("moves through the steps as events arrive, and writes the invoice from the order", async () => {
    const rec: LedgerEvent[] = [];
    const sys = { companyId: "network", person: "One Order", role: "system" as const };
    expect(deriveOrder(rec).current).toBe(0);
    rec.push(await seal(rec, "rfq.published", sys, {
      ref: "RFQ-26-1000", origin: "R", destination: "B", cargo: "c", weightT: 22, pallets: 33,
      vehicle: "v", pickupDate: "2026-11-16", deliverBy: "2026-11-17", targetPriceEur: null,
    }));
    expect(deriveOrder(rec).current).toBe(1);
    rec.push(await seal(rec, "quote.submitted", sys, { quoteId: "Q-1", carrierId: "vandijk", priceEur: 1320, transitH: 10, note: "" }));
    rec.push(await seal(rec, "quote.accepted", sys, { quoteId: "Q-1" }));
    const order = { orderNo: "TO-26-1000", quoteId: "Q-1", carrierId: "vandijk", priceEur: 1320, driver: "Jan", plate: "X" };
    rec.push(await seal(rec, "order.created", sys, order));
    expect(deriveOrder(rec).current).toBe(3);
    const inv = buildInvoice(order, 7, Date.UTC(2026, 10, 16));
    expect(inv).toMatchObject({ invoiceNo: "INV-26-1000", netEur: 1320, totalEur: 1320, dueDate: "2026-12-16" });
  });
});
