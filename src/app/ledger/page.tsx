"use client";

import { useEffect, useState } from "react";
import { Dock, Footer, Header } from "@/components/Shell";
import { verify, type Verdict } from "@/lib/ledger";
import { eur } from "@/lib/order";
import { useRecord } from "@/lib/store";
import type { LedgerEvent } from "@/lib/types";

const LABEL: Record<LedgerEvent["type"], string> = {
  "rfq.published": "Request published",
  "quote.submitted": "Quote submitted",
  "quote.accepted": "Quote accepted",
  "order.created": "Transport order created",
  "tracking.started": "Trip started",
  "pod.signed": "Delivery signed",
  "invoice.issued": "Invoice issued",
  "payment.approved": "Payment approved",
  "payment.released": "Payment released",
  "returnload.accepted": "Return load booked",
};

function summary(e: LedgerEvent): string {
  const d = e.data as unknown as Record<string, unknown>;
  if (typeof d.priceEur === "number") return eur(d.priceEur);
  if (typeof d.totalEur === "number") return eur(d.totalEur);
  if (e.type === "pod.signed") return `signed by ${String(d.receiver)}${d.capturedOffline ? " (offline)" : ""}`;
  if (e.type === "rfq.published") return `${String(d.weightT)} t · ${String(d.ref)}`;
  if (e.type === "payment.approved") return String(d.approverId);
  return "";
}

/** Changes the money in one event of a COPY of the record, to show the chain catching it. */
function tamper(record: readonly LedgerEvent[]): LedgerEvent[] {
  const copy = structuredClone(record) as LedgerEvent[];
  const target = copy.find((e) => e.type === "order.created") ?? copy.find((e) => e.type === "quote.submitted") ?? copy[0];
  if (target) {
    const d = target.data as unknown as Record<string, unknown>;
    if (typeof d.priceEur === "number") d.priceEur = d.priceEur + 400;
    else d.tampered = true;
  }
  return copy;
}

export default function LedgerPage() {
  const { events } = useRecord();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [tampered, setTampered] = useState<{ record: LedgerEvent[]; verdict: Verdict } | null>(null);

  useEffect(() => {
    let live = true;
    void verify(events).then((v) => live && setVerdict(v));
    setTampered(null);
    return () => {
      live = false;
    };
  }, [events]);

  const shown = tampered?.record ?? events;
  const brokenAt = tampered && !tampered.verdict.ok ? tampered.verdict.seq : null;

  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="slate w">Sc. 09 / Int. the record itself / always</div>
          <h1 className="d">
            <span className="l1">Nobody edits history.</span>
            <span className="l2" style={{ fontSize: "clamp(70px, 12vw, 180px)" }}>
              The record
            </span>
          </h1>
          <p className="lede">
            I save every step of the order as an event, and each event carries the fingerprint (SHA-256) of the one before it. If anyone changes anything
            afterwards, every fingerprint from that point on breaks. I used the same idea as the permissioned ledger under a freight network, but kept it small
            enough to read.
          </p>
          <div className="actions">
            {verdict && (
              <span className={`verdict w${verdict.ok ? "" : " bad"}`}>
                {events.length === 0 ? "Empty record" : verdict.ok ? `${events.length} events · chain intact` : `Broken at #${verdict.seq}: ${verdict.reason}`}
              </span>
            )}
            {events.length > 0 && !tampered && (
              <button className="btn btn--o btn--sm" onClick={async () => {
                const record = tamper(events);
                setTampered({ record, verdict: await verify(record) });
              }}>
                Try to change the price
              </button>
            )}
            {tampered && (
              <>
                <span className="verdict w bad">
                  {tampered.verdict.ok ? "Not detected?" : `Caught: #${tampered.verdict.seq} ${tampered.verdict.reason}`}
                </span>
                <button className="btn btn--sm" onClick={() => setTampered(null)}>
                  Put it back
                </button>
              </>
            )}
          </div>
          <p className="note">My tamper test edits a copy in your browser. It never touches the real record.</p>
        </section>

        <section className="scene">
          {shown.length === 0 ? (
            <p className="waiting">
              Nothing recorded yet. <a href="/#request">Start the order</a>.
            </p>
          ) : (
            <ol className="ledger">
              {shown.map((e) => (
                <li key={e.seq} className={brokenAt !== null && e.seq >= brokenAt ? "broken" : ""}>
                  <span className="seq">{e.seq}</span>
                  <span>
                    <b>{LABEL[e.type]}</b>
                    <br />
                    <span className="mute" style={{ fontSize: 13 }}>
                      {e.actor.person} · {new Date(e.at).toLocaleTimeString("en-GB")}
                    </span>
                  </span>
                  <span>{summary(e)}</span>
                  <span className="h mono" title={e.hash}>
                    {e.hash.slice(0, 16)}… ← {e.prevHash.slice(0, 8)}…
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
      <Footer />
      <Dock />
    </>
  );
}
