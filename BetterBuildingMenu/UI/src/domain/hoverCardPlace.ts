/**
 * Where the hover card draws, in screen rem (a screen is `LAYOUT_HEIGHT` rem tall): beside the pointer, above the
 * box on the pointed cell's edge, clear of the game's HUD and of the cells around it. Pure. See
 * docs/design-notes.md, "The hover card".
 */
import { LAYOUT_HEIGHT } from "./sharedContracts.generated";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A rectangle the page reports in pixels, in screen rem; a zero one where the screen is unknown. */
export function remRect(rect: { left: number; top: number; width: number; height: number } | null | undefined, innerHeight: number): Rect {
  const rem = innerHeight > 0 && Number.isFinite(innerHeight) ? innerHeight / LAYOUT_HEIGHT : 0;
  if (!rect || rem === 0) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: rect.left / rem, y: rect.top / rem, w: rect.width / rem, h: rect.height / rem };
}

/** A piece of the game's HUD a card keeps clear of. */
export interface HudPiece extends Rect {
  name: string;
}

/** Between the card and the box's top edge, or the pointed cell's side. */
export const CARD_GAP = 6;

/** The room a card keeps from the screen's edges and from the HUD. */
const MARGIN = 4;

/** An overlap smaller than this, in rem², is a shared edge, not a covered cell. */
const TOUCH = 0.5;

/**
 * The game's HUD at its own layout: the bottom bar across the screen; the chirper, the social column and
 * the top-right buttons by the screen's right edge; the top-left buttons by its left.
 */
export function hudPieces(screenWidth: number): HudPiece[] {
  return [
    { name: "bottom bar", x: 0, y: 960, w: screenWidth, h: LAYOUT_HEIGHT - 960 },
    { name: "chirper", x: screenWidth - 414, y: 733, w: 337, h: 114 },
    { name: "social column", x: screenWidth - 48, y: 770, w: 38, h: 184 },
    { name: "top-left buttons", x: 10, y: 10, w: 40, h: 40 },
    { name: "top-right buttons", x: screenWidth - 102, y: 10, w: 92, h: 40 },
  ];
}

/** How much two rectangles share, in rem². */
export function overlap(a: Rect, b: Rect): number {
  const across = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const down = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return across > 0 && down > 0 ? across * down : 0;
}

/** Whether a rectangle comes within the margin of a HUD piece. */
const meets = (rect: Rect, piece: Rect): boolean =>
  rect.x < piece.x + piece.w + MARGIN && rect.x + rect.w > piece.x - MARGIN && rect.y < piece.y + piece.h + MARGIN && rect.y + rect.h > piece.y - MARGIN;

/** Where a card sits, and how it got there: "above", "flipped" (above, on the cell's right edge), "right" or "left" of the cell. */
export interface CardPlace extends Rect {
  how: "above" | "flipped" | "right" | "left";
  /** False where no place fitted and the card took the first, held on screen. */
  fitted: boolean;
}

export interface PointerCardInput {
  /** The pointed cell. */
  cell: Rect;
  /** The card's drawn size. */
  card: { w: number; h: number };
  box: Rect;
  screen: { w: number; h: number };
  /** Every cell the body draws, the pointed one among them. */
  cells: readonly Rect[];
  hud?: readonly HudPiece[];
}

/**
 * Beside the pointer: above the box, its bottom `CARD_GAP` over the box's top, on the pointed cell's left edge,
 * else flipped to its right edge, each raised over any HUD piece it would meet; then beside the cell,
 * right, then left. Of the places on screen, clear of the HUD and off the pointed cell, the one covering
 * the fewest other cells wins, then one inside the box's span, then the first. Where none fits, the
 * first place, held on screen.
 */
export function placePointerCard({ cell, card, box, screen, cells, hud = hudPieces(screen.w) }: PointerCardInput): CardPlace {
  const above = (x: number, how: CardPlace["how"]): CardPlace => {
    let y = box.y - CARD_GAP - card.h;
    // Raised over each piece it meets, until it meets none.
    for (let pass = 0; pass < hud.length; pass++) {
      const met = hud.find((piece) => meets({ x, y, ...card }, piece) && piece.y - MARGIN - card.h < y);
      if (met === undefined) break;
      y = met.y - MARGIN - card.h;
    }
    return { x, y, ...card, how, fitted: true };
  };
  const besideY = Math.min(screen.h - MARGIN - card.h, Math.max(MARGIN, cell.y + cell.h / 2 - card.h / 2));
  const places: CardPlace[] = [
    above(cell.x, "above"),
    above(cell.x + cell.w - card.w, "flipped"),
    { x: cell.x + cell.w + CARD_GAP, y: besideY, ...card, how: "right", fitted: true },
    { x: cell.x - CARD_GAP - card.w, y: besideY, ...card, how: "left", fitted: true },
  ];
  const scored = places.map((place, index) => ({
    place,
    index,
    fits: place.x >= MARGIN && place.y >= MARGIN && place.x + place.w <= screen.w - MARGIN && place.y + place.h <= screen.h - MARGIN
      && !hud.some((piece) => meets(place, piece)) && overlap(place, cell) < TOUCH,
    // The pointed cell is the one that shares its own rectangle.
    covers: cells.filter((other) => overlap(other, cell) < TOUCH && overlap(place, other) > TOUCH).length,
    outside: place.x < box.x - TOUCH || place.x + place.w > box.x + box.w + TOUCH ? 1 : 0,
  }));
  const best = scored.filter((each) => each.fits).sort((a, b) => a.covers - b.covers || a.outside - b.outside || a.index - b.index)[0];
  if (best !== undefined) return best.place;

  const first = places[0];
  return {
    ...first,
    x: Math.min(Math.max(MARGIN, first.x), Math.max(MARGIN, screen.w - MARGIN - card.w)),
    y: Math.min(Math.max(MARGIN, first.y), Math.max(MARGIN, screen.h - MARGIN - card.h)),
    fitted: false,
  };
}
