/** Everything that can happen to an order. The record is the list of these, in order. */
export type EventType =
  | "rfq.published"
  | "quote.submitted"
  | "quote.accepted"
  | "order.created"
  | "tracking.started"
  | "pod.signed"
  | "invoice.issued"
  | "payment.approved"
  | "payment.released"
  | "returnload.accepted";

export type Role = "shipper" | "carrier" | "driver" | "finance";

export interface Actor {
  companyId: string;
  person: string;
  role: Role | "system";
}

export interface RfqData {
  ref: string;
  origin: string;
  destination: string;
  cargo: string;
  weightT: number;
  pallets: number;
  vehicle: string;
  pickupDate: string;
  deliverBy: string;
  targetPriceEur: number | null;
}

export interface QuoteData {
  quoteId: string;
  carrierId: string;
  priceEur: number;
  transitH: number;
  note: string;
}

export interface OrderData {
  orderNo: string;
  quoteId: string;
  carrierId: string;
  priceEur: number;
  driver: string;
  plate: string;
}

export interface TrackingData {
  startedAt: number;
  /** Real drive is ~9 h; the demo compresses it into this many seconds. */
  durationSec: number;
}

export interface PodData {
  receiver: string;
  signature: string; // SVG path data, drawn on the driver's phone
  photos: string[]; // small JPEG data URLs
  notes: string;
  capturedAt: number;
  capturedOffline: boolean;
}

export interface InvoiceData {
  invoiceNo: string;
  netEur: number;
  vatEur: number;
  totalEur: number;
  dueDate: string;
  podSeq: number;
}

export interface ApprovalData {
  approverId: string;
}

export interface ReturnLoadData {
  loadId: string;
  from: string;
  to: string;
  priceEur: number;
  emptyKmAvoided: number;
}

export interface EventDataMap {
  "rfq.published": RfqData;
  "quote.submitted": QuoteData;
  "quote.accepted": { quoteId: string };
  "order.created": OrderData;
  "tracking.started": TrackingData;
  "pod.signed": PodData;
  "invoice.issued": InvoiceData;
  "payment.approved": ApprovalData;
  "payment.released": { totalEur: number; approvers: string[] };
  "returnload.accepted": ReturnLoadData;
}

export interface UnsealedEvent<T extends EventType = EventType> {
  seq: number;
  type: T;
  at: number;
  actor: Actor;
  data: EventDataMap[T];
  prevHash: string;
}

/** An event once it is on the record: chained to the one before it by hash. */
export interface LedgerEvent<T extends EventType = EventType> extends UnsealedEvent<T> {
  hash: string;
}
