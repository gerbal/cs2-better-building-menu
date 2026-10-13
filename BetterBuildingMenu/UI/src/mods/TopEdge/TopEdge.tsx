import { Tooltip } from "cs2/ui";
import classNames from "classnames";

import { useHeightHint } from "mods/AssetMenuResizeHandle/AssetMenuResizeHandle";
import styles from "./topEdge.module.scss";

export interface TopEdgeProps {
  active: boolean;
  onBeginResize: (event: any) => void;
}

/**
 * The strip over the box's top edge that starts the height drag: an overlay, the box's last child,
 * from 6 rem above the box to 2 inside it. A press raises the drag's full-screen blocker; the game's
 * input sends mouse events only. See docs/design-notes.md, "The top edge".
 */
export const TopEdge = ({ active, onBeginResize }: TopEdgeProps) => (
  <Tooltip tooltip={useHeightHint()}>
    <div className={styles.topEdge} onMouseDown={onBeginResize}>
      <div className={classNames(styles.grip, active && styles.gripActive)} />
    </div>
  </Tooltip>
);
