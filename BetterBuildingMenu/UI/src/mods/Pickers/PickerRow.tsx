import { FOCUS_DISABLED } from "cs2/input";
import { Button } from "cs2/ui";
import classNames from "classnames";

import styles from "./pickerList.module.scss";

export interface PickerRowProps {
  label: string;
  /** Its choice is the one in force. */
  lit?: boolean;
  /** A dim word at the row's right: a direction, "every menu ›". */
  note?: string;
  /** Offered, but not what draws here: beside the pane, a step that does not fit. */
  dim?: boolean;
  onSelect: () => void;
}

/** One row of a list, in a popover or the control pane: 24 tall, the lit one in the selected colour. */
export const PickerRow = ({ label, lit = false, note, dim = false, onSelect }: PickerRowProps) => (
  <Button
    className={classNames(styles.row, lit && styles.lit, dim && styles.dim)}
    variant="icon"
    focusKey={FOCUS_DISABLED}
    aria-label={label}
    aria-current={lit ? "true" : undefined}
    onSelect={onSelect}
  >
    <span className={styles.name}>{label}</span>
    {note !== undefined && <span className={styles.note}>{note}</span>}
  </Button>
);
