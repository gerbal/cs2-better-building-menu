import { FOCUS_DISABLED } from "cs2/input";
import { Button } from "cs2/ui";
import classNames from "classnames";

import { PICKER_NOTE_GAP, PICKER_ROW_PADDING, TOP_ROW_TEXT } from "domain/assetMenuLayout";
import { CUT_MARK, planName } from "domain/namePlan";
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
  /** The row's width, in rem, where its list's box is fixed, as a popover's is: a row too long for it is cut. */
  room?: number;
  /** The word of the label a cut keeps, the choice it names; "" for none. */
  keep?: string;
  onSelect: () => void;
}

/**
 * One row of a list, in a popover or the control pane: 24 tall, the lit one in the selected colour. In
 * a box of fixed width a row that would run past it is cut once by the name planner, as Cohtml draws no
 * CSS ellipsis: its note first ("every… ›"), the label whole; only a label too long alone is cut, keeping
 * the word that names the choice, its note left off. The aria-label keeps the whole of it.
 */
export const PickerRow = ({ label, lit = false, note, dim = false, room, keep = "", onSelect }: PickerRowProps) => {
  const font = TOP_ROW_TEXT * useTextScale();
  const inner = room === undefined ? null : room - 2 * PICKER_ROW_PADDING;
  const labelWidth = textWidth(label, font);
  const fits = inner === null || labelWidth + (note === undefined ? 0 : PICKER_NOTE_GAP + textWidth(note, font)) <= inner;
  // The room the whole label leaves its note, and whether a cut of the note says more than the mark.
  const noteRoom = inner === null ? 0 : inner - labelWidth - PICKER_NOTE_GAP;
  const noteCut = !fits && note !== undefined && noteRoom > 0
    && planName(note, { width: noteRoom, lines: 1, font }).lines.some((line) => line !== CUT_MARK);
  const labelCut = !fits && !noteCut && inner !== null && labelWidth > inner;

  return (
    <Button
      className={classNames(styles.row, lit && styles.lit, dim && styles.dim)}
      variant="icon"
      focusKey={FOCUS_DISABLED}
      aria-label={label}
      aria-current={lit ? "true" : undefined}
      onSelect={onSelect}
    >
      {labelCut
        ? <PlannedName className={styles.name} name={label} width={inner} lines={1} font={font} distinct={keep} marked={false} />
        : <span className={styles.name}>{label}</span>}
      {note !== undefined && (fits
        ? <span className={styles.note}>{note}</span>
        : noteCut && <PlannedName className={styles.note} name={note} width={noteRoom} lines={1} font={font} marked={false} hugs />)}
    </Button>
  );
};
