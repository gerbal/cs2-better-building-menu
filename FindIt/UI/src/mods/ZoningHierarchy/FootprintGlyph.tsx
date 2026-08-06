import type { ZoneFootprint } from "domain/zoningHierarchy";
import styles from "../BuildingList/buildingList.module.scss";

interface FootprintGlyphProps {
  footprint: ZoneFootprint;
}

/**
 * One lot shape, drawn as a tiny grid of cells.
 *
 * "2–4 wide" says roughly what fits; a 2x2 next to a 4x2 says exactly which
 * shapes do, in the form the player is already thinking in — they are matching
 * against a block on the map, not reading a range.
 *
 * Built from nested flex rows rather than CSS grid: Cohtml has no grid support,
 * which the mod learned the hard way when the catalog table was first written.
 */
export const FootprintGlyph = ({ footprint }: FootprintGlyphProps) => {
  const rows = Array.from({ length: footprint.depth });
  const cells = Array.from({ length: footprint.width });

  return (
    <span
      className={styles.glyph}
      title={`${footprint.width} × ${footprint.depth}`}
      aria-label={`${footprint.width} by ${footprint.depth}`}
    >
      {rows.map((_, row) => (
        <span className={styles.glyphRow} key={row}>
          {cells.map((__, cell) => (
            <span className={styles.glyphCell} key={cell} />
          ))}
        </span>
      ))}
    </span>
  );
};
