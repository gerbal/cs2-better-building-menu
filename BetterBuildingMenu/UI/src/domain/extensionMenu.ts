import type { BuildingCatalogEntry } from "./buildingCatalog";

/**
 * Whether our list stands in for vanilla's extension picker, and with what.
 *
 * Vanilla's `upgradeMenu.upgrades` binding is the authority on what may be
 * attached to the selected building: it reads the prefab's upgrade buffer and
 * computes locked/unique/built for THIS instance. Our catalog only supplies how
 * each row is presented — the figures and the hover card.
 *
 * So the rule is total and one-directional: we draw only when every row vanilla
 * lists has a catalog entry behind it. One we cannot present means the whole
 * panel stays vanilla's. Never a partial list, never a synthesised row — a gap
 * in our index can make an extension plain, but never unplaceable. That covers
 * the cold index after a save loads (cm-36os) and a mod's upgrade the indexer
 * never saw, without a special case for either.
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

  // Vanilla's order, and vanilla's state. The catalog's isLocked/isUnique/
  // isAlreadyBuilt are per-prefab and city-wide; vanilla's are for this
  // building, so they overwrite.
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
