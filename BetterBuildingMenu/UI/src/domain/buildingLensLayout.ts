import { fontSizeRatio } from "./textScale";

/**
 * Geometry shared by the Building Lens resize affordance and its contract
 * tests. Values are in the same rem-like units as the panel binding.
 */
export const BUILDING_LENS_PANEL_CHROME_WIDTH = 35;
export const BUILDING_LENS_MIN_WIDTH = 700 + BUILDING_LENS_PANEL_CHROME_WIDTH;
/**
 * The drag ceiling, and the twin of BuildingLensWidth.Max in C# — a test
 * asserts the two agree.
 *
 * They did not, quietly: this was 1200 + chrome = 1235 against a C# Max of
 * 1232, so the last 3rem of any drag was clamped away on commit. Stating the
 * band total and subtracting the chrome, the way the C# side derives it, makes
 * the two readable as the same number instead of two guesses that nearly meet.
 */
export const BUILDING_LENS_BAND_WIDTH = 1476;
export const BUILDING_LENS_MAX_WIDTH = BUILDING_LENS_BAND_WIDTH - BUILDING_LENS_PANEL_CHROME_WIDTH;
export const BUILDING_LENS_TITLE_ICON = "coui://betterbuildingmenu/Icons/Colored/BuildingZoneSignature.svg";
export const BUILDING_LENS_TITLE_GAP = 6;
// The lens shell is bottom-aligned above the native toolbar. Reserve space
// for that toolbar, the shell chrome, and a small top/bottom safety margin so
// the catalog cannot push the shell's title/search bar outside a short view.
export const BUILDING_LENS_VIEWPORT_RESERVE = 210;
export const BUILDING_LENS_MIN_CATALOG_HEIGHT = 320;
export const BUILDING_LENS_REFERENCE_HEIGHT = 1080;

export type BuildingLensDensityTier = "compact" | "default" | "expanded";
export type BuildingLensMetric = "cost" | "upkeep" | "workers" | "capacity" | "lot" | "level" | "parking";

export interface BuildingLensRowGeometry {
  rowHeight: number;
  selectorHeight: number;
  identityHeight: number;
  selectorVerticalPadding: number;
}

const rowGeometryByTier: Record<BuildingLensDensityTier, BuildingLensRowGeometry> = {
  compact: { rowHeight: 84, selectorHeight: 80, identityHeight: 72, selectorVerticalPadding: 2 },
  default: { rowHeight: 92, selectorHeight: 88, identityHeight: 72, selectorVerticalPadding: 2 },
  expanded: { rowHeight: 92, selectorHeight: 88, identityHeight: 72, selectorVerticalPadding: 2 },
};

const compactMetricLabels: Record<BuildingLensMetric, string> = {
  cost: "Cost",
  upkeep: "Upk",
  workers: "Wkr",
  capacity: "Cap",
  lot: "Lot",
  level: "Lvl",
  parking: "Park",
};

/** Map the existing outer panel width to the deterministic visual density tier. */
export function getBuildingLensDensity(outerWidth: number): BuildingLensDensityTier {
  if (outerWidth < 800) return "compact";
  if (outerWidth < 1000) return "default";
  return "expanded";
}

export function getBuildingLensRowGeometry(tier: BuildingLensDensityTier): BuildingLensRowGeometry {
  return rowGeometryByTier[tier];
}

/** Return a compact header label while keeping localized full labels available to callers. */
export function getBuildingLensMetricLabel(
  metric: BuildingLensMetric,
  tier: BuildingLensDensityTier,
  fullLabel: string,
): string {
  return tier === "compact" ? compactMetricLabels[metric] : fullLabel;
}

/** Keep compact panels dense while restoring readable metric text at normal widths. */
export function getBuildingLensMetricTextScale(tier: BuildingLensDensityTier): "compact" | "readable" {
  return tier === "compact" ? "compact" : "readable";
}

