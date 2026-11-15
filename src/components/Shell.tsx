"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deriveOrder, type OrderView } from "@/lib/order";
import { DRIVERS, ROLE_LABEL, company, person, ROLE_PERSON } from "@/lib/parties";
import { setRole, useRole } from "@/lib/role";
import { resetRecord, useRecord } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Announcer, announce } from "./Announcer";

/** How many things are waiting on each role right now. */
export function waitingOn(v: OrderView, outbox: number, now: number): Record<Role, number> {
  const arrived = v.tracking ? now - v.tracking.startedAt >= v.tracking.durationSec * 1000 : false;
  return {
    shipper: (!v.rfq ? 1 : 0) + (v.rfq && !v.acceptedQuoteId && v.quotes.length > 0 ? 1 : 0),
    carrier:
      (v.rfq && !v.acceptedQuoteId && !v.quotes.some((q) => q.carrierId === "vandijk") ? 1 : 0) +
      (v.order && !v.tracking ? 1 : 0) +
      (v.pod && !v.returnLoad ? 1 : 0),
    driver: outbox > 0 || (arrived && !v.pod) ? 1 : 0,
    finance: v.invoice && !v.paid ? 1 : 0,
  };
}

export function whoIs(role: Role, v: OrderView): string {
  if (role === "driver") return v.order ? v.order.driver : DRIVERS.vandijk!.name;
  if (role === "carrier") return v.order ? company(v.order.carrierId).name : company("vandijk").name;
  return person(ROLE_PERSON[role]).name;
}

export function Header() {
  return (
    <header className="hd">
      <a className="skip" href="#main">
        Skip to the content
      </a>
      <Link href="/" className="logo" aria-label="One Order, home">
        <b>
          One<i>.</i>Order
        </b>
      </Link>
      <nav aria-label="Main">
        <Link className="w" href="/#record">
          The order
        </Link>
        <Link className="w" href="/ledger">
          Shared record
        </Link>
        <Link className="w keep" href="/driver">
          Driver app
        </Link>
        <Link className="w" href="/accessibility">
          Accessibility
        </Link>
      </nav>
    </header>
  );
}

export function Dock() {
  const role = useRole();
  const { events, outbox } = useRecord();
  const v = deriveOrder(events);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const counts = waitingOn(v, outbox.length, now);
  const roles: Role[] = ["shipper", "carrier", "driver", "finance"];
  return (
    <>
      <Announcer />
      <nav className="dock" aria-label="See the order as">
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={role === r}
            onClick={() => {
              setRole(r);
              announce(
                `You are now the ${ROLE_LABEL[r].toLowerCase()}`,
                `${whoIs(r, v)}. ${counts[r] > 0 ? `${counts[r]} thing${counts[r] === 1 ? "" : "s"} waiting for you.` : "Nothing waiting for you right now."}`,
              );
            }}
          >
            {ROLE_LABEL[r]}
            {counts[r] > 0 && (
              <span className="cnt">
                {counts[r]}
                <span className="sr"> waiting</span>
              </span>
            )}
            <span className="who">
              <span className="sr">, </span>
              {whoIs(r, v)}
            </span>
          </button>
        ))}
      </nav>
    </>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <p className="d">
        One record.
        <br />
        No loose ends.
      </p>
      <div className="row">
        <span className="w">
          I built this with Next.js and TypeScript · Barnabas Olugbogi · <a href="/accessibility">Accessibility</a>
        </span>
        <span className="actions" style={{ marginTop: 0 }}>
          <a className="btn btn--sm" href="https://github.com/barnascript/one-order">
            Read the code
          </a>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              if (window.confirm("Start the order again from an empty record?")) {
                resetRecord();
                setRole("shipper");
                window.scrollTo({ top: 0 });
              }
            }}
          >
            Start again
          </button>
        </span>
      </div>
    </footer>
  );
}
