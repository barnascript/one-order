"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { eur } from "@/lib/order";
import { company, person } from "@/lib/parties";
import { getEvents, useRecord } from "@/lib/store";
import type { LedgerEvent } from "@/lib/types";

/**
 * One place for everything the app needs to tell people. Each update shows on screen
 * (so nobody needs sound) and is read out by screen readers (so nobody needs sight).
 */
interface Update {
  id: number;
  title: string;
  text: string;
}

let updates: Update[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function announce(title: string, text: string) {
  const u = { id: nextId++, title, text };
  updates = [...updates.slice(-2), u];
  emit();
  setTimeout(() => dismiss(u.id), 9000);
}

function dismiss(id: number) {
  updates = updates.filter((u) => u.id !== id);
  emit();
}

const name = (id: string) => {
  try {
    return company(id).name;
  } catch {
    return id;
  }
};

/** Plain-language sentence for each event on the record. */
export function describe(e: LedgerEvent): { title: string; text: string } {
  const d = e.data as unknown as Record<string, unknown>;
  switch (e.type) {
    case "rfq.published":
      return { title: "Step 1 · Request", text: `${e.actor.person} published request ${String(d.ref)}: ${String(d.weightT)} tonnes, Rotterdam to Berlin.` };
    case "quote.submitted":
      return { title: "Step 2 · New quote", text: `${name(String(d.carrierId))} quoted ${eur(Number(d.priceEur))}, ${String(d.transitH)} hours in transit.` };
    case "quote.accepted":
      return { title: "Step 2 · Quote accepted", text: `${e.actor.person} accepted a quote. The transport order comes next.` };
    case "order.created":
      return { title: "Step 3 · Transport order", text: `Order ${String(d.orderNo)} created for ${name(String(d.carrierId))}. Driver ${String(d.driver)}.` };
    case "tracking.started":
      return { title: "Step 4 · On the road", text: "The truck left Rotterdam. Live tracking has started." };
    case "pod.signed":
      return {
        title: "Step 5 · Delivered",
        text: `Delivery signed by ${String(d.receiver)}${d.capturedOffline ? ", captured with no signal and sent later" : ""}.`,
      };
    case "invoice.issued":
      return { title: "Step 6 · Invoice", text: `Invoice ${String(d.invoiceNo)} for ${eur(Number(d.totalEur))} written from the signed delivery.` };
    case "payment.approved":
      return { title: "Step 7 · Signature", text: `${person(String(d.approverId)).name} approved the payment.` };
    case "payment.released":
      return { title: "Step 7 · Paid", text: `${eur(Number(d.totalEur))} released to the carrier. The order is complete.` };
    case "returnload.accepted":
      return { title: "Return load", text: `Return load booked: ${String(d.from)} to ${String(d.to)}, ${String(d.emptyKmAvoided)} empty kilometres saved.` };
  }
}

export function Announcer() {
  const { events } = useRecord();
  const seen = useRef<number | null>(null);
  const list = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => updates,
    () => updates,
  );
  const [ready, setReady] = useState(false);

  // Announce only what happens from now on, not the history already on the record.
  useEffect(() => {
    if (seen.current === null) {
      // Count what is already on the record (not the empty first render), so old steps stay quiet.
      seen.current = Math.max(events.length, getEvents().length);
      setReady(true);
      return;
    }
    for (const e of events.slice(seen.current)) {
      const { title, text } = describe(e);
      announce(title, text);
    }
    seen.current = events.length;
  }, [events]);

  return (
    <div className="updates" role="log" aria-live="polite" aria-relevant="additions" aria-label="Updates">
      {ready &&
        list.map((u) => (
          <div key={u.id} className="update">
            <span>
              <b>{u.title}</b>
              {u.text}
            </span>
            <button type="button" onClick={() => dismiss(u.id)} aria-label={`Dismiss: ${u.title}`}>
              ×
            </button>
          </div>
        ))}
    </div>
  );
}
