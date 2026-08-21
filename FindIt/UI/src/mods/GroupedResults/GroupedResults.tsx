import { bindValue, useValue } from "cs2/api";
import { Scrollable } from "cs2/ui";
import { type ReactNode } from "react";
import classNames from "classnames";
import mod from "../../../mod.json";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import {
  buildGroupedView,
  fitGroupLabel,
  shouldShowHeading,
  type GroupDimensionId,
  type GroupNode,
} from "domain/buildingGroups";
import { resolveVanillaLabel, vanillaCategoryNameKeys } from "domain/vanillaServiceLabels";
import { useLocalization } from "cs2/l10n";
import { BuildingGrid } from "mods/BuildingGrid/BuildingGrid";
import { BuildingList } from "mods/BuildingList/BuildingList";
import styles from "./groupedResults.module.scss";

/** Grid recognises, List scans, Cards weighs, Table compares. */
// The progression dimension names its headings out of this dense table; every
// other dimension ignores it.
const BuildingLensMilestones$ = bindValue<string[]>(mod.id, "BuildingLensMilestones", []);

export type CatalogViewMode = "grid" | "list" | "cards" | "table";

interface GroupedResultsProps {
  entries: BuildingCatalogEntry[];
  groupBy: GroupDimensionId;
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
  groupBy,
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

  const renderNodes = (nodes: GroupNode<BuildingCatalogEntry>[], depth: number): JSX.Element => {
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
    return (
      <div className={styles.groupRow}>
        {nodes.map((node) => (
      <div className={styles.group} key={node.path.join("/")} data-group-depth={depth}>
        {showHeadings && (
          <div className={classNames(styles.groupHeading, depth > 0 && styles.groupHeadingNested)}>
            <span className={styles.groupLabel} title={headingLabel(node)}>
              {fitGroupLabel(headingLabel(node), node.count)}
            </span>
            <span className={styles.groupCount}>{node.count}</span>
          </div>
        )}
        {node.children.length > 0 ? renderNodes(node.children, depth + 1) : renderLeaf(node.entries)}
      </div>
        ))}
      </div>
    );
  };

  // The progression dimension names its headings out of this table; every
  // other dimension ignores it.
  const milestoneNames = useValue(BuildingLensMilestones$) ?? [];
  const groups = buildGroupedView(entries, groupBy, milestoneNames);

  // The ungrouped grid keeps its own scroll and its shelf; anything else gets
  // one scroll around the whole result, because a scrollbar per heading makes
  // the set impossible to read as one thing.
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
