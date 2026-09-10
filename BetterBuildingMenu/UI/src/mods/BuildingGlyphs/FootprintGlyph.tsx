import type { ZoneFootprint } from "domain/zoningHierarchy";
import styles from "../BuildingList/buildingList.module.scss";

interface FootprintGlyphProps {
  footprint: ZoneFootprint;
}

/**
 * One lot shape, drawn as a tiny grid of cells, because a player choosing a
 * zone is matching against a block on the map rather than reading a range.
 * Nested flex rows rather than CSS grid, which Cohtml does not support.
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
