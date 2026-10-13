/**
 * The cells a body places, in order: its buildings, and the label plates over them, each in its slot.
 * A label sits in the slot before its section's first row, once the window has reached that row, and
 * takes one slot in line with the buildings or, under the Block labels knob's own line, a fresh line of
 * its own. The sections come counted over the whole result, so this needs the window alone. A typed
 * search's results, which draw no label, can fill nearest the field instead (`NearField`). Pure. See
 * docs/design-notes.md, "Label plates" and "The bodies".
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
  /**
   * How many slots the cells take: the furthest one used and every one before it, empty ones
   * included.
   */
  slots: number;
}

/**
 * The window's buildings in order, each section's label before its first row once the window has
 * reached it. A section's start counts from the result's first row and the window's from its
 * offset, so the start is read less the offset: a section that ends before the window draws nothing,
 * and the one the window starts inside draws its label first. After the last row comes only a
 * collapsed section's label, which is all it draws: a group whose rows the window has not reached
 * yet waits for its first row, never a label above Load more with nothing under it.
 */
export function bodyOrder(entries: readonly BuildingCatalogEntry[], sections: readonly CatalogSection[], offset = 0): BodyEntry[] {
  // A collapsed section's rows are out of the order: it ends where it starts.
  const ordered = sections
    .filter((section) => section.start >= offset || section.start + (section.collapsed ? 0 : section.count) > offset)
    .sort((a, b) => a.start - b.start);
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

/** A search's flow at a wider step: the first step's columns and the lines a screen shows. */
export interface NearField {
  firstCols: number;
  lines: number;
}

/**
 * Where a search's result sits nearest the field: a screen at a time, the first step's columns down the
 * screen first, as at the first step, then the columns a wider step adds; never along the whole row.
 */
export function nearFieldSlot(index: number, cols: number, flow: NearField): number {
  const lines = Math.max(1, flow.lines);
  const screen = cols * lines;
  const band = Math.floor(index / screen);
  const at = index % screen;
  const first = flow.firstCols * lines;
  const added = cols - flow.firstCols;
  const [line, col] = at < first
    ? [Math.floor(at / flow.firstCols), at % flow.firstCols]
    : [Math.floor((at - first) / added), flow.firstCols + ((at - first) % added)];

  return (band * lines + line) * cols + col;
}

/**
 * The order placed in slots: a label one slot in line, or a fresh line of its own and the whole of it;
 * the buildings in the next slots, or, given a flow, nearest the field where the box has more columns
 * than the first step and no label is drawn.
 */
export function bodyCells(
  entries: readonly BuildingCatalogEntry[],
  sections: readonly CatalogSection[],
  cols: number,
  blockLabels: BlockLabels,
  offset = 0,
  flow?: NearField,
): BodyCells {
  const across = Math.max(1, cols);
  const near = flow !== undefined && sections.length === 0 && flow.firstCols > 0 && flow.firstCols < across ? flow : null;
  const cells: BodyCell[] = [];
  let slot = 0;
  let end = 0;

  for (const next of bodyOrder(entries, sections, offset)) {
    if (next.kind === "item") {
      const placed = near === null ? slot : nearFieldSlot(next.index, across, near);
      cells.push({ ...next, slot: placed });
      slot += 1;
      end = Math.max(end, placed + 1);
    } else if (blockLabels === "ownLine") {
      slot += (across - (slot % across)) % across;
      cells.push({ ...next, slot, span: across });
      slot += across;
      end = slot;
    } else {
      cells.push({ ...next, slot, span: 1 });
      slot += 1;
      end = slot;
    }
  }

  return { cells, slots: end };
}
