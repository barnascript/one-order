import type { Actor, EventDataMap, EventType, LedgerEvent, UnsealedEvent } from "./types";

export const GENESIS = "0".repeat(64);

/** Stable JSON: keys sorted at every level, so the same event always hashes the same. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`;
}

export async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashOf(ev: UnsealedEvent): Promise<string> {
  const { seq, type, at, actor, data, prevHash } = ev;
  return sha256(canonical({ seq, type, at, actor, data, prevHash }));
}

/** Put a new event on the end of the record, chained to the last one. */
export async function seal<T extends EventType>(
  record: readonly LedgerEvent[],
  type: T,
  actor: Actor,
  data: EventDataMap[T],
  at: number = Date.now(),
): Promise<LedgerEvent<T>> {
  const last = record[record.length - 1];
  const unsealed: UnsealedEvent<T> = {
    seq: record.length + 1,
    type,
    at,
    actor,
    data,
    prevHash: last ? last.hash : GENESIS,
  };
  return { ...unsealed, hash: await hashOf(unsealed) };
}

export type Verdict = { ok: true } | { ok: false; seq: number; reason: string };

/** Re-hash every event. Any edit anywhere breaks the chain from that point on. */
export async function verify(record: readonly LedgerEvent[]): Promise<Verdict> {
  let prev = GENESIS;
  for (const [i, ev] of record.entries()) {
    if (ev.seq !== i + 1) return { ok: false, seq: ev.seq, reason: "events are out of order" };
    if (ev.prevHash !== prev) return { ok: false, seq: ev.seq, reason: "does not point at the event before it" };
    if ((await hashOf(ev)) !== ev.hash) return { ok: false, seq: ev.seq, reason: "contents changed after it was recorded" };
    prev = ev.hash;
  }
  return { ok: true };
}
