import { Scrollable } from "cs2/ui";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import classNames from "classnames";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import {
  groupTreeFromPaths,
  fitGroupLabel,
  fitLabelToWidth,
  shouldShowHeading,
  type GroupNode,
} from "domain/buildingGroups";
import { resolveVanillaLabel, vanillaCategoryNameKeys } from "domain/vanillaServiceLabels";
import { useLocalization } from "cs2/l10n";
import { BuildingGrid } from "mods/BuildingGrid/BuildingGrid";
import { BuildingList } from "mods/BuildingList/BuildingList";
import styles from "./groupedResults.module.scss";

/** Grid recognises, List scans, Cards weighs, Table compares. */

export type CatalogViewMode = "grid" | "list" | "cards" | "table";

interface GroupedResultsProps {
  entries: BuildingCatalogEntry[];
  viewMode: CatalogViewMode;
  onPlace: (entry: BuildingCatalogEntry) => void;
  /**
   * Rendered as the last child INSIDE the scroll, below every group. Passed
   * down because which element owns the scroll depends on runtime state, and a
   * footer outside it would sit below the scroll where nobody reads it.
   */
  footer?: ReactNode;
}

/**
 * A group heading that trims its label to the width it was actually given. The
 * estimate paints first and a measurement corrects it, taken from two elements
 * the answer cannot disturb: a `flex: 1 1 auto` box, and a full-string probe.
 */
const GroupHeading = ({
  label,
  estimate,
  count,
  nested,
  onHeight,
}: {
  label: string;
  estimate: string;
  count: number;
  nested: boolean;
  /**
   * The height this heading ended up needing, so the group can reserve it.
   * The heading is out of flow, so nothing else can discover this.
   */
  onHeight?: (px: number) => void;
}): JSX.Element => {
  const headingRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [fitted, setFitted] = useState(estimate);

  useEffect(() => {
    const box = boxRef.current;
    const probe = probeRef.current;

    if (!box || !probe) {
      return;
    }

    const report = () => {
      const heading = headingRef.current;

      if (heading && onHeight) {
        onHeight(heading.offsetHeight);
      }
    };

    const fit = () => {
      report();

      const available = box.clientWidth;
      const needed = probe.scrollWidth;

      // A box that has not been laid out reports 0. Keep the estimate rather
      // than fitting to a width that is not real.
      if (available > 0 && needed > 0) {
        setFitted(fitLabelToWidth(label, available, needed));
      }
    };

    // WATCH the box instead of guessing when it settles: Cohtml relayouts a
    // frame AFTER a view-mode change, so a single rAF fits the heading to the
    // view the player has just left. Nothing here feeds back into the width.
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(fit);

      observer.observe(box);
      // The probe too, so a changed label or a font swap re-fits even when the
      // width it has stayed the same.
      observer.observe(probe);
      fit();

      return () => observer.disconnect();
    }

    // No observer: settle for the second frame, which is where the relayout
    // lands. Strictly worse — it cannot see a later resize — so it is the
    // fallback rather than the design.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(fit);
    });

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [label]);

  return (
    <div ref={headingRef} className={classNames(styles.groupHeading, nested && styles.groupHeadingNested)}>
      <span ref={boxRef} className={styles.groupLabel} title={label}>
        {fitted}
      </span>
      <span ref={probeRef} className={styles.groupLabelProbe} aria-hidden="true">
        {label}
      </span>
      <span className={styles.groupCount}>{count}</span>
    </div>
  );
};

/**
 * One group: its heading, and the row's reserved room above it. `.groupHeading`
 * is out of flow so a long name cannot widen the group past its tiles, which
 * also means it cannot push the height — hence a reserve, the ROW's. See below.
 */
const GroupBox = ({
  className,
  depth,
  heading,
  reserve,
  onHeight,
  children,
}: {
  className: string;
  depth: number;
  heading: { label: string; estimate: string; count: number; nested: boolean } | null;
  reserve: number | null;
  onHeight: (px: number) => void;
  children: ReactNode;
}): JSX.Element => (
  <div
    className={className}
    data-group-depth={depth}
    // EVERY group in the row, headed or not, or an unlabeled group's tiles sit
    // a heading's height above its labelled neighbour's and the row loses its
    // shared baseline. With no heading anywhere, reserve stays null.
    style={reserve !== null ? { paddingTop: `${reserve}px` } : undefined}
  >
    {heading && (
      <GroupHeading
        label={heading.label}
        estimate={heading.estimate}
        count={heading.count}
        nested={heading.nested}
        onHeight={onHeight}
      />
    )}
    {children}
  </div>
);

/**
 * A row of sibling groups, all reserving the TALLEST heading's height. Tighter
 * per-group reserves would leave neighbouring tiles off a shared baseline,
 * which reads as a broken grid; padding cannot re-wrap, so this settles.
 */
