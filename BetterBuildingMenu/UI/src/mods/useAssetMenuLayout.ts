import { useValue } from "cs2/api";

import { useTextScale } from "domain/textScaleSetting";
import { REFERENCE_ASPECT, drawnStep, drawnStepWidth, sanitizeWidthStep, snapTargets, type WidthSnap, type WidthStepScreen } from "domain/widthSteps";
import { AssetMenuWidthStep$, ControlPaneShown$ } from "mods/bindings";

/** The asset menu's widths as drawn now, in rem. */
export interface AssetMenuLayout {
  /** The stored Width step. */
  step: number;
  /** The step the box draws: the stored one, or beside the pane the widest that fits. */
  drawnStep: number;
  /** The build menu: the stored step's width on this screen, narrowed or swapped where it does not fit. */
  menuWidth: number;
  paneShown: boolean;
  /** The steps the right edge snaps to. */
  snaps: WidthSnap[];
  /** What decides where the box sits: the screen's aspect, the text scale and the pane. */
  screen: WidthStepScreen;
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

  return { step, drawnStep: drawnStep(step, screen), menuWidth, paneShown, snaps: snapTargets(screen), screen };
}