/**
 * What each metric column costs at a comfortable width.
 *
 * Measured content, not guesses: "5 600 000" in Cost, "225 000/mo" in Upkeep,
 * "15 000 students" in Capacity, plus the 8rem right gutter the numeric columns
 * carry. Sized so nothing clips — an earlier set of 54-58rem columns clipped 234
 * of 600 rendered cells.
 */
export const BUILDING_LENS_COLUMN_MAX: Record<BuildingLensMetric, number> = {
  cost: 100,
  // The widest figure this column draws is a road's "¢2,437 /km/mo." — the
  // game's own per-kilometre-per-month template — and it does not scale with
  // the panel. At 1280x720 one rem draws 0.54px; the text wants 59–60px, which
  // is 112rem, and 108 clipped its last character on every road. The minimum
  // below holds the same figure for the same reason.
  upkeep: 116,
  workers: 62,
  capacity: 122,
  lot: 88,
  level: 46,
  parking: 52,
};

/**
 * What each column may be squeezed to before the name gives up any more.
 *
 * These clip the rare widest value and fit the common one, which is the trade
 * this whole function exists to make. Roughly three quarters of the comfortable
 * width, rounded to whole units, and never below what a two-digit figure and
 * its gutter need.
 */
export const BUILDING_LENS_COLUMN_MIN: Record<BuildingLensMetric, number> = {
  cost: 76,
  // Holds "¢2,437 /km/mo." at any panel width — see the maximum above.
  upkeep: 116,
  workers: 48,
  capacity: 88,
  lot: 68,
  level: 38,
  parking: 44,
};

/**
 * What the identity column is expected to keep at the narrowest panel.
 *
 * Not a CSS min-width — that was tried and it backfires. In Cohtml a min-width
 * on a flex item disables its flex-grow: measured on the live row, the identity
 * cell froze at exactly 120px with 112px of free space unclaimed beside it, and
 * setting min-width back to 0 grew it to 225px on the spot. So the floor cannot
 * be declared; it has to be left over.
 *
 * This is therefore a budget, and the column floors below are chosen so that
 * roughly this much survives at BUILDING_LENS_MIN_WIDTH. Measured after: the
 * name renders 77px at the narrowest panel, where it used to be ZERO — squeezed
 * out of existence while Capacity held 122 units to draw "—".
 */
export const BUILDING_LENS_IDENTITY_MIN = 180;

/**
 * Everything in a table row that is not the name, in rem.
 *
 * Mirrors buildingCatalog.module.scss, which is the authority — if a trailing
 * control is resized there, this has to follow:
 *
 *   $table-trailing-reserve  34  (4 padding + 26 details chevron + 4 outer)
 *   $rows-scrollbar-width    16  (reserved while the rows scroll)
 *   .rowSelect padding-left   8
 *   .thumbnail + its margin  80  (68 + 12; a margin because `gap` is inert here)
 *
 * Written down because the first attempt at the name budget subtracted only the
 * metric columns and over-estimated the name box by about 177rem — enough that
 * the middle-elision never fired and CSS went on cutting the tail, which is the
 * exact failure it was added to remove.
 */
export const BUILDING_LENS_TABLE_ROW_FURNITURE = 34 + 16 + 8 + 80;

/**
 * What the control pane takes out of the assembly: its own 379rem plus the
 * 6rem margin beside it.
 *
 * Lives here, with the rest of the layout arithmetic, because two unrelated
 * places need it: the surface sizes the panel by subtracting it, and the table
 * has to subtract it again to know how much width a NAME gets. The binding they
 * both start from is the whole assembly — BuildingLensWidth's own remark is
 * explicit that it means "the build menu and the control plane beside it" —
 * and forgetting that produced a name budget 2.2x too large, twice.
 *
 * 379rem, not 253rem: the target is 253 PIXELS and 1rem is 0.6667px.
 */
export const BUILDING_LENS_CONTROL_PANE_TOTAL = 385;

/**
 * What the table's panel spends around its rows: the row viewport's
 * scrollbar, the rows' own padding and the panel's inner margins. Measured
 * live at 1280x720 with PanelWidth 1441 — the whole assembly, control pane
 * included: the panel is 1441 − 385 = 1056rem and a row is 1026rem, so 30.
 *
 * An earlier reading had the row at 820rem and the chrome at 236, and the
 * columns were held to a 422rem "room" while the same row drew every column
 * at its comfortable width with 327rem left for the name. Measured again on
 * 2026-09-09 with the maximum widths applied by hand; see docs/verification.md.
 */