const GroupRow = ({
  className,
  groups,
}: {
  className: string;
  groups: {
    key: string;
    className: string;
    depth: number;
    heading: { label: string; estimate: string; count: number; nested: boolean } | null;
    body: ReactNode;
  }[];
}): JSX.Element => {
  const [heights, setHeights] = useState<Record<string, number>>({});

  const measured = Object.values(heights);
  const reserve = measured.length > 0 ? Math.max(...measured) : null;

  const record = (key: string) => (px: number) =>
    setHeights((current) => (current[key] === px ? current : { ...current, [key]: px }));

  return (
    <div className={className}>
      {groups.map((group) => (
        <GroupBox
          key={group.key}
          className={group.className}
          depth={group.depth}
          heading={group.heading}
          reserve={reserve}
          onHeight={record(group.key)}
        >
          {group.body}
        </GroupBox>
      ))}
    </div>
  );
};

/**
 * Headings over a result set, rendered in whichever mode is active. Zones come
 * through here too, mapped onto catalog entries, so there is one grouped
 * renderer. Table is not handled here: it flattens headings into its own rows.
 */
export const GroupedResults = memo(function GroupedResults({
  entries,
  viewMode,
  onPlace,
  footer,
}: GroupedResultsProps) {
  const { translate } = useLocalization();
  // C# stamped every item with its headings for the effective dimension;
  // the tree is read off the page, never derived from the entries. Memoised
  // with the page, and the component with its props, so a keystroke that
  // re-renders the catalog leaves every tile alone.
  const groups = useMemo(() => groupTreeFromPaths(entries), [entries]);

  /**
   * The game's word for a heading, where the game has one: a category heading
   * names a vanilla category, which is localized. Everything else keeps the
   * derived label, because nothing owns those names but us.
   */
  const headingLabel = (node: GroupNode<BuildingCatalogEntry>): string =>
    node.labelId === undefined
      ? node.label
      : resolveVanillaLabel(
        vanillaCategoryNameKeys(node.labelId),
        (key) => translate(key, null),
        node.label
      );

  const renderLeaf = (leaf: BuildingCatalogEntry[]): JSX.Element => {
    if (viewMode === "list" || viewMode === "cards") {
      return (
        <BuildingList
          entries={leaf}
          onPlace={onPlace}
          variant={viewMode === "cards" ? "cards" : "compact"}
        />
      );
    }

    return <BuildingGrid entries={leaf} onPlace={onPlace} standalone={false} />;
  };

  const renderNodes = (
    nodes: GroupNode<BuildingCatalogEntry>[],
    depth: number,
    parentLabel: string | null = null,
    // Set by the PARENT row when this row draws no heading at all while a
    // sibling row does. See someChildRowIsHeaded below.
    reserveHiddenHeading = false
  ): JSX.Element => {
    // A single group covering everything is a label with nothing to
    // distinguish, once the player has already navigated to exactly that.
    const showHeadings = shouldShowHeading(nodes);

    // Sibling groups FLOW onto one line, so their tiles share a baseline.
    // GroupBox equalises that within a row but not ACROSS rows, so where some
    // siblings' children are headed, the rest keep the reserve too.
    const someChildRowIsHeaded = nodes.some(
      (node) => node.children.length > 0 && shouldShowHeading(node.children)
    );

    const boxes = nodes.map((node) => {
      // A group with two or more sub-groups takes the whole row, so its heading
      // sits alone and its children's on the next. One sub-group draws no
      // heading, so that group reads as a leaf and flows like one.
      const band = node.children.length > 1;
      // No heading, so no row reserved for one. Two cases: an only child, whose
      // heading shouldShowHeading already hides; and a nested name repeating
      // its parent's, which the dev tree produces for a category's base branch.
      const unlabeled =
        !showHeadings || (depth > 0 && parentLabel !== null && node.label === parentLabel);
      // Drawing no heading is not the same as reserving no row for one: when
      // the parent row says a neighbour reserves, this one matches or the two
      // sets of tiles stop lining up.
      const dropsReserve = unlabeled && !reserveHiddenHeading;

      return {
        key: node.path.join("/"),
        className: classNames(styles.group, band && styles.groupBand, dropsReserve && styles.groupUnlabeled),
        depth,
        heading: unlabeled
          ? null
          : {
            label: headingLabel(node),
            estimate: fitGroupLabel(headingLabel(node), node.count),
            count: node.count,
            nested: depth > 0,
          },
        body: node.children.length > 0
          ? renderNodes(
            node.children,
            depth + 1,
            node.label,
            someChildRowIsHeaded && !shouldShowHeading(node.children)
          )
          : renderLeaf(node.entries),
      };
    });

    return <GroupRow className={styles.groupRow} groups={boxes} />;
  };

  // The ungrouped grid keeps its own scroll; anything else gets one scroll
  // around the whole result, because a scrollbar per heading makes the set
  // impossible to read as one thing.
  if (groups.length === 0 && viewMode === "grid") {
    return (
      <BuildingGrid
        entries={entries}
        onPlace={onPlace}
        footer={footer}
      />
    );
  }

  return (
    <Scrollable
      className={styles.groupScroll}
      vertical
      trackVisibility="scrollable"
    >
      {groups.length === 0 ? renderLeaf(entries) : renderNodes(groups, 0)}
      {footer}
    </Scrollable>
  );
});
