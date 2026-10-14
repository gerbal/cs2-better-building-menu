import { useLocalization } from "cs2/l10n";
import { Tooltip } from "cs2/ui";
import classNames from "classnames";

import styles from "./topEdge.module.scss";

export interface TopEdgeProps {
  active: boolean;
  onBeginResize: (event: any) => void;
}

/** The edge's hint: the drag, and the double press that puts the game's own size back. */
function useTopEdgeHint(): string {
  const { translate } = useLocalization();
  const fallback = "Drag to resize · double-click for the game's size";
  return translate("Tooltip.LABEL[BetterBuildingMenu.ResizeTopEdge]", fallback) ?? fallback;
}

/**
 * The strip over the box's top edge that starts the height drag: an overlay, the box's last child,
 * from 6 rem above the box to 2 inside it. A press raises the drag's full-screen blocker; the game's
 * input sends mouse events only. Its marker names the edge for the live check and the render tests.
 * See docs/design-notes.md, "The top edge".
 */
export const TopEdge = ({ active, onBeginResize }: TopEdgeProps) => (
  <Tooltip tooltip={useTopEdgeHint()}>
    <div className={styles.topEdge} onMouseDown={onBeginResize} data-bbm-edge="top">
      <div className={classNames(styles.grip, active && styles.gripActive)} />
    </div>
  </Tooltip>
);
