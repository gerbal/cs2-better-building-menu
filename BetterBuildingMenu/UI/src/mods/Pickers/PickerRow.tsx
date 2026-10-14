import { FOCUS_DISABLED } from "cs2/input";
import { Button } from "cs2/ui";
import classNames from "classnames";

import { PICKER_NOTE_GAP, PICKER_ROW_PADDING, TOP_ROW_TEXT } from "domain/assetMenuLayout";
import { textWidth } from "domain/textWidth";
import { useTextScale } from "domain/textScaleSetting";
import { PlannedName } from "mods/Bodies/PlannedName";
import styles from "./pickerList.module.scss";

export interface PickerRowProps {
  label: string;
  /** Its choice is the one in force. */
  lit?: boolean;
  /** A dim word at the row's right: a direction, "every menu ›". */
  note?: string;
  /** Offered, but not what draws here: beside the pane, a step that does not fit. */
  dim?: boolean;
  /** The row's width, in rem, where its list's box is fixed, as a popover's is: a label too long for it is cut. */
  room?: number;
  /** The word of the label a cut keeps, the choice it names; "" for none. */
  keep?: string;
  onSelect: () => void;
}

/**
 * One row of a list, in a popover or the control pane: 24 tall, the lit one in the selected colour. In
 * a box of fixed width a label that would run past it is cut once by the name planner, keeping the
 * word that names the choice, as Cohtml draws no CSS ellipsis; the aria-label keeps the whole of it.
 */
export const PickerRow = ({ label, lit = false, note, dim = false, room, keep = "", onSelect }: PickerRowProps) => {
  const font = TOP_ROW_TEXT * useTextScale();
  const nameRoom = room === undefined ? null : room - 2 * PICKER_ROW_PADDING - (note === undefined ? 0 : PICKER_NOTE_GAP + textWidth(note, font));

  return (
    <Button
      className={classNames(styles.row, lit && styles.lit, dim && styles.dim)}
      variant="icon"
      focusKey={FOCUS_DISABLED}
      aria-label={label}
      aria-current={lit ? "true" : undefined}
      onSelect={onSelect}
    >
      {nameRoom !== null && textWidth(label, font) > nameRoom
        ? <PlannedName className={styles.name} name={label} width={nameRoom} lines={1} font={font} distinct={keep} marked={false} />
        : <span className={styles.name}>{label}</span>}
      {note !== undefined && <span className={styles.note}>{note}</span>}
    </Button>
  );
};
