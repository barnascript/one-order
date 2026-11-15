"use client";

import { useEffect, useState } from "react";
import { deriveOrder, STEPS, eur, type OrderView } from "@/lib/order";
import { company } from "@/lib/parties";
import { useRole } from "@/lib/role";
import { useRecord } from "@/lib/store";
import type { Role } from "@/lib/types";
import { DriverApp } from "./DriverApp";
import { Scene, Waiting } from "./Scene";
import { InvoiceStep, OrderStep, PaymentStep, QuotesStep, RequestStep } from "./Steps";
import { CarbonAndReturn, TrackingStep } from "./Tracking";

function PodStep({ v, role }: { v: OrderView; role: Role }) {
  return (
    <Scene id="pod" n={5} slate="Ext. Berlin-Neukölln, goods-in / 15:40" title={<>Proof of <em>delivery</em></>} cream locked={!v.tracking}>
      {!v.tracking ? (
        <Waiting>The driver captures the signature, photos and notes on their phone at handover.</Waiting>
      ) : (
        <div className="phone-wrap">
          {role === "driver" ? (
            <DriverApp v={v} />
          ) : (
            <Waiting>
              This happens on the driver&apos;s phone. Switch to <b>Driver</b>, or open the <a href="/driver">driver app</a> on a phone.
            </Waiting>
          )}
          <div>
            <p className="lede" style={{ marginTop: 0 }}>
              Loading docks are where signal dies. The driver app keeps working with no signal: it saves the signed delivery on the phone and sends it when
              the signal comes back. The record notes that it was captured offline, so nobody argues about the time later.
            </p>
            {v.pod && (
              <div className="grid g2" style={{ marginTop: 20 }}>
                <div className="cell">
                  <span className="w">Signed by</span>
                  <div className="v">{v.pod.receiver}</div>
                  <div className="s">
                    {new Date(v.pod.capturedAt).toLocaleTimeString("en-GB")}
                    {v.pod.capturedOffline ? " · captured offline" : ""}
                  </div>
                </div>
                <div className="cell">
                  <span className="w">Signature</span>
                  <svg viewBox="0 0 300 150" style={{ width: "100%", height: 80, display: "block" }} aria-label="Receiver's signature">
                    <path d={v.pod.signature} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
                  </svg>
                  <div className="s">
                    {v.pod.photos.length} photo{v.pod.photos.length === 1 ? "" : "s"} · {v.pod.notes}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Scene>
  );
}

const ROLE_INTRO: Record<Role, string> = {
  shipper: "You are Sanne, the planner at Delta Fresh Foods. You post the load and pick a carrier.",
  carrier: "You are Ruud at Van Dijk Transport, six trucks. You quote, load, and look for a return trip.",
  driver: "You are the driver. Your phone gets the signature at the door, signal or not.",
  finance: "You are Delta's finance team. Above Anouk's €1,000 limit, a second person must sign.",
};

export function OrderPage() {
  const { events } = useRecord();
  const role = useRole();
  const v = deriveOrder(events);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main id="main">
      <section className="hero">
        <div className="slate w">Sc. 00 / Int. one shared record / {mounted && v.current < 7 ? `step ${v.current + 1} of 7` : mounted ? "the end" : "…"}</div>
        <h1 className="d">
          <span className="l1">One order. No loose ends.</span>
          <span className="l2">
            Rotterdam <span className="arrow">→</span>
            <br />
            Berlin
          </span>
        </h1>
        <p className="lede">
          A working freight order from the first request to the last payment. Every company sees the same record, every step is signed onto it, and
          nothing gets typed twice. Switch who you are in the bar at the bottom.
        </p>
        <div className="cta">
          <a className="btn btn--o" href={`#${STEPS[Math.min(v.current, 6)]!.key}`}>
            {v.current === 0 ? "Start the order" : v.current >= 7 ? "See how it ended" : "Continue the order"}
          </a>
          <a className="btn" href="/ledger">
            Inspect the record
          </a>
        </div>
        <div className="strap w">
          <span>{mounted ? ROLE_INTRO[role] : ""}</span>
          <span>
            {v.order ? `${v.order.orderNo} · ${company(v.order.carrierId).name} · ${eur(v.order.priceEur)}` : "Seven steps. One record. Scroll."}
          </span>
        </div>
      </section>

      <nav className="rail" aria-label="Steps" id="record">
        {STEPS.map((s, i) => (
          <a key={s.key} href={`#${s.key}`} className={i < v.current ? "done" : i === v.current ? "now" : ""} aria-current={i === v.current ? "step" : undefined}>
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <span className="t w">{s.label}</span>
          </a>
        ))}
      </nav>

      <RequestStep v={v} role={role} />
      <QuotesStep v={v} role={role} />
      <OrderStep v={v} role={role} />
      <TrackingStep v={v} role={role} />
      <PodStep v={v} role={role} />
      <InvoiceStep v={v} />
      <PaymentStep v={v} role={role} />
      <CarbonAndReturn v={v} role={role} />
    </main>
  );
}
