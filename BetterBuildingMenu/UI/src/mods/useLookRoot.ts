import { useValue } from "cs2/api";
import classNames from "classnames";
import type { CSSProperties } from "react";

import { useInterfaceTransparency } from "domain/interfaceTransparencySetting";
import { lookOf, surfaceAlphaStyle, type LookId } from "domain/looks";
import looks from "looks/looks.module.scss";
import { AssetMenuLook$, AssetMenuTuning$ } from "mods/bindings";

/** Each finished look's class, named as the stylesheet declares it; a look joins here as it joins the Look row. */
const LOOK_CLASS: Readonly<Partial<Record<LookId, string>>> = { standard: looks.standard, plates: looks.plates };

/**
 * What a root of BBM's own carries to take the look: the look's id, its class, the game's interface
 * style followed unless the developer knob says not, and the panels' alphas under the game's
 * transparency. The box and the control pane each carry it, since custom properties reach only a
 * root's own children. A look switch changes the class and nothing remounts. See
 * docs/design-notes.md, "The looks' tokens".
 */
export function useLookRoot(): { id: LookId; className: string; style: CSSProperties } {
  const transparency = useInterfaceTransparency();
  const tuning = useValue(AssetMenuTuning$);
  const look = lookOf(useValue(AssetMenuLook$));

  return {
    id: look.id,
    className: classNames(LOOK_CLASS[look.id] ?? looks.standard, tuning.interfaceStyles && looks.followStyle),
    style: surfaceAlphaStyle(transparency, look.alphas),
  };
}
