"use client";

import { useSyncExternalStore } from "react";
import type { Role } from "./types";

const KEY = "one-order:role";
const listeners = new Set<() => void>();
let current: Role | null = null;

function read(): Role {
  if (current) return current;
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "shipper" || v === "carrier" || v === "driver" || v === "finance") current = v;
  } catch {
    /* ignore */
  }
  return (current ??= "shipper");
}

export function setRole(r: Role) {
  current = r;
  try {
    window.localStorage.setItem(KEY, r);
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

export function useRole(): Role {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    read,
    () => "shipper",
  );
}
