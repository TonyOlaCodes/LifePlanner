export type UnitKind = "weight" | "volume" | "count";

export const UNIT_KIND_OPTIONS: { kind: UnitKind; label: string; units: readonly string[] }[] = [
  { kind: "weight", label: "Weight", units: ["g", "kg"] },
  { kind: "volume", label: "Volume", units: ["ml", "L"] },
  {
    kind: "count",
    label: "Units",
    units: ["pcs", "loaf", "box", "bag", "can", "pack", "bottle", "slice"],
  },
];

const WEIGHT_TO_G: Record<string, number> = { g: 1, kg: 1000 };
const VOLUME_TO_ML: Record<string, number> = { ml: 1, L: 1000 };

export function getUnitKind(unit: string): UnitKind | null {
  for (const opt of UNIT_KIND_OPTIONS) {
    if (opt.units.includes(unit)) return opt.kind;
  }
  return null;
}

export function defaultUnitForKind(kind: UnitKind): string {
  if (kind === "weight") return "g";
  if (kind === "volume") return "ml";
  return "pcs";
}

export function defaultQuickDelta(kind: UnitKind, unit: string): number {
  if (kind === "weight") return unit === "kg" ? 0.25 : 100;
  if (kind === "volume") return unit === "L" ? 0.25 : 250;
  return 1;
}

export function toBaseAmount(amount: number, unit: string): { value: number; kind: UnitKind } | null {
  const kind = getUnitKind(unit);
  if (!kind) return null;
  if (kind === "weight") {
    const factor = WEIGHT_TO_G[unit];
    if (!factor) return null;
    return { value: amount * factor, kind };
  }
  if (kind === "volume") {
    const factor = VOLUME_TO_ML[unit];
    if (!factor) return null;
    return { value: amount * factor, kind };
  }
  return { value: amount, kind: "count" };
}

export function fromBaseAmount(base: number, unit: string): number | null {
  const kind = getUnitKind(unit);
  if (!kind) return null;
  if (kind === "weight") {
    const factor = WEIGHT_TO_G[unit];
    if (!factor) return null;
    return base / factor;
  }
  if (kind === "volume") {
    const factor = VOLUME_TO_ML[unit];
    if (!factor) return null;
    return base / factor;
  }
  return base;
}

/** Convert between compatible units (weight↔weight, volume↔volume, or identical count units). */
export function convertAmount(amount: number, fromUnit: string, toUnit: string): number | null {
  const fromKind = getUnitKind(fromUnit);
  const toKind = getUnitKind(toUnit);
  if (!fromKind || !toKind || fromKind !== toKind) return null;
  if (fromKind === "count" && fromUnit !== toUnit) return null;
  const base = toBaseAmount(amount, fromUnit);
  if (!base) return null;
  return fromBaseAmount(base.value, toUnit);
}

export function formatFoodQuantity(quantity: number, unit: string): string {
  const q = quantity >= 100 ? Math.round(quantity) : Math.round(quantity * 100) / 100;
  if (unit === "L") return `${q}L`;
  if (unit === "ml") return `${q}ml`;
  if (unit === "kg") return `${q}kg`;
  if (unit === "g") return `${q}g`;
  if (unit === "loaf") return `${q} ${q === 1 ? "loaf" : "loaves"}`;
  if (unit === "pcs") return `${Math.round(q)}`;
  return `${q} ${unit}`;
}

export function unitsForKind(kind: UnitKind): readonly string[] {
  return UNIT_KIND_OPTIONS.find((o) => o.kind === kind)!.units;
}
