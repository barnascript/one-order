import type { ReactNode } from "react";

/** One step of the order, framed like a film scene: number, place, time. */
export function Scene(props: {
  id: string;
  n: number;
  slate: string;
  title: ReactNode;
  locked?: boolean;
  cream?: boolean;
  children: ReactNode;
}) {
  const { id, n, slate, title, locked, cream, children } = props;
  return (
    <section id={id} className={`scene${cream ? " scene--cream" : ""}${locked ? " locked" : ""}`} aria-labelledby={`${id}-h`}>
      <div className="scene-head">
        <h2 className="d" id={`${id}-h`}>
          {title}
        </h2>
        <div className="w">
          Sc. {String(n).padStart(2, "0")} / {slate}
        </div>
      </div>
      <div className="scene-body">{children}</div>
    </section>
  );
}

export function Waiting({ children }: { children: ReactNode }) {
  return <p className="waiting">{children}</p>;
}

export function Cell({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="cell">
      <span className="w">{label}</span>
      <div className="v">{value}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}
