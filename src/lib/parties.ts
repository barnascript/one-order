import type { Role } from "./types";

export interface Company {
  id: string;
  name: string;
  kind: "shipper" | "carrier";
  city: string;
  vetted: string; // what the network checked
}

export interface Person {
  id: string;
  name: string;
  companyId: string;
  role: Role;
  title: string;
  /** Finance only: the most this person can release alone. */
  limitEur?: number;
}

// All fictional.
export const COMPANIES: Company[] = [
  { id: "delta", name: "Delta Fresh Foods BV", kind: "shipper", city: "Rotterdam", vetted: "KvK registered · VAT checked" },
  { id: "vandijk", name: "Van Dijk Transport", kind: "carrier", city: "Breda", vetted: "Licence + CMR insurance checked" },
  { id: "elbe", name: "Elbe Spedition GmbH", kind: "carrier", city: "Magdeburg", vetted: "Licence + CMR insurance checked" },
  { id: "kowal", name: "Kowalski Trans Sp. z o.o.", kind: "carrier", city: "Poznań", vetted: "Licence + CMR insurance checked" },
];

export const PEOPLE: Person[] = [
  { id: "sanne", name: "Sanne de Vries", companyId: "delta", role: "shipper", title: "Logistics planner" },
  { id: "ruud", name: "Ruud van Dijk", companyId: "vandijk", role: "carrier", title: "Owner, 6 trucks" },
  { id: "jan", name: "Jan Bakker", companyId: "vandijk", role: "driver", title: "Driver" },
  { id: "anouk", name: "Anouk Peeters", companyId: "delta", role: "finance", title: "Accounts payable", limitEur: 1000 },
  { id: "marco", name: "Marco Jansen", companyId: "delta", role: "finance", title: "Finance director", limitEur: 25000 },
];

export const YOU_AS_CARRIER = "vandijk";

export function company(id: string): Company {
  const c = COMPANIES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown company ${id}`);
  return c;
}

export function person(id: string): Person {
  const p = PEOPLE.find((x) => x.id === id);
  if (!p) throw new Error(`unknown person ${id}`);
  return p;
}

export const ROLE_LABEL: Record<Role, string> = {
  shipper: "Shipper",
  carrier: "Carrier",
  driver: "Driver",
  finance: "Finance",
};

export const ROLE_PERSON: Record<Role, string> = {
  shipper: "sanne",
  carrier: "ruud",
  driver: "jan",
  finance: "anouk",
};

/** Who drives for each carrier in this demo. */
export const DRIVERS: Record<string, { name: string; plate: string }> = {
  vandijk: { name: "Jan Bakker", plate: "NL 52-BXT-4" },
  elbe: { name: "Uwe Krause", plate: "MD-ES 214" },
  kowal: { name: "Tomasz Nowak", plate: "PO 7K22T" },
};
