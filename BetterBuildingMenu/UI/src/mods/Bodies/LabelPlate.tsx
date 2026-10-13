import { useLocalization } from "cs2/l10n";
import { FOCUS_DISABLED } from "cs2/input";
import { Button } from "cs2/ui";
import classNames from "classnames";
import { memo } from "react";

import { groupDigits } from "domain/assetMenuMetricFormat";
import type { CatalogSection } from "domain/buildingCatalog";
import { setSectionCollapsedCommand } from "domain/buildingCatalogContracts";
import { resolveVanillaLabel, vanillaCategoryNameKeys } from "domain/vanillaServiceLabels";
import { send } from "mods/bindings";
import styles from "./labelPlate.module.scss";
import { useNumberSeparators, useStateWords } from "./useBodyWords";

export interface LabelPlateProps {
  section: CatalogSection;
  /** Where the plate sits and how big it is, in rem: its slot, or its line. */
  place: { left: number; top: number; width: number; height: number };
  /** Its name over its count, for a tile's square; side by side otherwise. */
  stacked: boolean;
}

/**
 * A label plate: a group's name, in the game's words where the game has one, or the locked word, then
 * the true count. The plate reads its words and digit separators as the bodies' buildings do, so every
 * body draws it from its section and its place alone. The Locked plate is pressed to collapse the locked
 * rows, and again to show them. Not a building: the live check and the render tests count it by its own
 * marker, data-bbm-label.
 */
export const LabelPlate = memo(function LabelPlate({ section, place, stacked }: LabelPlateProps) {
  const { translate } = useLocalization();
  const stateWords = useStateWords();
  const separators = useNumberSeparators();
  const locked = section.kind === "locked";
  const text = locked ? stateWords.locked : resolveVanillaLabel(vanillaCategoryNameKeys(section.labelId), (key) => translate(key, null), section.label);
  // Inline, over the game's Button and its own square: the slot is the plate's place and size.
  const style = { left: `${place.left}rem`, top: `${place.top}rem`, width: `${place.width}rem`, height: `${place.height}rem` };
  const content = (
    <>
      {/* The name in a box of its own inside the flex child: Cohtml draws no ellipsis on a flex item. */}
      <span className={styles.labelText}><span className={styles.labelWords}>{text}</span></span>
      <span className={styles.labelCount}>{groupDigits(section.count, separators)}</span>
    </>
  );

  if (!locked) {
    return <div className={classNames(styles.label, stacked && styles.stacked)} style={style} data-bbm-label={section.kind}>{content}</div>;
  }

  return (
    <Button
      className={classNames(styles.label, styles.lockedLabel, stacked && styles.stacked)}
      style={style}
      variant="flat"
      focusKey={FOCUS_DISABLED}
      onSelect={() => send(setSectionCollapsedCommand(section.id, !section.collapsed))}
      aria-expanded={section.collapsed ? "false" : "true"}
      data-bbm-label={section.kind}
    >
      {content}
    </Button>
  );
}, samePlate);

/** A body places its plates afresh each render, so the place is compared by its numbers. */
function samePlate(a: LabelPlateProps, b: LabelPlateProps): boolean {
  return a.section === b.section && a.stacked === b.stacked
    && a.place.left === b.place.left && a.place.top === b.place.top && a.place.width === b.place.width && a.place.height === b.place.height;
}
