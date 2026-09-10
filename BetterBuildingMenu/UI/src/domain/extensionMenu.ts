import type { BuildingCatalogEntry } from "./buildingCatalog";

/**
 * Whether our list stands in for vanilla's extension picker, and with what.
 * `upgradeMenu.upgrades` is the authority and our catalog only supplies
 * presentation, so we draw only when EVERY row it lists has an entry behind it.
 */

export interface EntityRef {
  index: number;
  version: number;
}

/** The fields of vanilla's `toolbar.Asset` row the picker reads. */
export interface VanillaUpgradeRow {
  entity: EntityRef;
  /** `prefab.name` — the join key; our entries carry the same string as prefabName. */
  name: string;
  locked: boolean;
  unique: boolean;
  placed: boolean;
}

export interface ExtensionRow {
  /** What vanilla's `selectUpgrade` is called with. Never ours to invent. */
  entity: EntityRef;
  entry: BuildingCatalogEntry;
}

export type ExtensionMenuDecision =
  | { mode: "vanilla"; reason: "disabled" | "nothing-listed" }
  | { mode: "vanilla"; reason: "unaccounted"; missing: string[] }
  | { mode: "ours"; rows: ExtensionRow[] };

export interface ExtensionMenuInput {
  /** The mod's replace-vanilla-menus setting. One switch for both pickers. */
  enabled: boolean;
  listed: readonly VanillaUpgradeRow[];
  entries: readonly BuildingCatalogEntry[];
}

export function decideExtensionMenu({ enabled, listed, entries }: ExtensionMenuInput): ExtensionMenuDecision {
  if (!enabled) {
    return { mode: "vanilla", reason: "disabled" };
  }

  if (listed.length === 0) {
    return { mode: "vanilla", reason: "nothing-listed" };
  }

  const byName = new Map(entries.map((entry) => [entry.prefabName, entry]));
  const missing = listed.filter((row) => !byName.has(row.name)).map((row) => row.name);

  if (missing.length > 0) {
    return { mode: "vanilla", reason: "unaccounted", missing };
  }

  // Vanilla's order, and vanilla's state: the catalog's lock and unique flags
  // are per-prefab and city-wide, while vanilla's are for THIS building.
  const rows = listed.map((row) => ({
    entity: row.entity,
    entry: {
      ...byName.get(row.name)!,
      isLocked: row.locked,
      isUnique: row.unique,
      isAlreadyBuilt: row.placed,
    },
  }));

  return { mode: "ours", rows };
}
