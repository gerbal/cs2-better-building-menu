/**
 * Which view the build menu draws. The player's pick this session wins, so a
 * pick redraws at once; then the view C# kept from an earlier session
 * (AssetMenuViewMode); then the default. Read, never written, by both the
 * catalog and the control pane, so the two cannot disagree.
 */
export const VIEW_MODE_KINDS = ["grid", "list", "cards", "table"] as const;

export type ViewModeKind = (typeof VIEW_MODE_KINDS)[number];

export function isViewModeKind(value: unknown): value is ViewModeKind {
  return typeof value === "string" && (VIEW_MODE_KINDS as readonly string[]).includes(value);
}

/** A view the lists offer: its kind, its string's key and its English. */
export interface ViewModeOption {
  id: ViewModeKind;
  localizationKey: string;
  fallback: string;
}

/**
 * Where the menu opens with no view picked, and what a reset goes back to: one constant, so the
 * catalog and the lists cannot disagree about which that is.
 */
export const DEFAULT_VIEW_MODE: ViewModeKind = "cards";

/** The views in the order the lists draw them: most picture to most data, the default first. */
export const VIEW_MODES: readonly ViewModeOption[] = [
  { id: "cards", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ViewCards]", fallback: "Cards" },
  { id: "list", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ViewList]", fallback: "List" },
  { id: "grid", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ViewGrid]", fallback: "Grid" },
  { id: "table", localizationKey: "Tooltip.LABEL[BetterBuildingMenu.ViewTable]", fallback: "Table" },
];

export function chooseViewMode(
  sessionPick: string,
  stored: string | null | undefined,
  fallback: ViewModeKind
): ViewModeKind {
  if (isViewModeKind(sessionPick)) return sessionPick;
  if (isViewModeKind(stored)) return stored;
  return fallback;
}

/**
 * This session's pick once the stored view moves. The stored view emptying is a reset, from
 * Options, so the pick goes with it; no pick sends "", so nothing else empties it.
 * Filling, an echo of a pick, or another kind keeps the pick, which C# is about to echo.
 */
export function sessionPickAfterStored(
  previous: string | null | undefined,
  next: string | null | undefined,
  sessionPick: string
): string {
  return isViewModeKind(previous) && !isViewModeKind(next) ? "" : sessionPick;
}
