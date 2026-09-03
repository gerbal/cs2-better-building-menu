import { Scrollable } from "cs2/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  searchText: string;
  onPlace: (entry: BuildingCatalogEntry) => void;
  /**
   * Rendered as the last child INSIDE the scroll, below every group.
   *
   * Passed down rather than rendered by the catalog because which element owns
   * the scroll depends on runtime state: the ungrouped grid keeps its own (see
   * the escape hatch below), everything else shares one here. A footer rendered
   * outside would sit below the scroll, which is where the pager used to be and
   * the reason nobody read it.
   */
  footer?: ReactNode;
}

/**
 * A group heading that trims its label to the width it was actually given.
 *
 * The estimate from the tile count paints first, so a long name never flashes
 * across the panel; a measurement then corrects it. If the measurement never
 * lands — a zero-width box, an engine that has not settled — the estimate is
 * what stays, which is exactly the behaviour this replaced.
 *
 * The measurement needs two numbers and takes each from an element that cannot
 * be disturbed by the answer:
 *
 * - `available` from the label's own box, which is `flex: 1 1 auto` precisely
 *   so it fills the leftover space whatever text is in it. With `0 1 auto` the
 *   box shrank to the trimmed text and the next measurement read that as the
 *   space available, trimming again on every pass.
 * - `needed` from a hidden probe holding the FULL string, so the ratio is
 *   always full-text-against-space rather than a measurement of the last
 *   answer.
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

    // WATCH the box instead of guessing when it settles. Measured in game,
    // Cohtml relayouts one frame AFTER the view mode changes: switching grid
    // to cards read 67px on the first frame — the grid's width — and 167px on
    // the second. A single requestAnimationFrame therefore fitted every
    // heading to the view the player had just left, which is why the same view
    // truncated differently depending on where it was reached from.
    //
    // Nothing here can feed back into the size being watched: the box is
    // `flex: 1 1 auto` so its width is the space left over rather than the
    // text in it, and the probe always holds the full label.
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(fit);

      observer.observe(box);
      // The probe too, so a changed label or a font swap re-fits even when the
      // width it has stayed the same.
      observer.observe(probe);
      fit();

      return () => observer.disconnect();
    }

    // No observer: settle for the second frame, which is where the measured
    // relayout landed. Strictly worse — it cannot see a later resize — so it
    // is the fallback rather than the design.
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
 * One group: its heading, and the row's reserved room above it.
 *
 * `.groupHeading` is positioned absolutely — deliberately, so a long name
 * cannot widen the group past its tiles — which also means it cannot push the
 * group's height. The stylesheet used to reserve a flat 17rem, one line, and
 * the group bought the room for a one-line name by being three tiles wide.
 *
 * Now the group is as wide as its tiles and the heading wraps inside it, so
 * the reserve has to follow the heading. The reserve is the ROW's, not this
 * group's: see GroupRow.
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
    // EVERY group in the row, headed or not. Applying it only to headed ones
    // left .groupUnlabeled's padding-top:0 standing, so an unlabeled group's
    // tiles sat a heading's height higher than its labelled neighbour's and
    // the row lost its shared baseline — visible in Fire & Rescue as the
    // Heliport tile hanging below the four beside it. When no group in the row
    // has a heading, nothing measures, reserve stays null, and the stylesheet's
    // 0 is right again.
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
 * A row of sibling groups, all reserving the same height for their headings.
 *
 * The reserve is the TALLEST heading in the row, given to every group in it.
 * Per-group reserves would be tighter and wrong: a two-line name beside a
 * one-line name would start its tiles 12px lower than its neighbour's, and a
 * row of tiles that do not share a baseline reads as a broken grid rather than
 * as a set. The grid's whole argument is that a position can be learned.
 *
 * Measured heights arrive one group at a time, so this holds them by key and
 * takes the maximum. Growing the padding cannot change a heading's wrapping —
 * padding-top does not affect width — so this settles rather than oscillates.
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
 * Headings over a result set, rendered in whichever mode is active.
 *
 * Extracted from the catalog so the zoning view can stop being a separate
 * presentation. Zoning was hand-writing family → density → tiles, which is
 * exactly group-by-family with a density sub-level rendered as a list, so it
 * had its own markup, its own spacing, no view modes and no sort. Mapping a
 * zone onto a catalog entry lets it use this instead and deletes the
 * divergence rather than papering over it.
 *
 * Table is not handled here: it renders its own rows and headers in the
 * catalog, and a grouped table is a later piece of work.
 */
