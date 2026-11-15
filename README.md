# One Order

**One freight order, seven steps, one shared record.** A working demo of a road-freight order from the first request to the last payment, Rotterdam → Berlin.

Live: _add the Render URL here_

```
 request ─► quotes ─► transport order ─► track & trace ─► proof of delivery ─► invoice ─► payment
    │          │             │                 │                  │               │          │
    └──────────┴─────────────┴──── one hash-chained record ───────┴───────────────┴──────────┘
```

Switch who you are in the bar at the bottom (shipper, carrier, driver, finance). Every role sees the same order, from its own side.

## What works

| Step | What happens |
|---|---|
| 1. Request | The shipper describes the load once (lane, weight, pallets, vehicle, window, target price). |
| 2. Quotes | Three vetted carriers quote on the same request; you can quote as one of them. Cheapest and fastest are tagged, with price per km and CO₂e per quote. |
| 3. Transport order | The accepted quote becomes the order with driver and truck. Nobody retypes it. |
| 4. Track & trace | The truck's position streams from the server over Server-Sent Events (`/api/track`), with border and arrival milestones and an ETA. The nine-hour drive plays in about 75 seconds. |
| 5. Proof of delivery | The driver's phone captures name, finger signature, photos and notes. **It works with no signal**: the delivery is saved on the phone and sent when the signal returns, and the record says it was captured offline. |
| 6. Invoice | Written automatically from the signed delivery and linked to it (cross-border B2B, reverse-charge VAT). |
| 7. Payment | Above the first signer's limit, a second, different person with a higher limit must sign before the money goes. |
| + Carbon | Per order, well-to-wheel and tank-to-wheel, following the ISO 14083 / GLEC method with default factors (and saying so). |
| + Return load | After delivery the carrier sees loads heading home, with empty kilometres and CO₂e avoided. |
| + The record | Every step is an event carrying the SHA-256 of the one before it. `/ledger` shows the chain, and "Try to change the price" proves that an edit is caught. |

## How it is built

- **Next.js 16 (App Router), React 19, strict TypeScript** (`noUncheckedIndexedAccess`).
- **Event-sourced.** Screens only read events and append new ones; `deriveOrder()` turns the event list into the current state. Swapping the browser store for a real ledger or API is one module (`src/lib/store.ts`).
- **Hash chain** (`src/lib/ledger.ts`): canonical JSON, SHA-256 via Web Crypto, appends serialised so the chain never forks.
- **Business rules are plain functions with tests:** release rule (`payment.ts`), carbon (`carbon.ts`), route maths (`route.ts`), invoice (`order.ts`).
- **Live tracking** is a streaming Route Handler: the position comes from when the trip started, so every viewer on any device sees the same truck. In production that stream would sit on the telematics topic.
- **No libraries beyond Next and React.** Map, signature pad and charts are hand-written SVG. Strict security headers (CSP, `frame-ancestors 'none'`, nosniff).
- Accessible: real buttons and labels, `aria-live` updates, focus outlines, works with reduced motion, responsive down to phone width.

## Run it

```bash
npm install
npm run dev        # http://localhost:3900
npm test           # vitest: hash chain, tamper detection, release rule, carbon, route, invoice
npm run typecheck
npm run build
```

All companies and people are fictional. The record lives in your browser (localStorage), so "Start again" in the footer clears it.

Made by Barnabas Olugbogi.
