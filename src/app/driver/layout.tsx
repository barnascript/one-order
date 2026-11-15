export const metadata = { title: "One Order: driver app" };
export default function L({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: "calc(var(--dock) * -1)" }}>{children}</div>;
}