export const GroupedResults = ({
  entries,
  viewMode,
  searchText,
  onPlace,
  footer,
}: GroupedResultsProps) => {
  const { translate } = useLocalization();

  /**
   * The game's word for a heading, where the game has one.
   *
   * Category headings name vanilla categories, so "TransportationRoad" is
   * "Road" in the game's own localized string — and our camel-case splitter
   * only ever arrived at that by coincidence, in English. Everything else keeps
   * the derived label, because nothing owns those names but us.
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
          searchText={searchText}
          onPlace={onPlace}
          variant={viewMode === "cards" ? "cards" : "compact"}
        />
      );
    }

    return <BuildingGrid entries={leaf} searchText={searchText} onPlace={onPlace} standalone={false} />;
  };

  const renderNodes = (
    nodes: GroupNode<BuildingCatalogEntry>[],
    depth: number,
    parentLabel: string | null = null
  ): JSX.Element => {
    // A single group covering everything is a label with nothing to
    // distinguish — a lone SERVICE BUILDINGS heading once the player has
    // already navigated there, or a lone RESIDENTIAL once they have filtered
    // the zone families down to one.
    const showHeadings = shouldShowHeading(nodes);

    // Siblings FLOW rather than stack. A group was a full-width band whatever
    // it held, so Police by development spent four headings and four bands on
    // three, one, one and one asset — most of the panel was heading and empty
    // row. Laid out as a wrapping row each group takes the width it needs, a
    // big one still fills the line, and the small ones share.
    // NO collapsing of one-asset groups. Tried and reverted: it merged three
    // separate Healthcare branches — Hospital, Disease Control Center, Health
    // Research Institute — into one unlabeled block, and took Deathcare's
    // Crematorium heading with it.
    //
    // The rule was "collapse a one-asset group whose heading restates its
    // tile", which compared the heading against the entry's REAL name. What
    // the tile can draw is a different thing: those two render as "Disease
    // Contro…Center" and "Health Resear…titute", so the heading was the only
    // legible full name on screen and removing it as redundant removed the
    // readable copy.
    //
    // Nothing was lost by reverting. The empty row this was all reported for
    // came from .group's min-width and .groupBand's full-line flex, both fixed
    // above; the collapse never contributed to it.
    const boxes = nodes.map((node) => {
      // A group with two or more sub-groups takes the whole row, so its
      // heading sits alone on its line and its children's headings on the
      // next. Flowed beside a leaf group, as a search result did, the two
      // levels of heading and the neighbour's shared two rows of 11px.
      // One sub-group is one hidden heading — the group reads as a leaf
      // and flows like one; banding those too gave a one-tile ROAD
      // SERVICES a whole 84px row to itself.
      const band = node.children.length > 1;
      // No heading, no row reserved for one. Two cases: the only child,
      // whose heading shouldShowHeading already hid while the 17rem it
      // reserved stayed as 12px of nothing under every category; and a
      // nested name that repeats its parent's — the dev tree names a
      // category's base branch after the category, so MEDIUM ROADS
      // carried a "Medium Roads" sub-heading with a second count under
      // the first. The tiles sit under the parent's heading and the
      // labelled siblings keep theirs.
      const unlabeled =
        !showHeadings || (depth > 0 && parentLabel !== null && node.label === parentLabel);

      return {
        key: node.path.join("/"),
        className: classNames(styles.group, band && styles.groupBand, unlabeled && styles.groupUnlabeled),
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
          ? renderNodes(node.children, depth + 1, node.label)
          : renderLeaf(node.entries),
      };
    });

    return <GroupRow className={styles.groupRow} groups={boxes} />;
  };

  // C# stamped every item with its headings for the effective dimension;
  // the tree is read off the page, never derived from the entries.
  const groups = groupTreeFromPaths(entries);

  // The ungrouped grid keeps its own scroll; anything else gets one scroll
  // around the whole result, because a scrollbar per heading makes the set
  // impossible to read as one thing.
  if (groups.length === 0 && viewMode === "grid") {
    return (
      <BuildingGrid
        entries={entries}
        searchText={searchText}
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
};
