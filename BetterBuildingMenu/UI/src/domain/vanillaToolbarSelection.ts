/**
 * The game's own filter row, forwarded to the backend.
 *
 * `ToolbarUISystem` publishes four bindings — `selectedThemes`,
 * `selectedAssetPacks`, `vanillaSelected`, `modsSelected` — and filters its own
 * grid on them before drawing. The lens replaced that grid and not the row, so
 * the EU/NA toggle changed vanilla's menu and did nothing to ours (cm-2xvs.3).
 *
 * The rule itself lives in C# as VanillaToolbarFilter, transcribed from
 * ToolbarUISystem and tested against the decompile. This module only carries
 * the selection across, and exists separately from the component so the
 * carrying can be tested without a React tree.
 */

import type { ToolbarEntity } from "./toolbarEntity";

/**
 * The same decode as `toolbarEntityIndex` in vanillaMenuWatch, kept local.
 *
 * Not by preference. The two build paths disagree about how a domain module may
 * import a sibling at RUNTIME: `npm test` runs
 * `node --experimental-strip-types`, which requires an explicit `.ts`
 * extension, and webpack's ts-loader rejects that extension outright
 * (`moduleResolution: "Node"`, no `allowImportingTsExtensions`). Every other
 * sibling import in this folder is `import type`, which is erased before either
 * tool has an opinion — so this is the first one to hit the wall.
 *
 * Six lines duplicated is the smaller cost than reconfiguring module resolution
 * for the whole UI to land one filter. Worth fixing properly if a second case
 * appears; if this rule ever changes, change it in both places.
 */
function entityIndex(entity: ToolbarEntity | null | undefined): number | null {
  if (entity === null || entity === undefined) {
    return null;
  }

  const index = typeof entity === "object" ? entity.index : Number(entity);

  return Number.isFinite(index) && index > 0 ? (index as number) : null;
}

/** What the four bindings currently say. */
export interface VanillaToolbarState {
  themes: readonly ToolbarEntity[];
  packs: readonly ToolbarEntity[];
  vanillaSelected: boolean;
  modsSelected: boolean;
}

/**
 * Entity indices, comma-joined, in the order the toolbar gave them.
 *
 * Entries that do not resolve to an index are dropped rather than sent as NaN.
 * The binding can carry a bare number, a string or an {index, version} pair
 * depending on which one it is, and toolbarEntityIndex already knows all three.
 */
export function joinEntityIndices(entities: readonly ToolbarEntity[] | null | undefined): string {
  if (!entities || entities.length === 0) {
    return "";
  }

  const indices: number[] = [];

  for (const entity of entities) {
    const index = entityIndex(entity);

    if (index !== null) {
      indices.push(index);
    }
  }

  return indices.join(",");
}

/**
 * A stable string for the whole row, so the forward only fires on real change.
 *
 * The bindings re-emit on unrelated toolbar churn — the menu watcher carries
 * the same note — and every spurious forward costs a full catalog rebuild.
 */
export function toolbarSelectionKey(state: VanillaToolbarState): string {
  return [
    joinEntityIndices(state.themes),
    joinEntityIndices(state.packs),
    state.vanillaSelected ? "1" : "0",
    state.modsSelected ? "1" : "0",
  ].join("|");
}

/** Hands the row to the backend, which applies vanilla's own rule to it. */
export function setVanillaToolbarSelectionCommand(state: VanillaToolbarState) {
  return {
    method: "SetVanillaToolbarSelection",
    args: [
      joinEntityIndices(state.themes),
      joinEntityIndices(state.packs),
      state.vanillaSelected,
      state.modsSelected,
    ] as const,
  } as const;
}
