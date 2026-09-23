/**
 * The asset-pack facet, which reads and writes the GAME's selection rather than
 * a second one of its own — the toolbar already owns this axis. The rail is the
 * wider view: the game's row is per category, the rail's is per menu.
 */

import type { FacetId } from "./sharedContracts.generated";
import type { ToolbarEntity, ToolbarEntityRef } from "./toolbarEntity";

export const CONTENT_FACET_ID = "content" satisfies FacetId;

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
 * The index out of whichever shape the binding used: the toolbar hands out
 * entities as a bare index, a string, or an {index, version} pair, and a
 * reader has to take all three. See toolbarEntity.ts.
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
 * The selection with this pack added or taken away. Existing entries pass
 * through UNCHANGED: they may be bare indices, and rebuilding one as a pair
 * would mean inventing a version. Only the added pack is minted, from its id.
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
 * Which piece of state owns this option. Content is one axis over three of
 * them, and the prefix is how a click finds its owner without the rail knowing
 * anything about packs or DLC. C# mints the ids — see Domain/ContentOption.cs.
 */
export function contentOptionKind(optionId: string): ContentOptionKind {
  if (optionId === CONTENT_VANILLA) {
    return "vanilla";
  }

  return optionId.startsWith(CONTENT_DLC_PREFIX) ? "dlc" : "pack";
}
