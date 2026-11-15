"use client";

import { useEffect, useState } from "react";
import { emptyRunKg, footprint } from "@/lib/carbon";
import { eur, type OrderView } from "@/lib/order";
import { company } from "@/lib/parties";
import { BORDER_INDEX, ROUTE, TOTAL_KM, positionAt, project } from "@/lib/route";
import { append } from "@/lib/store";
import type { Role, TrackingData } from "@/lib/types";
import { Cell, Scene, Waiting } from "./Scene";

interface Live {
  progress: number;
  km: number;
  lat: number;
  lon: number;
  near: string;
  etaMinutes: number;
  milestones: { text: string; at: number }[];
  arrived: boolean;
  connected: boolean;
}

/** Subscribes to the server's position stream for this trip. */
export function useTracking(t: TrackingData | null): Live | null {
  const [live, setLive] = useState<Live | null>(null);
  useEffect(() => {
    if (!t) {
      setLive(null);
      return;
    }
    const start = positionAt(0);
    setLive({ ...start, etaMinutes: 540, milestones: [{ text: "Departed Rotterdam", at: t.startedAt }], arrived: false, connected: false });
    const es = new EventSource(`/api/track?startedAt=${t.startedAt}&durationSec=${t.durationSec}`);
    es.addEventListener("open", () => setLive((l) => (l ? { ...l, connected: true } : l)));
    es.addEventListener("position", (e) => {
      const p = JSON.parse((e as MessageEvent).data) as Omit<Live, "milestones" | "arrived" | "connected">;
      setLive((l) => (l ? { ...l, ...p, connected: true } : l));
    });
    es.addEventListener("milestone", (e) => {
      const m = JSON.parse((e as MessageEvent).data) as { text: string };
      setLive((l) => (l ? { ...l, milestones: [...l.milestones, { text: m.text, at: Date.now() }] } : l));
    });
    es.addEventListener("arrived", () => {
      setLive((l) => (l ? { ...l, arrived: true, progress: 1 } : l));
      es.close();
    });
    es.addEventListener("error", () => {
      // The stream closes itself on arrival; anything else, EventSource retries on its own.
      setLive((l) => (l ? { ...l, connected: false } : l));
    });
    return () => es.close();
  }, [t?.startedAt, t?.durationSec]); // eslint-disable-line react-hooks/exhaustive-deps
  return live;
}

const W = 760;
const H = 300;

