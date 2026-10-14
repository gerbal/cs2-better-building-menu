import { useValue } from "cs2/api";

import { autoBody, chooseBody, menuView, namesIcons, type BodyKind, type MenuShare } from "domain/bodyChoice";
import { menuPickOf } from "domain/menuPicks";
import { useTextScale } from "domain/textScaleSetting";
import { AssetMenu$, AssetMenuDefaultView$, AssetMenuTuning$, AssetMenuViews$, CurrentSearch$, MenuShares$ } from "mods/bindings";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";

/** The open menu's body, and what decides it, as VIEW, the controls and the catalog read it. */
export interface MenuBody {
  /** The open menu, or "" for none, as under Search everything. */
  menu: string;
  /** The menu's own VIEW pick, or "" for none. */
  pick: string;
  /** The body the menu draws with no pick: Default view, or the look's Auto. */
  byDefault: BodyKind;
  /** The menu's view, unsearched. */
  view: BodyKind;
  /** What it draws now: its view, or a typed search's. */
  drawn: BodyKind;
  /** Whether the icons draw each name under its picture: the menu's own pick of the icons with names, developer mode only. */
  named: boolean;
}

/** The open menu, or "" for none, and its share: what C# counts over the whole menu, once it has. */
export function useOpenMenuShare(): { menu: string; share: MenuShare | undefined } {
  const menu = useValue(AssetMenu$);
  const share = (useValue(MenuShares$) ?? []).find((candidate) => candidate.menu === menu);

  return { menu, share };
}

/** One reading of the open menu's body, so the catalog, VIEW and the View control cannot disagree. */
export function useMenuBody(): MenuBody {
  const { menu, share } = useOpenMenuShare();
  const pick = menuPickOf(useValue(AssetMenuViews$), menu);
  const defaultView = useValue(AssetMenuDefaultView$);
  const knobs = useValue(AssetMenuTuning$);
  const textScale = useTextScale();
  const { drawnStep } = useAssetMenuLayout();
  const searching = (useValue(CurrentSearch$) ?? "").trim() !== "";
  const auto = autoBody({ share, textScale, step: drawnStep, knobs });
  const byDefault = menuView({ menuPick: "", defaultView, auto });
  const drawn = chooseBody({ searching, menuPick: pick, defaultView, auto });

  return {
    menu,
    pick,
    byDefault,
    view: menuView({ menuPick: pick, defaultView, auto }),
    drawn,
    named: namesIcons(pick, drawn),
  };
}
