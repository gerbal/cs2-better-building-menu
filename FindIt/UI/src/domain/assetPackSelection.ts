/**
 * The asset-pack facet, which writes the GAME's selection rather than its own.
 *
 * Packs are the one axis the vanilla toolbar already owns: it publishes a Pack
 * row, holds the selection in `toolbar.selectedAssetPacks`, and the lens
 * already filters on it through VanillaToolbarFilter. Giving the rail a second
 * pack field meant two controls narrowing the same set from two different
 * states — so the rail now reads and writes the game's.
 *
 * The rail stays the WIDER view. ToolbarUISystem.BindPacks builds the game's
 * row from the selected category, so that row offers the packs in the category
 * you are in; the rail offers the packs in the menu. Measured in Parks &
 * Recreation: two against four, and the two the game left out held three assets
 * each.
 *
 * Option ids are "index:version" because vanilla's setter takes entities and an
 * index alone cannot be turned back into one. C# mints them — see
 * PrefabIndexingSystem.GetAssetPackId.
 */

import type { ToolbarEntity, ToolbarEntityRef } from "./toolbarEntity";

export const ASSET_PACK_FACET_ID = "assetPack";

/** The vanilla trigger that owns the pack selection. */
export const ASSET_PACK_TRIGGER_GROUP = "toolbar";
export const ASSET_PACK_TRIGGER_NAME = "setSelectedAssetPacks";

export function parseAssetPackId(id: string | null | undefined): ToolbarEntityRef | null {
  const parts = (id ?? "").split(":");

  if (parts.length !== 2) {
    return null;
  }

  const index = Number(parts[0]);
  const version = Number(parts[1]);

  return Number.isInteger(index) && Number.isInteger(version) ? { index, version } : null;
}

/**
 * The index out of whichever shape the binding used.
 *
 * The toolbar bindings hand out entities as a bare index, a string, or an
 * {index, version} pair, and a reader has to take all three — see
 * toolbarEntity.ts.
 */
export function assetPackIndex(entity: ToolbarEntity | null | undefined): number | null {
  if (typeof entity === "number") {
    return Number.isInteger(entity) ? entity : null;
  }

  if (typeof entity === "string") {
    const parsed = Number(entity.split(":")[0]);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return entity && Number.isInteger(entity.index) ? entity.index : null;
}

/**
 * The selection with this pack added or taken away.
 *
 * Entries already in the selection are passed through UNCHANGED rather than
 * normalised: they may be bare indices, and rebuilding one as a pair would mean
 * inventing a version. Only the pack being added is minted, from the id, which
 * carries the real one.
 */
export function toggleAssetPack(
  selected: readonly ToolbarEntity[] | null | undefined,
  optionId: string
): ToolbarEntity[] {
  const current = selected ? [...selected] : [];
  const pack = parseAssetPackId(optionId);

  if (!pack) {
    return current;
  }

  return current.some((entity) => assetPackIndex(entity) === pack.index)
    ? current.filter((entity) => assetPackIndex(entity) !== pack.index)
    : [...current, pack];
}

/** Whether a facet command is a pack toggle that has to go to the game. */
export function isAssetPackFacetCommand(command: { args: readonly unknown[] } | null | undefined): boolean {
  return command?.args?.[0] === ASSET_PACK_FACET_ID;
}
