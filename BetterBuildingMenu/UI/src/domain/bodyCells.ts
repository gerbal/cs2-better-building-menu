/**
 * The cells a body places, in order: its buildings, and the label plates over them, each in its slot.
 * A label sits in the slot before its section's first row, once the window has reached that row, and
 * takes one slot in line with the buildings or, under the Block labels knob's own line, a fresh line of
 * its own. The sections come counted over the whole result, so this needs the window alone. Pure. See
 * docs/design-notes.md, "Label plates".
 */
import type { BuildingCatalogEntry, CatalogSection } from "./buildingCatalog";

/** No labels: one array, so a page without sections keeps a body's memo. */
export const NO_SECTIONS: readonly CatalogSection[] = [];

/** A label's place: one slot in line, as it ships, or a line of its own. */
export type BlockLabels = "inline" | "ownLine";

/** A body's next thing to place: a section's label, or a building with its place in the window. */
export type BodyEntry =
  | { kind: "label"; section: CatalogSection }
  | { kind: "item"; entry: BuildingCatalogEntry; index: number };

export type BodyCell =
  | { kind: "label"; section: CatalogSection; slot: number; span: number }
  | { kind: "item"; entry: BuildingCatalogEntry; index: number; slot: number };

export interface BodyCells {
  cells: BodyCell[];
  /** How many slots the cells take, empty ones an own-line label leaves included. */
  slots: number;
}

/**
 * The window's buildings in order, each section's label before its first row once the window has
 * reached it. A section's start counts from the result's first row and the window's from its offset,
 * so the start is read less the offset. After the last row comes only a collapsed section's label,
 * which is all it draws: a group whose rows the window has not reached yet waits for its first row,
 * never a label above Load more with nothing under it.
 */
export function bodyOrder(entries: readonly BuildingCatalogEntry[], sections: readonly CatalogSection[], offset = 0): BodyEntry[] {
  const ordered = [...sections].sort((a, b) => a.start - b.start);
  const out: BodyEntry[] = [];
  let next = 0;

  entries.forEach((entry, index) => {
    while (next < ordered.length && ordered[next].start - offset <= index) out.push({ kind: "label", section: ordered[next++] });
    out.push({ kind: "item", entry, index });
  });

  for (; next < ordered.length && ordered[next].start - offset <= entries.length; next++) {
    if (ordered[next].collapsed) out.push({ kind: "label", section: ordered[next] });
  }

  return out;
}

/** The order placed in slots: a label one slot in line, or a fresh line of its own and the whole of it. */
export function bodyCells(
  entries: readonly BuildingCatalogEntry[],
  sections: readonly CatalogSection[],
  cols: number,
  blockLabels: BlockLabels,
  offset = 0,
): BodyCells {
  const across = Math.max(1, cols);
  const cells: BodyCell[] = [];
  let slot = 0;

  for (const next of bodyOrder(entries, sections, offset)) {
    if (next.kind === "item") {
      cells.push({ ...next, slot });
      slot += 1;
    } else if (blockLabels === "ownLine") {
      slot += (across - (slot % across)) % across;
      cells.push({ ...next, slot, span: across });
      slot += across;
    } else {
      cells.push({ ...next, slot, span: 1 });
      slot += 1;
    }
  }

  return { cells, slots: slot };
}
