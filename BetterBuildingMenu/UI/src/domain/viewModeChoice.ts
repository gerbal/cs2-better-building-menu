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

export function chooseViewMode(
  sessionPick: string,
  stored: string | null | undefined,
  fallback: ViewModeKind
): ViewModeKind {
  if (isViewModeKind(sessionPick)) return sessionPick;
  if (isViewModeKind(stored)) return stored;
  return fallback;
}
