import caseGlyph from "images/case.svg";
import gaugeGlyph from "images/gauge.svg";
import gridGlyph from "images/grid.svg";
import personGlyph from "images/person.svg";
import type { UnitGlyph } from "domain/rowNumbers";

/**
 * The one glyph set the bodies and the readout draw a key number's unit by: a gauge for a speed, a
 * person for a capacity that counts, a case for workers, a grid for a lot. Each draws as a mask, in its
 * own box beside the text, never inside a run of it.
 */
export const UNIT_GLYPHS: Readonly<Record<UnitGlyph, string>> = {
  gauge: gaugeGlyph,
  person: personGlyph,
  case: caseGlyph,
  grid: gridGlyph,
};