export const BUILDING_LENS_TABLE_CHROME = 30;

/**
 * The name column's basis, the room a row keeps for it before the metric
 * columns take theirs. At the default assembly the columns leave the name
 * 327rem; the basis is what it must keep as the panel narrows.
 */
export const BUILDING_LENS_TABLE_NAME_BASIS = 260;

/**
 * The room the metric columns really have, in rem, for an assembly width as
 * the catalog passes it (panel plus chrome): the assembly less the control
 * pane, the panel's chrome around the rows, the row's furniture and the
 * name's basis. 628rem at the default assembly. Never negative: below about
 * 850rem the arithmetic runs out, and the columns then sit at their minima.
 */
export function tableColumnRoom(outerWidth: number): number {
  const room = outerWidth
    - BUILDING_LENS_PANEL_CHROME_WIDTH
    - BUILDING_LENS_CONTROL_PANE_TOTAL
    - BUILDING_LENS_TABLE_CHROME
    - BUILDING_LENS_TABLE_ROW_FURNITURE
    - BUILDING_LENS_TABLE_NAME_BASIS;
  return Math.max(room, 0);
}

export type BuildingLensColumnWidths = Record<BuildingLensMetric, number>;

const sumWidths = (widths: BuildingLensColumnWidths): number =>
  Object.values(widths).reduce((total, width) => total + width, 0);

/**
 * The seven metric column widths for an assembly width as the catalog passes
 * it (panel plus chrome), in rem.
 *
 * The columns move between their minimum and comfortable widths by the ROOM
 * beside the name, not by the panel's position in its range: a set that
 * sums to the room is what keeps the name at its basis, since every metric
 * cell is flex: 0 0 auto and the name is the only item that yields. Where
 * the room holds the comfortable set, every column gets it; where it does
 * not hold the minimum set, the columns sit at their minima and the name
 * gives way, as it always did there.
 *
 * The cells are fontSizeS; their figures do not scale with the panel but do
 * with the game's text scale (see domain/textScale.ts), so the room is read
 * in unscaled units and the result scaled back up.
 */
export function getBuildingLensColumnWidths(outerWidth: number, textScale = 1): BuildingLensColumnWidths {
  const width = Number.isFinite(outerWidth) ? outerWidth : BUILDING_LENS_MIN_WIDTH;
  const textRatio = fontSizeRatio("s", textScale);
  const room = tableColumnRoom(width);

  // How far along from the minimum set to the comfortable set the room
  // reaches, read in unscaled units since the figures grow with the text.
  const minTotal = sumWidths(BUILDING_LENS_COLUMN_MIN);
  const span = sumWidths(BUILDING_LENS_COLUMN_MAX) - minTotal;
  // A degenerate range would divide by zero; every column simply gets its
  // comfortable width, which is what a single supported set deserves.
  const share = span <= 0
    ? 1
    : Math.max(0, Math.min(1, (room / textRatio - minTotal) / span));

  const base = {} as BuildingLensColumnWidths;
  for (const metric of Object.keys(BUILDING_LENS_COLUMN_MAX) as BuildingLensMetric[]) {
    const min = BUILDING_LENS_COLUMN_MIN[metric];
    const max = BUILDING_LENS_COLUMN_MAX[metric];
    base[metric] = min + (max - min) * share;
  }

  // The figures grow with the text scale as far as the room allows and no
  // further: a set already at its minima cannot also grow by half. What does
  // not fit at a large scale clips inside its cell, which is the lesser harm
  // — the alternative squeezed the name to 13px at 125 %.
  const baseTotal = sumWidths(base);
  const grow = room > 0 && baseTotal > 0
    ? Math.min(textRatio, Math.max(1, room / baseTotal))
    : 1;

  const widths = {} as BuildingLensColumnWidths;
  for (const metric of Object.keys(base) as BuildingLensMetric[]) {
    // Whole units: a fractional width is a column that lands on a different
    // pixel in the header than in the rows, which is the alignment bug this
    // table has already been fixed for once.
    widths[metric] = Math.round(base[metric] * grow);
  }

  return widths;
}

