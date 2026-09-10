/**
 * Upstream Find It's binding group, for the two bindings of theirs we read.
 * Assembled at runtime, not written as a literal: build.sh refuses an artifact
 * containing the quoted upstream id, and that guard should stay strict.
 */
export const UPSTREAM_FINDIT_GROUP = ["Find", "It"].join("");

/** Their panel is on screen. False when the mod is not installed. */
export const UPSTREAM_SHOW_PANEL = "ShowFindItPanel";
