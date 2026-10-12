/**
 * What a look needs from the game at run time: each panel's alpha under the player's interface
 * transparency. The tokens themselves are looks/_looks.scss. See docs/design-notes.md, "The looks'
 * tokens".
 */
import type { CSSProperties } from "react";

/** Standard's own alpha for each panel, as drawn at the game's default transparency; _looks.scss declares the same. */
export const STANDARD_SURFACE_ALPHAS = { head: 0.96, body: 0.92, popBg: 0.97 } as const;

export type Surface = keyof typeof STANDARD_SURFACE_ALPHAS;

/** The game's default transparency, where a look draws as it is designed. */
const DEFAULT_TRANSPARENCY = 0.5;

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
export function surfaceAlphas(transparency: number): Record<Surface, number> {
  const now = panelOpacities(transparency);
  const atDefault = panelOpacities(DEFAULT_TRANSPARENCY);
  const alphas = {} as Record<Surface, number>;

  for (const surface of Object.keys(STANDARD_SURFACE_ALPHAS) as Surface[]) {
    const role = OPACITY_OF[surface];
    alphas[surface] = Math.min(1, STANDARD_SURFACE_ALPHAS[surface] * (now[role] / atDefault[role]));
  }

  return alphas;
}

/** The root's custom properties that carry those alphas to the panel tokens, to three places. */
export function surfaceAlphaStyle(transparency: number): CSSProperties {
  const style: Record<string, string> = {};

  for (const [surface, alpha] of Object.entries(surfaceAlphas(transparency))) {
    style[`--bbm-a-${surface}`] = String(Math.round(alpha * 1000) / 1000);
  }

  return style as CSSProperties;
}
