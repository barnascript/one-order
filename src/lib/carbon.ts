/**
 * Emissions per order, following the ISO 14083 / GLEC approach:
 *   fuel used = distance × consumption, emissions = fuel × emission factor,
 *   reported as tank-to-wheel (burned in the truck) and well-to-wheel (also producing the fuel).
 *
 * The numbers below are DEFAULT values for a 40 t diesel articulated truck, the kind of
 * figures used when the carrier has not shared its own fuel data. A real deployment would
 * prefer the carrier's measured fuel (primary data) and say which one it used.
 */
export const DEFAULTS = {
  litresPer100Km: 31, // loaded 40 t artic, motorway
  emptyLitresPer100Km: 24, // same truck running empty
  ttwKgPerLitre: 2.67, // diesel, tank-to-wheel
  wttKgPerLitre: 0.57, // diesel, well-to-tank (producing + delivering the fuel)
  capacityT: 24,
} as const;

export interface Footprint {
  km: number;
  litres: number;
  ttwKg: number;
  wtwKg: number;
  /** Share allocated to this shipment by tonne-km (a full truckload carries all of it). */
  allocation: number;
  gramsPerTonneKm: number;
  dataQuality: "default";
}

export function footprint(km: number, payloadT: number, d = DEFAULTS): Footprint {
  const litres = (km * d.litresPer100Km) / 100;
  const allocation = Math.min(1, payloadT / d.capacityT);
  const ttwKg = litres * d.ttwKgPerLitre * allocation;
  const wtwKg = litres * (d.ttwKgPerLitre + d.wttKgPerLitre) * allocation;
  const tkm = km * payloadT;
  return {
    km,
    litres,
    ttwKg,
    wtwKg,
    allocation,
    gramsPerTonneKm: tkm > 0 ? (wtwKg * 1000) / tkm : 0,
    dataQuality: "default",
  };
}

/** Well-to-wheel kg CO₂e a truck would burn driving this far empty. */
export function emptyRunKg(km: number, d = DEFAULTS): number {
  return ((km * d.emptyLitresPer100Km) / 100) * (d.ttwKgPerLitre + d.wttKgPerLitre);
}
