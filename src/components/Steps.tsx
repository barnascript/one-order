"use client";

import { useState } from "react";
import { footprint } from "@/lib/carbon";
import { eur, type OrderView } from "@/lib/order";
import { company, person, YOU_AS_CARRIER } from "@/lib/parties";
import { canApprove, releaseCheck } from "@/lib/payment";
import { TOTAL_KM } from "@/lib/route";
import { actorFor, append } from "@/lib/store";
import type { RfqData, Role } from "@/lib/types";
import { Cell, Scene, Waiting } from "./Scene";

const km = Math.round(TOTAL_KM);
const dateIn = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
const time = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

// ---------------------------------------------------------------- 1. request

export function RequestStep({ v, role }: { v: OrderView; role: Role }) {
  const [f, setF] = useState<RfqData>(() => ({
    ref: `RFQ-26-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    origin: "Delta Fresh Foods DC, Rotterdam (NL)",
    destination: "Frischemarkt Berlin-Neukölln (DE)",
    cargo: "Chilled vegetables, 2–4 °C",
    weightT: 22,
    pallets: 33,
    vehicle: "Reefer trailer 13.6 m",
    pickupDate: dateIn(1),
    deliverBy: dateIn(2),
    targetPriceEur: 1400,
  }));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RfqData>(k: K, val: RfqData[K]) => setF((x) => ({ ...x, [k]: val }));
  const valid = f.origin && f.destination && f.cargo && f.weightT > 0 && f.weightT <= 24 && f.pallets > 0 && f.deliverBy >= f.pickupDate;

  return (
    <Scene id="request" n={1} slate="Ext. Rotterdam dock / 06:00" title={<>The <em>request</em></>} cream>
      {v.rfq ? (
        <div className="grid g4">
          <Cell label="Reference" value={v.rfq.ref} sub={`Posted by ${person("sanne").name}`} />
          <Cell label="Lane" value="NL → DE" sub={`${v.rfq.origin} → ${v.rfq.destination}`} />
          <Cell label="Load" value={`${v.rfq.weightT} t`} sub={`${v.rfq.pallets} pallets · ${v.rfq.cargo}`} />
          <Cell label="Window" value={v.rfq.deliverBy.slice(5).replace("-", ".")} sub={`Pickup ${v.rfq.pickupDate} · ${v.rfq.vehicle}`} />
        </div>
      ) : role !== "shipper" ? (
        <Waiting>
          Nothing to do yet. <b>{person("sanne").name}</b> at {company("delta").name} posts the request. Switch to <b>Shipper</b> in the bar below.
        </Waiting>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid || busy) return;
            setBusy(true);
            await append("rfq.published", actorFor("sanne"), f);
            setBusy(false);
          }}
        >
          <div className="form">
            <label className="span2">
              <span className="w">Pick up at</span>
              <input value={f.origin} onChange={(e) => set("origin", e.target.value)} required />
            </label>
            <label className="span2">
              <span className="w">Deliver to</span>
              <input value={f.destination} onChange={(e) => set("destination", e.target.value)} required />
            </label>
            <label className="span2">
              <span className="w">Cargo</span>
              <input value={f.cargo} onChange={(e) => set("cargo", e.target.value)} required />
            </label>
            <label>
              <span className="w">Weight (t, max 24)</span>
              <input type="number" min={0.5} max={24} step={0.5} value={f.weightT} onChange={(e) => set("weightT", Number(e.target.value))} required />
            </label>
            <label>
              <span className="w">Pallets</span>
              <input type="number" min={1} max={34} value={f.pallets} onChange={(e) => set("pallets", Number(e.target.value))} required />
            </label>
            <label>
              <span className="w">Vehicle</span>
              <select value={f.vehicle} onChange={(e) => set("vehicle", e.target.value)}>
                <option>Reefer trailer 13.6 m</option>
                <option>Curtainsider 13.6 m</option>
                <option>Box trailer 13.6 m</option>
              </select>
            </label>
            <label>
              <span className="w">Pickup</span>
              <input type="date" value={f.pickupDate} onChange={(e) => set("pickupDate", e.target.value)} required />
            </label>
            <label>
              <span className="w">Deliver by</span>
              <input type="date" min={f.pickupDate} value={f.deliverBy} onChange={(e) => set("deliverBy", e.target.value)} required />
            </label>
            <label>
              <span className="w">Target price (€, optional)</span>
              <input
                type="number"
                min={0}
                step={10}
                value={f.targetPriceEur ?? ""}
                onChange={(e) => set("targetPriceEur", e.target.value === "" ? null : Number(e.target.value))}
              />
            </label>
          </div>
          <div className="actions">
            <button className="btn btn--o" disabled={!valid || busy}>
              Publish to carriers
            </button>
            <span className="note">
              Goes to vetted carriers on this lane. You describe the load once; every quote answers the same request.
            </span>
          </div>
        </form>
      )}
    </Scene>
  );
}

// ---------------------------------------------------------------- 2. quotes

export function QuotesStep({ v, role }: { v: OrderView; role: Role }) {
  const [price, setPrice] = useState(1320);
  const [transit, setTransit] = useState(10);
  const [note, setNote] = useState("Own reefer, driver on the lane weekly. Temperature log shared at delivery.");
  const mine = v.quotes.find((q) => q.carrierId === YOU_AS_CARRIER);
  const cheapest = Math.min(...v.quotes.map((q) => q.priceEur));
  const fastest = Math.min(...v.quotes.map((q) => q.transitH));
  const co2 = v.rfq ? footprint(TOTAL_KM, v.rfq.weightT) : null;
  const decided = Boolean(v.acceptedQuoteId);

  return (
    <Scene id="quotes" n={2} slate="Int. three dispatch offices / 06:20" title={<>The <em>quotes</em></>} locked={!v.rfq}>
      {!v.rfq ? (
        <Waiting>Quotes open once the request is published.</Waiting>
      ) : (
        <>
          {role === "carrier" && !mine && !decided && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await append("quote.submitted", actorFor("ruud"), {
                  quoteId: "Q-vandijk",
                  carrierId: YOU_AS_CARRIER,
                  priceEur: price,
                  transitH: transit,
                  note,
                });
              }}
              style={{ marginBottom: 28 }}
            >
              <p className="w orange" style={{ margin: "0 0 10px" }}>
                You are {company(YOU_AS_CARRIER).name}. Quote on the same request as everyone else.
              </p>
              <div className="form">
                <label>
                  <span className="w">Your price (€)</span>
                  <input type="number" min={300} max={5000} step={10} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                </label>
                <label>
                  <span className="w">Transit (hours)</span>
                  <input type="number" min={7} max={48} value={transit} onChange={(e) => setTransit(Number(e.target.value))} />
                </label>
                <label className="span2">
                  <span className="w">Note to the shipper</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
                </label>
              </div>
              <div className="actions">
                <button className="btn btn--o">Send quote</button>
                <span className="note">€{(price / km).toFixed(2)} per km over {km} km.</span>
              </div>
            </form>
          )}

          {v.quotes.length === 0 ? (
            <Waiting>Waiting for carriers. The first quotes usually land within seconds in this demo.</Waiting>
          ) : (
            <div className="grid g3">
              {v.quotes.map((q) => {
                const c = company(q.carrierId);
                const chosen = v.acceptedQuoteId === q.quoteId;
                return (
                  <article key={q.quoteId} className={`card${chosen ? " chosen" : ""}`}>
                    <div className="tags">
                      {q.priceEur === cheapest && v.quotes.length > 1 && <span className="tag tag--o">Cheapest</span>}
                      {q.transitH === fastest && v.quotes.length > 1 && <span className="tag">Fastest</span>}
                      <span className="tag tag--g">Vetted</span>
                      {chosen && <span className="tag tag--o">Accepted</span>}
                    </div>
                    <h3>{c.name}</h3>
                    <div className="price">{eur(q.priceEur)}</div>
                    <div className="mute" style={{ fontSize: 14 }}>
                      {q.transitH} h transit · €{(q.priceEur / km).toFixed(2)}/km · {c.city}
                      <br />
                      {c.vetted}
                      {co2 && (
                        <>
                          <br />≈ {Math.round(co2.wtwKg)} kg CO₂e (same truck type, default factors)
                        </>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 15 }}>“{q.note}”</p>
                    <span className="note">Received {time(q.at)} · record #{q.seq}</span>
                    {role === "shipper" && !decided && (
                      <button className="btn btn--sm btn--o" onClick={() => append("quote.accepted", actorFor("sanne"), { quoteId: q.quoteId })}>
                        Accept {eur(q.priceEur)}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          {!decided && role !== "shipper" && v.quotes.length > 0 && (
            <p className="note" style={{ marginTop: 16 }}>
              The shipper compares and accepts one. Switch to <b>Shipper</b> to decide.
            </p>
          )}
        </>
      )}
    </Scene>
  );
}

// ---------------------------------------------------------------- 3. transport order

export function OrderStep({ v, role }: { v: OrderView; role: Role }) {
  const o = v.order;
  return (
    <Scene id="order" n={3} slate="Int. Van Dijk yard / 07:10" title={<>The <em>order</em></>} cream locked={!v.acceptedQuoteId}>
      {!o ? (
        <Waiting>{v.acceptedQuoteId ? "Writing the transport order…" : "The accepted quote becomes the transport order. No retyping."}</Waiting>
      ) : (
        <>
          <div className="grid g4">
            <Cell label="Transport order" value={o.orderNo} sub="Made from the accepted quote" />
            <Cell label="Carrier" value={company(o.carrierId).name} sub={company(o.carrierId).vetted} />
            <Cell label="Driver / truck" value={o.driver} sub={o.plate} />
            <Cell label="Agreed price" value={eur(o.priceEur)} sub="Fixed. Changes need both sides." />
          </div>
          <div className="actions">
            {v.tracking ? (
              <span className="w ok">Loaded and on the road since {time(v.tracking.startedAt)}</span>
            ) : role === "carrier" ? (
              <button
                className="btn btn--o"
                onClick={() =>
                  append(
                    "tracking.started",
                    { companyId: o.carrierId, person: company(o.carrierId).name, role: "carrier" },
                    { startedAt: Date.now(), durationSec: 75 },
                  )
                }
              >
                Loaded. Start the trip
              </button>
            ) : (
              <span className="note">
                Waiting for the carrier to load and depart. Switch to <b>Carrier</b>.
              </span>
            )}
            {!v.tracking && <span className="note">Demo clock: the 9-hour drive plays in about 75 seconds.</span>}
          </div>
        </>
      )}
    </Scene>
  );
}

// ---------------------------------------------------------------- 6. invoice

export function InvoiceStep({ v }: { v: OrderView }) {
  const i = v.invoice;
  const o = v.order;
  return (
    <Scene id="invoice" n={6} slate="Int. accounts / 16:05" title={<>The <em>invoice</em></>} cream locked={!v.pod}>
      {!i || !o || !v.rfq || !v.pod ? (
        <Waiting>The signed delivery becomes the invoice. Nobody types it.</Waiting>
      ) : (
        <div className="invoice">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div className="d" style={{ fontSize: 48 }}>
                Invoice
              </div>
              <div className="mono">{i.invoiceNo}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 14 }}>
              <b>{company(o.carrierId).name}</b>
              <br />
              to {company(v.rfq ? "delta" : "delta").name}
              <br />
              Due {i.dueDate}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Line</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Road freight {o.orderNo}, Rotterdam → Berlin, {v.rfq.weightT} t, {v.rfq.pallets} pallets
                </td>
                <td>{eur(i.netEur)}</td>
              </tr>
              <tr>
                <td>VAT: reverse charge (cross-border B2B transport)</td>
                <td>{eur(i.vatEur)}</td>
              </tr>
              <tr className="tot">
                <td>Total</td>
                <td>{eur(i.totalEur)}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 13, marginBottom: 0 }}>
            Backed by proof of delivery, record #{i.podSeq}: signed by {v.pod.receiver} at {time(v.pod.capturedAt)}, {v.pod.photos.length} photo
            {v.pod.photos.length === 1 ? "" : "s"}
            {v.pod.capturedOffline ? ", captured with no signal and sent later" : ""}.
          </p>
        </div>
      )}
    </Scene>
  );
}

// ---------------------------------------------------------------- 7. payment

export function PaymentStep({ v, role }: { v: OrderView; role: Role }) {
  const [signer, setSigner] = useState("anouk");
  const [msg, setMsg] = useState("");
  const i = v.invoice;
  const ids = v.approvals.map((a) => a.approverId);
  const check = i ? releaseCheck(i.totalEur, ids) : null;

  return (
    <Scene id="payment" n={7} slate="Int. finance / 16:30" title={<>The <em>payment</em></>} locked={!v.invoice}>
      {!i || !check ? (
        <Waiting>Payment opens once the invoice exists.</Waiting>
      ) : v.paid ? (
        <>
          <p className="d paid">Paid.</p>
          <p className="lede" style={{ marginTop: 10 }}>
            {eur(i.totalEur)} released to {v.order ? company(v.order.carrierId).name : "the carrier"} after{" "}
            {ids.map((id) => person(id).name).join(" and ")} signed. From request to payment on one record. See it in the <a href="/ledger">shared record</a>.
          </p>
        </>
      ) : (
        <>
          <div className="signers">
            {["anouk", "marco"].map((id) => {
              const p = person(id);
              const signed = v.approvals.find((a) => a.approverId === id);
              return (
                <div key={id}>
                  <span className="w mute">
                    {p.title} · limit {eur(p.limitEur ?? 0)}
                  </span>
                  <div className="d" style={{ fontSize: 40 }}>
                    {p.name}
                  </div>
                  {signed ? <span className="stamp">Signed {time(signed.at)}</span> : <span className="note">Not signed</span>}
                </div>
              );
            })}
          </div>
          <p className="note" style={{ marginTop: 14 }}>
            {check.needs || "Enough signatures. Releasing…"}
          </p>
          {role === "finance" ? (
            <div className="actions">
              <label className="w" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                Sign as
                <select value={signer} onChange={(e) => setSigner(e.target.value)} style={{ width: "auto" }}>
                  <option value="anouk">Anouk Peeters (limit €1,000)</option>
                  <option value="marco">Marco Jansen (limit €25,000)</option>
                </select>
              </label>
              <button
                className="btn btn--o"
                onClick={async () => {
                  const can = canApprove(signer, ids);
                  if (!can.ok) return setMsg(can.why);
                  setMsg("");
                  await append("payment.approved", actorFor(signer), { approverId: signer });
                }}
              >
                Approve {eur(i.totalEur)}
              </button>
              {msg && <span className="note" style={{ color: "var(--bad)" }}>{msg}</span>}
            </div>
          ) : (
            <p className="note">
              Switch to <b>Finance</b> to sign.
            </p>
          )}
        </>
      )}
    </Scene>
  );
}
