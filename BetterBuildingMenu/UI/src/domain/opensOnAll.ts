/**
 * The small menus, which open on All: those whose rows all fit one screen of the body they draw, at 100%
 * text, the first Width step and the game's own body height, so neither the text scale, the Width nor a
 * drag changes which tab a menu opens on. All draws a label over each of its groups, so the rows and
 * those labels must fit. A menu whose view is Cards opens on All in C#, whatever its size, and is left
 * out here. Pure. See docs/design-notes.md, "Opening on the building's tab".
 */
import { drawnBodyHeight } from "./assetMenuLayout";
import { autoBody, drawnBody, menuView, type AutoKnobs, type MenuShare } from "./bodyChoice";
import { blockLabelsOf, bodyCells } from "./bodyCells";
import { bodyGrid, screenSlots, type BodyGridInput } from "./bodyGeometry";
import type { BuildingCatalogEntry, CatalogSection } from "./buildingCatalog";
import { menuPickOf, type MenuPick } from "./menuPicks";
import { ASSET_MENU_DEFAULT_HEIGHT, WIDTH_STEP_VANILLA } from "./sharedContracts.generated";

export interface OnAllInput {
  shares: readonly MenuShare[];
  views: readonly MenuPick[];
  defaultView: string;
  /** The knobs the Auto rule and the list read, each resolved to its shipped value where C# has not answered. */
  tuning: AutoKnobs & { listPlateHeight: number; nameLines: number; smallMenusGrow: boolean; blockLabels?: string };
  tileSize: number;
  atLargeText: string;
}

/** The menus C# has counted whose rows all fit one screen of their body there, by name. */
export function menusOpeningOnAll({ shares, views, defaultView, tuning, tileSize, atLargeText }: OnAllInput): string[] {
  return shares
    .filter((share) => {
      const body = drawnBody(menuView({ menuPick: menuPickOf(views, share.menu), defaultView, auto: autoBody({ share, textScale: 1, step: 1, knobs: tuning }) }));

      if (body === "cards" || share.rows <= 0) {
        return false;
      }

      const input: BodyGridInput = {
        body,
        boxWidth: WIDTH_STEP_VANILLA,
        bodyHeight: drawnBodyHeight(ASSET_MENU_DEFAULT_HEIGHT),
        textScale: 1,
        atLargeText,
        tileSize,
        plateHeight: tuning.listPlateHeight,
        nameLines: tuning.nameLines,
        menuRows: share.rows,
        smallMenusGrow: tuning.smallMenusGrow,
      };
      // The slots All draws at the body's columns, which no growth changes, as the open body counts them.
      const cols = bodyGrid(input).cols;
      const drawnSlots = bodyCells(standIns(share.rows), allSections(share.groupRows ?? []), cols, blockLabelsOf(tuning.blockLabels)).slots;

      return drawnSlots <= screenSlots(bodyGrid({ ...input, drawnSlots }));
    })
    .map((share) => share.menu)
    .sort();
}

/** Rows to place: only how many there are counts. */
const standIns = (rows: number): BuildingCatalogEntry[] => Array.from({ length: rows }, (_, at) => ({ id: at + 1 }) as BuildingCatalogEntry);

/** All's labels, one over each group's rows in order. */
function allSections(groupRows: readonly number[]): CatalogSection[] {
  let start = 0;

  return groupRows.map((count, at) => {
    const section: CatalogSection = { id: `group:${at}`, kind: "group", label: "", labelId: "", start, count, collapsed: false };
    start += count;
    return section;
  });
}
