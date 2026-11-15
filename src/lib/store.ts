"use client";

import { useSyncExternalStore } from "react";
import { seal } from "./ledger";
import { buildInvoice, deriveOrder } from "./order";
import { DRIVERS, person } from "./parties";
import { releaseCheck } from "./payment";
import type { Actor, EventDataMap, EventType, LedgerEvent, PodData } from "./types";

/**
 * The shared record lives in the browser for this demo (localStorage), so every role you
 * switch to sees the same order. In production this would be the network's ledger; the
 * screens only ever read events and append new ones, so swapping the backend is one module.
 */
interface State {
  events: LedgerEvent[];
  outbox: PodData[];
}

const KEY = "one-order:v1";
const EMPTY: State = { events: [], outbox: [] };
let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();
let chain: Promise<unknown> = Promise.resolve();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...(JSON.parse(raw) as State) };
  } catch {
    state = EMPTY;
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try {
      state = e.newValue ? { ...EMPTY, ...(JSON.parse(e.newValue) as State) } : EMPTY;
    } catch {
      state = EMPTY;
    }
    emit();
  });
  resumeAutomations();
}

function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode or full: the demo still works in memory */
  }
}

function emit() {
  for (const l of listeners) l();
}

function set(next: State) {
  state = next;
  save();
  emit();
}

export function actorFor(personId: string): Actor {
  const p = person(personId);
  return { companyId: p.companyId, person: p.name, role: p.role };
}

const SYSTEM: Actor = { companyId: "network", person: "One Order", role: "system" };

/** Appends run one at a time so the hash chain never forks. */
export function append<T extends EventType>(type: T, actor: Actor, data: EventDataMap[T]): Promise<LedgerEvent<T>> {
  const run = chain.then(async () => {
    const ev = await seal(state.events, type, actor, data);
    set({ ...state, events: [...state.events, ev] });
    afterAppend(ev);
    return ev;
  });
  chain = run.catch(() => undefined);
  return run;
}

// --- things the network does on its own -------------------------------------------------

const MARKET_QUOTES = [
  { carrierId: "elbe", priceEur: 1390, transitH: 11, note: "Return leg to Magdeburg, can load same day.", delay: 1600 },
  { carrierId: "kowal", priceEur: 1240, transitH: 14, note: "Driver change in Hannover. Tail-lift on request.", delay: 3200 },
];

const timers = new Set<ReturnType<typeof setTimeout>>();
function later(ms: number, fn: () => void) {
  const t = setTimeout(() => {
    timers.delete(t);
    fn();
  }, ms);
  timers.add(t);
}

function scheduleMarketQuotes() {
  for (const q of MARKET_QUOTES) {
    later(q.delay, () => {
      const s = deriveOrder(state.events);
      if (s.acceptedQuoteId || s.quotes.some((x) => x.carrierId === q.carrierId)) return;
      const rep = q.carrierId === "elbe" ? "Katrin Vogel" : "Piotr Kowalski";
      void append(
        "quote.submitted",
        { companyId: q.carrierId, person: rep, role: "carrier" },
        { quoteId: `Q-${q.carrierId}`, carrierId: q.carrierId, priceEur: q.priceEur, transitH: q.transitH, note: q.note },
      );
    });
  }
}

function afterAppend(ev: LedgerEvent) {
  if (ev.type === "rfq.published") scheduleMarketQuotes();
  if (ev.type === "quote.accepted") later(600, createOrderIfDue);
  if (ev.type === "pod.signed") later(700, issueInvoiceIfDue);
  if (ev.type === "payment.approved") later(500, releaseIfAllowed);
}

function createOrderIfDue() {
  const s = deriveOrder(state.events);
  const q = s.quotes.find((x) => x.quoteId === s.acceptedQuoteId);
  if (!q || s.order || !s.rfq) return;
  const d = DRIVERS[q.carrierId] ?? { name: "Driver", plate: "—" };
  void append("order.created", SYSTEM, {
    orderNo: s.rfq.ref.replace("RFQ-", "TO-"),
    quoteId: q.quoteId,
    carrierId: q.carrierId,
    priceEur: q.priceEur,
    driver: d.name,
    plate: d.plate,
  });
}

function issueInvoiceIfDue() {
  const s = deriveOrder(state.events);
  if (!s.order || !s.pod || s.invoice) return;
  void append("invoice.issued", SYSTEM, buildInvoice(s.order, s.pod.seq, Date.now()));
}

function releaseIfAllowed() {
  const s = deriveOrder(state.events);
  if (!s.invoice || s.paid) return;
  const ids = s.approvals.map((a) => a.approverId);
  const check = releaseCheck(s.invoice.totalEur, ids);
  if (check.canRelease) void append("payment.released", SYSTEM, { totalEur: s.invoice.totalEur, approvers: check.approvers });
}

function resumeAutomations() {
  const s = deriveOrder(state.events);
  if (s.rfq && !s.acceptedQuoteId) scheduleMarketQuotes();
  if (s.acceptedQuoteId && !s.order) later(300, createOrderIfDue);
  if (s.pod && !s.invoice) later(300, issueInvoiceIfDue);
  if (s.approvals.length && !s.paid) later(300, releaseIfAllowed);
}

// --- driver outbox: proof of delivery captured with no signal --------------------------

export function queuePod(pod: PodData) {
  set({ ...state, outbox: [...state.outbox, pod] });
}

export async function flushOutbox(): Promise<number> {
  const pending = state.outbox;
  if (!pending.length) return 0;
  set({ ...state, outbox: [] });
  for (const pod of pending) {
    if (deriveOrder(state.events).pod) break; // already delivered once: never sign twice
    const o = deriveOrder(state.events).order;
    await append("pod.signed", { companyId: o?.carrierId ?? "vandijk", person: o?.driver ?? "Driver", role: "driver" }, pod);
  }
  return pending.length;
}

// --- reset ------------------------------------------------------------------------------

export function resetRecord() {
  for (const t of timers) clearTimeout(t);
  timers.clear();
  set(EMPTY);
}

/** Dev/test only: replace the record wholesale (used by the tamper demo on a COPY, never here). */
export function getEvents(): readonly LedgerEvent[] {
  return state.events;
}

// --- React binding ----------------------------------------------------------------------

function subscribe(fn: () => void) {
  load();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const getSnapshot = () => {
  load();
  return state;
};
const getServerSnapshot = () => EMPTY;

export function useRecord(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
