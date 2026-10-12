import { useValue } from "cs2/api";

import { assetMenuRowWidth } from "domain/assetMenuLayout";
import { useTextScale } from "domain/textScaleSetting";
import { REFERENCE_ASPECT, drawnStepWidth, sanitizeWidthStep, snapTargets, type WidthSnap } from "domain/widthSteps";
import { AssetMenuWidthStep$, ControlPaneShown$ } from "mods/bindings";

/** The asset menu's widths as drawn now, in rem. */
export interface AssetMenuLayout {
  /** The stored Width step. */
  step: number;
  /** The build menu: the stored step's width on this screen, narrowed or swapped where it does not fit. */
  menuWidth: number;
  /** The row: the build menu and, while shown, the control pane beside it. */
  rowWidth: number;
  paneShown: boolean;
  /** The steps the right edge snaps to. */
  snaps: WidthSnap[];
}

/** The screen's aspect, read at each render: a screen is 1,080 rem tall at any aspect. */
function screenAspect(): number {
  if (typeof window === "undefined") return REFERENCE_ASPECT;
  const { innerWidth, innerHeight } = window;
  return innerWidth > 0 && innerHeight > 0 ? innerWidth / innerHeight : REFERENCE_ASPECT;
}

/**
 * One reading of what decides the asset menu's widths, from the stored step. The catalog
 * budgets its table with it; the asset menu draws it too, except while a width drag has the
 * box following the pointer, when the table keeps the stored step until the release.
 */
export function useAssetMenuLayout(): AssetMenuLayout {
  const step = sanitizeWidthStep(useValue(AssetMenuWidthStep$));
  const paneShown = useValue(ControlPaneShown$);
  const screen = { aspect: screenAspect(), textScale: useTextScale(), paneShown };
  const menuWidth = drawnStepWidth(step, screen);

  return { step, menuWidth, rowWidth: assetMenuRowWidth(menuWidth, paneShown), paneShown, snaps: snapTargets(screen) };
}
