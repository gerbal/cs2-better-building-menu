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

export const CONTENT_FACET_ID = "content";

/** Base game — the game's own Vanilla toggle owns it. */
export const CONTENT_VANILLA = "vanilla";
/** A creator pack, then "index:version". */
export const CONTENT_PACK_PREFIX = "pack:";
/** A DLC shipping no pack, then its numeric id. Ours to filter. */
export const CONTENT_DLC_PREFIX = "dlc:";

export const VANILLA_TRIGGER_NAME = "setVanillaSelected";

/** The vanilla trigger that owns the pack selection. */
export const ASSET_PACK_TRIGGER_GROUP = "toolbar";
export const ASSET_PACK_TRIGGER_NAME = "setSelectedAssetPacks";

export function parseAssetPackId(id: string | null | undefined): ToolbarEntityRef | null {
  const raw = (id ?? "").startsWith(CONTENT_PACK_PREFIX)
    ? (id ?? "").slice(CONTENT_PACK_PREFIX.length)
    : (id ?? "");
  const parts = raw.split(":");

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

/** Whether a facet command belongs to the Content axis. */
export function isContentFacetCommand(command: { args: readonly unknown[] } | null | undefined): boolean {
  return command?.args?.[0] === CONTENT_FACET_ID;
}

export type ContentOptionKind = "vanilla" | "pack" | "dlc";

/**
 * Which piece of state owns this option.
 *
 * Content is one axis over three of them, and the prefix is how a click finds
 * its way back to the right owner without the rail knowing anything about
 * packs or DLC. C# mints the ids — see Domain/ContentOption.cs.
 */
export function contentOptionKind(optionId: string): ContentOptionKind {
  if (optionId === CONTENT_VANILLA) {
    return "vanilla";
  }

  return optionId.startsWith(CONTENT_DLC_PREFIX) ? "dlc" : "pack";
}
