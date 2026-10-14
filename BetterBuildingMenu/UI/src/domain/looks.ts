/**
 * The looks: which are finished, and what each needs from the game at run time, each panel's alpha
 * under the player's interface transparency. The tokens themselves are looks/_looks.scss. See
 * docs/design-notes.md, "The looks" and "The looks' tokens".
 */
import type { CSSProperties } from "react";
import type { UnitMode } from "./rowNumbers";

/** A look's id, as the settings store it. */
export type LookId = "standard" | "glass" | "plates" | "line" | "cards";

/** Standard's own alpha for each panel, as drawn at the game's default transparency; _looks.scss declares the same. */
export const STANDARD_SURFACE_ALPHAS = { head: 0.96, body: 0.92, popBg: 0.97 } as const;

export type Surface = keyof typeof STANDARD_SURFACE_ALPHAS;

/** A finished look: the Look row and VIEW offer it, and a menu draws it. */
export interface Look {
  id: LookId;
  released: true;
  /** Its name's key, and the English the key falls back to. */
  nameKey: string;
  name: string;
  /** Each panel's own alpha at the game's default transparency, as its class declares them. */
  alphas: Readonly<Record<Surface, number>>;
  /** How its key numbers say their unit: Standard by a glyph, Plates in words ("80 km/h"). */
  units: UnitMode;
  /** How a look-alike tile says what tells it apart: Standard by a tag at its top, Plates by its name on a band across it. */
  tileLabel: "tag" | "band";
  /** Whether a line under the tiles names the pointed or armed one: Standard's; Plates centres its tiles instead. */
  tileNameLine: boolean;
}

/** A look not yet finished: named so the settings keep its id, never drawn. */
export interface UnfinishedLook {
  id: LookId;
  released: false;
}

/** Every look the settings name, in the Look row's order; a look joins the row once its checks pass. C# keeps the same. */
export const LOOKS: readonly (Look | UnfinishedLook)[] = [
  { id: "standard", released: true, nameKey: "Tooltip.LABEL[BetterBuildingMenu.LookStandard]", name: "Standard", alphas: STANDARD_SURFACE_ALPHAS, units: "glyph", tileLabel: "tag", tileNameLine: true },
  { id: "glass", released: false },
  { id: "plates", released: true, nameKey: "Tooltip.LABEL[BetterBuildingMenu.LookPlates]", name: "Plates", alphas: STANDARD_SURFACE_ALPHAS, units: "word", tileLabel: "band", tileNameLine: false },
  { id: "line", released: false },
  { id: "cards", released: false },
];

const isReleased = (look: Look | UnfinishedLook): look is Look => look.released;

/** The finished looks, in the row's order. */
export function releasedLooks(): Look[] {
  return LOOKS.filter(isReleased);
}

/** The look a stored id draws: a finished look as itself, anything else as Standard, as C# reads it. */
export function lookOf(id: string | null | undefined): Look {
  const looks = releasedLooks();
  return looks.find((look) => look.id === id) ?? looks[0];
}

/** The game's default transparency, where a look draws as it is designed. */
export const DEFAULT_TRANSPARENCY = 0.5;

/** Which of the game's two panel opacities each surface follows: the head and the popovers are its dark panels. */
const OPACITY_OF: Readonly<Record<Surface, "normal" | "dark">> = { head: "dark", body: "normal", popBg: "dark" };

/** The game's two panel opacities for a transparency from 0 to 1, as its own index.js computes them. */
export function panelOpacities(transparency: number): { normal: number; dark: number } {
  const e = Number.isFinite(transparency) ? Math.min(1, Math.max(0, transparency)) : DEFAULT_TRANSPARENCY;
  const normal = 1 - 0.75 * (2 * e - e * e);

  return { normal, dark: 1.66 * normal - 0.66 * normal * normal };
}

/**
 * Each panel's alpha: the look's own, scaled as the game's opacity moves from its default, never
 * past opaque. Followed plainly, the list would draw far lighter than designed.
 */
export function surfaceAlphas(transparency: number, own: Readonly<Record<Surface, number>> = STANDARD_SURFACE_ALPHAS): Record<Surface, number> {
  const now = panelOpacities(transparency);
  const atDefault = panelOpacities(DEFAULT_TRANSPARENCY);
  const alphas = {} as Record<Surface, number>;

  for (const surface of Object.keys(own) as Surface[]) {
    const role = OPACITY_OF[surface];
    alphas[surface] = Math.min(1, own[surface] * (now[role] / atDefault[role]));
  }

  return alphas;
}

/** The root's custom properties that carry a look's alphas to its panel tokens, to three places. */
export function surfaceAlphaStyle(transparency: number, own: Readonly<Record<Surface, number>> = STANDARD_SURFACE_ALPHAS): CSSProperties {
  const style: Record<string, string> = {};

  for (const [surface, alpha] of Object.entries(surfaceAlphas(transparency, own))) {
    style[`--bbm-a-${surface}`] = String(Math.round(alpha * 1000) / 1000);
  }

  return style as CSSProperties;
}
