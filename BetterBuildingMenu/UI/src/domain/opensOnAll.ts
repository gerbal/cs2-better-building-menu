/**
 * The small menus, which open on All: those whose rows all fit one screen of the body they draw, at 100%
 * text, the first Width step and the game's own body height, so neither the text scale, the Width nor a
 * drag changes which tab a menu opens on. A menu whose view is Cards opens on All in C#, whatever its
 * size, and is left out here. Pure. See docs/design-notes.md, "Opening on the building's tab".
 */
import { drawnBodyHeight } from "./assetMenuLayout";
import { autoBody, drawnBody, menuView, type AutoKnobs, type MenuShare } from "./bodyChoice";
import { bodyGrid, screenSlots } from "./bodyGeometry";
import { menuPickOf, type MenuPick } from "./menuPicks";
import { ASSET_MENU_DEFAULT_HEIGHT, WIDTH_STEP_VANILLA } from "./sharedContracts.generated";

export interface OnAllInput {
  shares: readonly MenuShare[];
  views: readonly MenuPick[];
  defaultView: string;
  /** The knobs the Auto rule and the list read, each resolved to its shipped value where C# has not answered. */
  tuning: AutoKnobs & { listPlateHeight: number; nameLines: number; smallMenusGrow: boolean };
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

      const grid = bodyGrid({
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
      });

      return share.rows <= screenSlots(grid);
    })
    .map((share) => share.menu)
    .sort();
}
