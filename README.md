# One Order

I built One Order to show one road-freight order going all the way from the first request to the last payment, Rotterdam to Berlin, on a single shared record.

Live: **https://one-order.onrender.com** (I host it on a free plan, so the first visit can take about a minute to wake up.)

```
 request ─► quotes ─► transport order ─► track & trace ─► proof of delivery ─► invoice ─► payment
    │          │             │                 │                  │               │          │
    └──────────┴─────────────┴──── one hash-chained record ───────┴───────────────┴──────────┘
```

I put a bar at the bottom of the page so you can switch who you are: shipper, carrier, driver or finance. Every role sees the same order, each from its own side.

## What I built

| Step | What I made it do |
|---|---|
| 1. Request | The shipper describes the load once: lane, weight, pallets, vehicle, delivery window and an optional target price. |
| 2. Quotes | Three vetted carriers quote on the same request, and you can quote as one of them. I tag the cheapest and the fastest, and I show the price per km and the CO₂e for each quote. |
| 3. Transport order | The accepted quote turns into the order, with the driver and the truck. Nobody types it again. |
| 4. Track & trace | I stream the truck's position from the server with Server-Sent Events (`/api/track`), with the border crossing, the arrival and a running ETA. I compress the nine-hour drive into about 75 seconds. |
| 5. Proof of delivery | The driver's phone takes the receiver's name, a finger signature, photos and notes. **I made it work with no signal**: the phone saves the delivery and sends it when the signal comes back, and the record shows that the driver captured it offline. |
| 6. Invoice | The signed delivery writes the invoice and links to it (cross-border B2B, so reverse-charge VAT). |
| 7. Payment | When the amount is above the first signer's limit, a second, different person with a higher limit must sign before the money goes. |
| + Carbon | I calculate each order's emissions, well-to-wheel and tank-to-wheel, with the ISO 14083 / GLEC method and default factors, and I say on screen that they are defaults. |
| + Return load | After the delivery, the carrier sees loads going back home, with the empty kilometres and the CO₂e each one saves. |
| + The record | I save every step as an event that carries the SHA-256 of the event before it. On `/ledger` I show the chain, and "Try to change the price" shows the check catching the edit. |

## How I built it

- I used **Next.js 16 (App Router), React 19 and strict TypeScript** (`noUncheckedIndexedAccess` on).
- I built it **event-sourced**. The screens only read events and add new ones, and `deriveOrder()` turns the list of events into the current state. To move from the browser store to a real ledger or API, I only need to swap one module (`src/lib/store.ts`).
- I wrote the **hash chain** in `src/lib/ledger.ts`: canonical JSON, SHA-256 through Web Crypto, and one append at a time so the chain never forks.
- I kept the **business rules as plain functions with tests**: the release rule (`payment.ts`), carbon (`carbon.ts`), route maths (`route.ts`) and the invoice (`order.ts`).
- I made **live tracking** a streaming Route Handler. It works out the position from when the trip started, so every viewer on any device sees the same truck. In production I would connect this stream to the telematics feed.
- I used **no libraries beyond Next and React**. I drew the map, the signature pad and the progress bars myself in SVG and CSS, and I set strict security headers (CSP, `frame-ancestors 'none'`, nosniff).
- I made it **accessible to blind, low-vision, deaf and keyboard-only users** and aimed for WCAG 2.2 AA:
  - Screen readers hear every step heading with its number and status, and every update on the order (a new quote, the border crossing, a signature, the payment) is read out.
  - I show every one of those updates on screen too, and the app makes no sound at all, so deaf users miss nothing.
  - You can run the whole order with the keyboard. A skip link jumps past the header, and focus is always visible.
  - A receiver who cannot draw a signature can type their full name instead.
  - I describe the tracking map in words, and the progress bars report kilometres to screen readers.
  - All text passes 4.5:1 contrast, and colour never carries meaning on its own. I respect reduced motion and Windows high-contrast mode.
  - I checked every page and every stage of the order with axe (zero violations) and ran the order with the keyboard only. I explain all of it on `/accessibility`.

## Run it

```bash
npm install
npm run dev        # http://localhost:3900
npm test           # hash chain, tamper detection, release rule, carbon, route, invoice
npm run typecheck
npm run build
```

I made up every company and person in it. The record lives in your browser (localStorage), and "Start again" in the footer clears it.

Barnabas Olugbogi · [github.com/barnascript](https://github.com/barnascript)
