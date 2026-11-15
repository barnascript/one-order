import { BORDER_KM, TOTAL_KM, positionAt } from "@/lib/route";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream of the truck's position. In production this would sit on the
 * telematics topic (Kafka) and forward one shipment's events; here the position is computed
 * from when the trip started, so every viewer, on any device, sees the same truck.
 *
 *   GET /api/track?startedAt=<ms>&durationSec=<s>
 */
export function GET(req: Request) {
  const url = new URL(req.url);
  const startedAt = Number(url.searchParams.get("startedAt"));
  const durationSec = Number(url.searchParams.get("durationSec"));
  if (!Number.isFinite(startedAt) || !Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 3600) {
    return new Response("startedAt and durationSec (1–3600) are required", { status: 400 });
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let crossed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      // Real trip is ~9 h; scale the clock so ETA reads like the real thing.
      const realTripMs = 9 * 3600_000;

      const tick = () => {
        const progress = Math.min(1, (Date.now() - startedAt) / (durationSec * 1000));
        const pos = positionAt(progress);
        if (!crossed && pos.km >= BORDER_KM) {
          crossed = true;
          send("milestone", { text: "Crossed the border NL → DE at Emmerich", km: Math.round(pos.km) });
        }
        const remainingMs = (1 - progress) * realTripMs;
        send("position", { ...pos, totalKm: TOTAL_KM, etaMinutes: Math.round(remainingMs / 60_000) });
        if (progress >= 1) {
          send("milestone", { text: "Arrived at the delivery address in Berlin", km: Math.round(TOTAL_KM) });
          send("arrived", { at: Date.now() });
          clearInterval(timer);
          controller.close();
        }
      };

      if (Date.now() - startedAt > 0 && positionAt((Date.now() - startedAt) / (durationSec * 1000)).km >= BORDER_KM) {
        crossed = true; // joined late: do not replay old milestones
      }
      tick();
      timer = setInterval(tick, 1000);
    },
    cancel() {
      clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