function RouteMap({ progress }: { progress: number }) {
  const pts = ROUTE.map((w) => project(w.lat, w.lon, W, H));
  const all = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const pos = positionAt(progress);
  const truck = project(pos.lat, pos.lon, W, H);
  const doneIdx = ROUTE.findIndex((w) => w.name === pos.near);
  const done = [...pts.slice(0, Math.max(1, doneIdx + 1)), truck].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const b = pts[BORDER_INDEX]!;
  return (
    <svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Route Rotterdam to Berlin, truck near ${pos.near}, ${Math.round(pos.km)} of ${Math.round(TOTAL_KM)} km`}>
      <line className="border" x1={b.x} y1={b.y - 70} x2={b.x} y2={b.y + 90} />
      <text x={b.x - 8} y={b.y + 104} textAnchor="end" className="w" fill="var(--mute)" fontSize="9">
        NL
      </text>
      <text x={b.x + 8} y={b.y + 104} className="w" fill="var(--mute)" fontSize="9">
        DE
      </text>
      <polyline className="road" points={all} />
      <polyline className="done" points={done} />
      {ROUTE.map((w, i) =>
        w.label ? (
          <g className="city" key={w.name}>
            <circle cx={pts[i]!.x} cy={pts[i]!.y} r={4.5} />
            <text x={pts[i]!.x} y={pts[i]!.y + (w.name === "Rotterdam" || i % 2 ? 20 : -12)} textAnchor="middle">
              {w.name}
            </text>
          </g>
        ) : null,
      )}
      {progress > 0 && progress < 1 && <circle className="pulse" cx={truck.x} cy={truck.y} r={10} strokeWidth={2} />}
      <rect className="truck" x={truck.x - 7} y={truck.y - 7} width={14} height={14} />
    </svg>
  );
}

export function TrackingStep({ v, role }: { v: OrderView; role: Role }) {
  const live = useTracking(v.tracking);
  const progress = live?.progress ?? (v.pod ? 1 : 0);
  const eta = live ? `${Math.floor(live.etaMinutes / 60)}h ${String(live.etaMinutes % 60).padStart(2, "0")}m` : "—";
  return (
    <Scene id="tracking" n={4} slate="Ext. A12 / A2, eastbound / 08:00–16:00" title={<>Track <em>&amp;</em> trace</>} locked={!v.tracking}>
      {!v.tracking ? (
        <Waiting>Tracking starts when the carrier confirms the truck is loaded.</Waiting>
      ) : (
        <div className="track">
          <RouteMap progress={progress} />
          <div className="feed">
            <span className="w mute">{live?.connected ? "● Live from the truck" : live?.arrived || v.pod ? "Trip finished" : "Connecting…"}</span>
            <div className="d" style={{ fontSize: 56 }}>
              {Math.round(progress * TOTAL_KM)} <span className="mute">/ {Math.round(TOTAL_KM)} km</span>
            </div>
            <div className="bar" aria-hidden>
              <i style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="w">{progress >= 1 ? "Arrived in Berlin" : `Near ${live?.near ?? "Rotterdam"} · ETA ${eta}`}</div>
            <ol aria-live="polite">
              {(live?.milestones ?? []).map((m, i) => (
                <li key={i}>
                  {m.text} <span className="mute">· {new Date(m.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                </li>
              ))}
            </ol>
            {progress >= 1 && !v.pod && (
              <p className="note">
                {role === "driver" ? "Get the receiver's signature below." : "The driver now gets the signature on their phone. Switch to Driver."}
              </p>
            )}
          </div>
        </div>
      )}
    </Scene>
  );
}

// ---------------------------------------------------------------- carbon + return trip

const RETURN_LOADS = [
  { loadId: "RL-1", from: "Berlin-Spandau", to: "Venlo (NL)", priceEur: 980, emptyKmAvoided: 560, pickup: "tomorrow 06:00" },
  { loadId: "RL-2", from: "Potsdam", to: "Utrecht (NL)", priceEur: 1050, emptyKmAvoided: 610, pickup: "tomorrow 08:30" },
  { loadId: "RL-3", from: "Magdeburg", to: "Antwerp (BE)", priceEur: 870, emptyKmAvoided: 470, pickup: "tomorrow 11:00" },
];

export function CarbonAndReturn({ v, role }: { v: OrderView; role: Role }) {
  if (!v.rfq) return null;
  const f = footprint(TOTAL_KM, v.rfq.weightT);
  const delivered = Boolean(v.pod);
  return (
    <Scene id="carbon" n={8} slate="Int. the record / after the drop" title={<>Carbon <em>&amp;</em> the way home</>} cream locked={!v.order}>
      <div className="grid g4">
        <Cell label="Well-to-wheel" value={`${Math.round(f.wtwKg)} kg`} sub="CO₂e for this order (fuel production + burning)" />
        <Cell label="Tank-to-wheel" value={`${Math.round(f.ttwKg)} kg`} sub="CO₂e burned in the truck" />
        <Cell label="Intensity" value={`${Math.round(f.gramsPerTonneKm)} g`} sub={`per tonne-km · ${Math.round(f.km)} km × ${v.rfq.weightT} t`} />
        <Cell label="Data quality" value="Default" sub="ISO 14083 / GLEC default factors. Swap in the carrier's fuel data when shared." />
      </div>

      <h3 className="d" style={{ fontSize: 48, margin: "44px 0 16px" }}>
        Don’t drive home <span className="orange">empty</span>
      </h3>
      {v.returnLoad ? (
        <p className="lede" style={{ marginTop: 0 }}>
          Booked: {v.returnLoad.from} → {v.returnLoad.to} for {eur(v.returnLoad.priceEur)}. That saves {v.returnLoad.emptyKmAvoided} empty km and about{" "}
          {Math.round(emptyRunKg(v.returnLoad.emptyKmAvoided))} kg CO₂e.
        </p>
      ) : !delivered ? (
        <Waiting>Return loads near Berlin appear once this delivery is signed.</Waiting>
      ) : (
        <div className="grid g3">
          {RETURN_LOADS.map((r) => (
            <article className="card" key={r.loadId}>
              <span className="tag tag--o" style={{ alignSelf: "flex-start" }}>
                {r.emptyKmAvoided} empty km saved
              </span>
              <h3>
                {r.from} → {r.to}
              </h3>
              <div className="price" style={{ fontSize: 48 }}>
                {eur(r.priceEur)}
              </div>
              <span className="note">
                Pickup {r.pickup} · avoids ≈ {Math.round(emptyRunKg(r.emptyKmAvoided))} kg CO₂e
              </span>
              {role === "carrier" ? (
                <button
                  className="btn btn--sm"
                  onClick={() =>
                    append(
                      "returnload.accepted",
                      { companyId: v.order!.carrierId, person: company(v.order!.carrierId).name, role: "carrier" },
                      { loadId: r.loadId, from: r.from, to: r.to, priceEur: r.priceEur, emptyKmAvoided: r.emptyKmAvoided },
                    )
                  }
                >
                  Take it
                </button>
              ) : (
                <span className="note">The carrier books this. Switch to Carrier.</span>
              )}
            </article>
          ))}
        </div>
      )}
    </Scene>
  );
}
