import { useValue } from "cs2/api";
import classNames from "classnames";
import type { CSSProperties } from "react";

import { useInterfaceTransparency } from "domain/interfaceTransparencySetting";
import { surfaceAlphaStyle } from "domain/looks";
import looks from "looks/looks.module.scss";
import { AssetMenuTuning$ } from "mods/bindings";

/**
 * What a root of BBM's own carries to take the look: the look's class, the game's interface style
 * followed unless the developer knob says not, and the panels' alphas under the game's
 * transparency. The box and the control pane each carry it, since custom properties reach only a
 * root's own children. See docs/design-notes.md, "The looks' tokens".
 */
export function useLookRoot(): { className: string; style: CSSProperties } {
  const transparency = useInterfaceTransparency();
  const tuning = useValue(AssetMenuTuning$);

  return {
    className: classNames(looks.standard, tuning.interfaceStyles && looks.followStyle),
    style: surfaceAlphaStyle(transparency),
  };
}
