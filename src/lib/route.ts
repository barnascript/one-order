/** Rotterdam → Berlin by road (A12 / A3 / A2), simplified to the main junctions. */
export interface Waypoint {
  name: string;
  lat: number;
  lon: number;
  label?: boolean;
}

export const ROUTE: Waypoint[] = [
  { name: "Rotterdam", lat: 51.9244, lon: 4.4777, label: true },
  { name: "Gouda", lat: 52.0115, lon: 4.7104 },
  { name: "Utrecht", lat: 52.0907, lon: 5.1214, label: true },
  { name: "Arnhem", lat: 51.9851, lon: 5.8987 },
  { name: "Emmerich (border)", lat: 51.8359, lon: 6.2445 },
  { name: "Oberhausen", lat: 51.4963, lon: 6.8638 },
  { name: "Dortmund", lat: 51.5136, lon: 7.4653, label: true },
  { name: "Bielefeld", lat: 52.0302, lon: 8.5325 },
  { name: "Hannover", lat: 52.3759, lon: 9.732, label: true },
  { name: "Braunschweig", lat: 52.2689, lon: 10.5268 },
  { name: "Magdeburg", lat: 52.1205, lon: 11.6276, label: true },
  { name: "Berlin", lat: 52.52, lon: 13.405, label: true },
];

export const BORDER_INDEX = 4;

/** Roads wind; straight-line distance under-counts a little; 1.03 lands near the real ~690 km. */
export const ROAD_FACTOR = 1.03;

export function haversineKm(a: Waypoint, b: Waypoint): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Cumulative road km at each waypoint. */
export const CUM_KM: number[] = ROUTE.reduce<number[]>((acc, wp, i) => {
  const prev = ROUTE[i - 1];
  acc.push(i === 0 || !prev ? 0 : (acc[i - 1] ?? 0) + haversineKm(prev, wp) * ROAD_FACTOR);
  return acc;
}, []);

export const TOTAL_KM = CUM_KM[CUM_KM.length - 1] ?? 0;
export const BORDER_KM = CUM_KM[BORDER_INDEX] ?? 0;

export interface Position {
  lat: number;
  lon: number;
  km: number;
  progress: number;
  /** The last waypoint passed. */
  near: string;
}

export function positionAt(progress: number): Position {
  const p = Math.min(1, Math.max(0, progress));
  const km = p * TOTAL_KM;
  let i = 0;
  while (i < ROUTE.length - 2 && (CUM_KM[i + 1] ?? Infinity) < km) i++;
  const a = ROUTE[i]!;
  const b = ROUTE[i + 1]!;
  const segStart = CUM_KM[i] ?? 0;
  const segLen = (CUM_KM[i + 1] ?? segStart) - segStart || 1;
  const t = Math.min(1, Math.max(0, (km - segStart) / segLen));
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
    km,
    progress: p,
    near: p >= 1 ? b.name : a.name,
  };
}

/** Simple equirectangular projection into an SVG box. */
export function project(lat: number, lon: number, width: number, height: number, pad = 28) {
  const lats = ROUTE.map((w) => w.lat);
  const lons = ROUTE.map((w) => w.lon);
  const minLat = Math.min(...lats) - 0.25;
  const maxLat = Math.max(...lats) + 0.25;
  const minLon = Math.min(...lons) - 0.2;
  const maxLon = Math.max(...lons) + 0.2;
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const sx = (width - pad * 2) / ((maxLon - minLon) * k);
  const sy = (height - pad * 2) / (maxLat - minLat);
  const s = Math.min(sx, sy);
  const offX = (width - (maxLon - minLon) * k * s) / 2;
  const offY = (height - (maxLat - minLat) * s) / 2;
  return { x: offX + (lon - minLon) * k * s, y: offY + (maxLat - lat) * s };
}
