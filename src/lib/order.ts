import type {
  ApprovalData,
  InvoiceData,
  LedgerEvent,
  OrderData,
  PodData,
  QuoteData,
  ReturnLoadData,
  RfqData,
  TrackingData,
} from "./types";

export const STEPS = [
  { key: "request", label: "Request", hint: "Shipper describes the load once" },
  { key: "quotes", label: "Quotes", hint: "Carriers quote on the same request" },
  { key: "order", label: "Transport order", hint: "Accepted quote becomes the order" },
  { key: "tracking", label: "Track & trace", hint: "Live position from pickup to drop" },
  { key: "pod", label: "Proof of delivery", hint: "Signed on the driver's phone" },
  { key: "invoice", label: "Invoice", hint: "Written from the signed delivery" },
  { key: "payment", label: "Payment", hint: "Released after the right signatures" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export interface OrderView {
  rfq: RfqData | null;
  quotes: (QuoteData & { seq: number; at: number })[];
  acceptedQuoteId: string | null;
  order: OrderData | null;
  tracking: TrackingData | null;
  pod: (PodData & { seq: number; at: number }) | null;
  invoice: InvoiceData | null;
  approvals: (ApprovalData & { at: number })[];
  paid: boolean;
  returnLoad: ReturnLoadData | null;
  /** Index into STEPS of the step currently waiting for someone. 7 = all done. */
  current: number;
}

const ofType = <T extends LedgerEvent["type"]>(events: readonly LedgerEvent[], type: T) =>
  events.filter((e): e is LedgerEvent<T> => e.type === type);

export function deriveOrder(events: readonly LedgerEvent[]): OrderView {
  const rfq = ofType(events, "rfq.published")[0]?.data ?? null;
  const quotes = ofType(events, "quote.submitted").map((e) => ({ ...e.data, seq: e.seq, at: e.at }));
  const acceptedQuoteId = ofType(events, "quote.accepted")[0]?.data.quoteId ?? null;
  const order = ofType(events, "order.created")[0]?.data ?? null;
  const tracking = ofType(events, "tracking.started")[0]?.data ?? null;
  const podEv = ofType(events, "pod.signed")[0];
  const pod = podEv ? { ...podEv.data, seq: podEv.seq, at: podEv.at } : null;
  const invoice = ofType(events, "invoice.issued")[0]?.data ?? null;
  const approvals = ofType(events, "payment.approved").map((e) => ({ ...e.data, at: e.at }));
  const paid = ofType(events, "payment.released").length > 0;
  const returnLoad = ofType(events, "returnload.accepted")[0]?.data ?? null;

  let current = 0;
  if (rfq) current = 1;
  if (acceptedQuoteId) current = 2;
  if (order) current = 3;
  if (tracking) current = 4;
  if (pod) current = 5;
  if (invoice) current = 6;
  if (paid) current = 7;

  return { rfq, quotes, acceptedQuoteId, order, tracking, pod, invoice, approvals, paid, returnLoad, current };
}

export function trackingProgress(tracking: TrackingData | null, now: number): number {
  if (!tracking) return 0;
  return Math.min(1, Math.max(0, (now - tracking.startedAt) / (tracking.durationSec * 1000)));
}

export const VAT_RATE = 0; // cross-border B2B transport: reverse charge, VAT accounted by the buyer

export function buildInvoice(order: OrderData, podSeq: number, issuedAt: number): InvoiceData {
  const net = order.priceEur;
  const vat = Math.round(net * VAT_RATE * 100) / 100;
  const due = new Date(issuedAt + 30 * 86400_000).toISOString().slice(0, 10);
  return {
    invoiceNo: order.orderNo.replace("TO-", "INV-"),
    netEur: net,
    vatEur: vat,
    totalEur: net + vat,
    dueDate: due,
    podSeq,
  };
}

export const eur = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
