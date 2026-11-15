"use client";

import { useEffect, useRef, useState } from "react";
import { trackingProgress, type OrderView } from "@/lib/order";
import { flushOutbox, queuePod, useRecord, append } from "@/lib/store";
import type { PodData } from "@/lib/types";

/** Shrinks a photo to a small JPEG so the record stays light. */
async function thumb(file: File, max = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function SignaturePad({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  const point = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return `${(((e.clientX - r.left) / r.width) * 300).toFixed(1)} ${(((e.clientY - r.top) / r.height) * 150).toFixed(1)}`;
  };
  return (
    <svg
      ref={svg}
      className="sig"
      viewBox="0 0 300 150"
      role="img"
      aria-label={value ? "Signature captured" : "Sign here with your finger"}
      onPointerDown={(e) => {
        drawing.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        onChange(`${value} M${point(e)}`);
      }}
      onPointerMove={(e) => drawing.current && onChange(`${value} L${point(e)}`)}
      onPointerUp={() => (drawing.current = false)}
      onPointerCancel={() => (drawing.current = false)}
    >
      {!value && (
        <text x="150" y="82" textAnchor="middle" fill="#8a8b70" fontSize="13">
          Receiver signs here
        </text>
      )}
      <path d={value} />
    </svg>
  );
}

export function DriverApp({ v }: { v: OrderView }) {
  const { outbox } = useRecord();
  const [now, setNow] = useState(() => Date.now());
  const [noSignal, setNoSignal] = useState(false);
  const [receiver, setReceiver] = useState("M. Schulz (goods-in)");
  const [notes, setNotes] = useState("33 pallets, seals intact, 3 °C at the door.");
  const [sig, setSig] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const on = () => setMsg("Signal back.");
    const off = () => setNoSignal(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if (!navigator.onLine) setNoSignal(true);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // When the signal comes back, send whatever was captured meanwhile.
  useEffect(() => {
    if (noSignal || outbox.length === 0) return;
    void flushOutbox().then((n) => n && setMsg(`Signal back. Sent ${n} saved delivery to the record.`));
  }, [noSignal, outbox.length]);

  const progress = trackingProgress(v.tracking, now);
  const arrived = progress >= 1;
  const pending = outbox.length > 0;

  const submit = async () => {
    const pod: PodData = { receiver, signature: sig.trim(), photos, notes, capturedAt: Date.now(), capturedOffline: noSignal };
    if (noSignal) {
      queuePod(pod);
      setMsg("No signal. Saved on the phone; it sends itself when the signal returns.");
    } else {
      await append("pod.signed", { companyId: v.order?.carrierId ?? "vandijk", person: v.order?.driver ?? "Driver", role: "driver" }, pod);
      setMsg("Delivered. The invoice is being written from this.");
    }
  };

  return (
    <div className="phone" aria-label="Driver app">
      <div className="phone-in">
        <div className="phone-bar">
          <span>{new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
          <span style={{ color: noSignal ? "var(--bad)" : undefined }}>{noSignal ? "No service" : "4G ▮▮▮▮"}</span>
        </div>
        <div className="phone-body">
          <span className="w mute">{v.order ? `${v.order.orderNo} · ${v.order.plate}` : "No job yet"}</span>
          {!v.order ? (
            <h4>No job assigned</h4>
          ) : v.pod ? (
            <>
              <h4>Delivered ✓</h4>
              <p className="note ok" style={{ margin: 0 }}>
                Signed by {v.pod.receiver}. {v.pod.capturedOffline ? "Captured offline, sent when the signal returned." : ""}
              </p>
            </>
          ) : pending ? (
            <>
              <h4>Saved on phone</h4>
              <p className="note" style={{ margin: 0 }}>
                The signed delivery is stored here and leaves the moment there is signal.
              </p>
            </>
          ) : !arrived ? (
            <>
              <h4>{v.tracking ? "Driving to Berlin" : "Loading in Rotterdam"}</h4>
              <div className="bar">
                <i style={{ width: `${progress * 100}%` }} />
              </div>
              <p className="note" style={{ margin: 0 }}>
                The delivery form opens on arrival.
              </p>
            </>
          ) : (
            <>
              <h4>Hand over in Berlin</h4>
              <label className="w mute" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Receiver name
                <input value={receiver} onChange={(e) => setReceiver(e.target.value)} />
              </label>
              <SignaturePad value={sig} onChange={setSig} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn--sm" type="button" onClick={() => setSig("")} style={{ flex: 1 }}>
                  Clear
                </button>
                <label className="btn btn--sm" style={{ flex: 1, textAlign: "center" }}>
                  Add photo
                  <input
                    className="sr"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        const t = await thumb(file);
                        setPhotos((p) => [...p, t].slice(0, 4));
                      } catch {
                        setMsg("That photo could not be read. Try another.");
                      }
                    }}
                  />
                </label>
              </div>
              {photos.filter(Boolean).length > 0 && (
                <div className="thumbs">
                  {photos.filter(Boolean).map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={p} alt={`Delivery photo ${i + 1}`} />
                  ))}
                </div>
              )}
              <label className="w mute" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                Notes
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <button className="btn btn--o" disabled={sig.trim().length < 20 || !receiver.trim()} onClick={submit}>
                Confirm delivery
              </button>
              {sig.trim().length < 20 && <span className="note">Needs a signature first.</span>}
            </>
          )}
          <div className={`signal${noSignal ? " off" : ""}`}>
            <span>{noSignal ? "Loading dock, no signal" : "Signal OK"}</span>
            <input
              className="switch"
              type="checkbox"
              role="switch"
              aria-label="Simulate no signal"
              checked={noSignal}
              onChange={(e) => setNoSignal(e.target.checked)}
            />
          </div>
          {msg && <p className="note" style={{ margin: 0 }} aria-live="polite">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
