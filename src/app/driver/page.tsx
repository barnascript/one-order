"use client";

import { DriverApp } from "@/components/DriverApp";
import { Header } from "@/components/Shell";
import { deriveOrder } from "@/lib/order";
import { useRecord } from "@/lib/store";

export default function DriverPage() {
  const { events } = useRecord();
  const v = deriveOrder(events);
  return (
    <>
      <Header />
      <main className="hero" style={{ paddingBottom: 60 }}>
        <div className="slate w">Sc. 05 / Ext. the cab / any time</div>
        <h1 className="d" style={{ marginBottom: 28 }}>
          <span className="l1">The driver app.</span>
        </h1>
        <DriverApp v={v} />
      </main>
    </>
  );
}