/**
 * Return a deterministic max height for the catalog's bounded row viewport.
 * Gameface's viewport-unit calculation is not reliable across the game's
 * render targets. Its rem-like panel units are normalized to a 1080px design
 * height, so convert the physical viewport budget into those units here.
 *
 * In practice this is a constant, and knowing that saves the next reader an
 * experiment: the cohtml layer renders at a FIXED 1280x720 logical viewport
 * and scales it to the window, so `window.innerHeight` is always 720 and the
 * only value this is ever called with is 720 — giving 765 every time.
 * Measured 2026-08-09 with the game window at 1920x1080 (confirmed in
 * Player.log): window.innerWidth/innerHeight still read 1280x720 and
 * Page.captureScreenshot still returned a 1280x720 image.
 *
 * The parameter stays because the arithmetic is the honest statement of what
 * the number means, and because it is what makes the function testable. But
 * nothing here adapts to a real resolution change, and no layout in this mod
 * needs to — 1rem is 0.6667px at every resolution, not just at 720p.
 */
export function getBuildingLensCatalogMaxHeight(viewportHeight: number): number {
  const safeViewportHeight = Number.isFinite(viewportHeight) ? viewportHeight : 720;
  const physicalHeight = Math.max(BUILDING_LENS_MIN_CATALOG_HEIGHT, safeViewportHeight - BUILDING_LENS_VIEWPORT_RESERVE);
  return Math.floor((physicalHeight * BUILDING_LENS_REFERENCE_HEIGHT) / safeViewportHeight);
}

export type BuildingLensAlignment = "Left" | "Center" | "Right" | string;

// clampBuildingLensWidth and resizedBuildingLensWidth lived here and are gone
// with the horizontal drag: the band has one correct width, so there is
// nothing to clamp a dragged value to. BUILDING_LENS_MIN_WIDTH and
// BUILDING_LENS_MAX_WIDTH stay — the table sizes its columns against them.

/**
 * The catalog's height range, twin of BuildingLensHeight in C# — a test asserts
 * they agree.
 *
 * Min is two tile rows plus padding; Max is the viewport (a fixed 1080rem) less
 * the chrome below the panel. Between them the height is the player's, set by
 * dragging the panel's top edge.
 */
export const BUILDING_LENS_MIN_HEIGHT = 200;
export const BUILDING_LENS_MAX_HEIGHT = 960;
export const BUILDING_LENS_DEFAULT_HEIGHT = 420;

/**
 * Clamp a dragged height.
 *
 * Non-finite resolves to the default rather than passing through: the value
 * goes straight into an inline style, and `height: NaNrem` leaves the catalog
 * unsized rather than merely wrong.
 */
export function clampBuildingLensHeight(height: number): number {
  if (!Number.isFinite(height)) return BUILDING_LENS_DEFAULT_HEIGHT;
  return Math.max(BUILDING_LENS_MIN_HEIGHT, Math.min(BUILDING_LENS_MAX_HEIGHT, height));
}

/**
 * The height a drag of `delta` pixels from `startHeight` should produce.
 *
 * The panel is bottom-anchored and the handle is on its top edge, so dragging
 * up (negative delta) makes it taller — the sign flip is the whole reason this
 * is a named function rather than an addition at the call site.
 */
export function draggedBuildingLensHeight(startHeight: number, startY: number, currentY: number): number {
  const delta = Number.isFinite(startY) && Number.isFinite(currentY) ? startY - currentY : 0;
  return clampBuildingLensHeight(startHeight + delta / REM_IN_PX);
}

/**
 * Pixels per rem in the game's UI layer, at every resolution — see
 * getBuildingLensCatalogMaxHeight for why this is not resolution-dependent.
 */
export const REM_IN_PX = 0.6667;
