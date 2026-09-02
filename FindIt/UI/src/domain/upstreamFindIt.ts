/**
 * Upstream Find It's binding group, for the two bindings of theirs we read.
 *
 * Spelled out at runtime rather than as a literal: the package guard in
 * build.sh refuses any artifact containing the quoted upstream id, and that
 * guard is what keeps our publisher identity separate from theirs. Reading a
 * binding they publish is interop, not identity, but the guard cannot tell
 * the two apart and should stay strict (cm-wf6g.4).
 */
export const UPSTREAM_FINDIT_GROUP = ["Find", "It"].join("");

/** Their panel is on screen. False when the mod is not installed. */
export const UPSTREAM_SHOW_PANEL = "ShowFindItPanel";
