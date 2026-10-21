import { useValue } from "mods/panelValue";
import { Button } from "cs2/ui";
import classNames from "classnames";
import { memo } from "react";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import {
  formatBuildingMetric,
  formatCapacity,
  formatLotDimensions,
  hasFootprint,
} from "domain/assetMenuMetricFormat";
import { entryLabel, entryStateAttributes, sortedBadgeText } from "domain/buildingEntryView";
import { canPlace, entryStateWord } from "domain/buildingLockState";
import { listLabel } from "domain/tileLabel";
import { BuildingHoverCard, useHoverCardContext, type HoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import { entryThumbnail, uniqueBadge, type UniqueBadgeClasses } from "mods/entryArtwork";
import { useGuardedPlace } from "mods/useGuardedPlace";
import { sortedMetricFor } from "domain/sortedMetric";
import styles from "./buildingList.module.scss";
import { BuildingCatalogSortColumn$ } from "mods/bindings";

const UNIQUE_BADGE: UniqueBadgeClasses = { badge: styles.uniqueAsset, unique: styles.uniqueMark, alreadyBuilt: styles.alreadyBuilt };
// A card's larger picture takes a larger badge, at the same ratio.
const UNIQUE_BADGE_LARGE: UniqueBadgeClasses = { ...UNIQUE_BADGE, badge: classNames(styles.uniqueAsset, styles.uniqueAssetLarge) };

/**
 * compact — icon and name only.
 * cards — a larger icon and the two questions asked before every placement:
 * does it fit, and can I afford it.
 */
export type BuildingListVariant = "compact" | "cards";

interface BuildingListProps {
  entries: BuildingCatalogEntry[];
  onPlace: (entry: BuildingCatalogEntry) => void;
  variant?: BuildingListVariant;
  /**
   * The entry whose tool is active, where the caller knows it — the extension
   * menu does, from vanilla's own selectedUpgrade. The build menu passes none.
   */
  selectedId?: number;
}

/**
 * Compact wrapped rows of fully-readable names — the mode for knowing roughly
 * what a building is called among hundreds. Cards adds one line of constraints
 * (does it fit, can I afford it), never comparisons.
 */
export const BuildingList = ({ entries, onPlace, variant = "compact", selectedId }: BuildingListProps) => {
  // The same card the grid and the table show, so which facts a building
  // states does not depend on which view mode the player is in. The rows take
  // its separators and state words too, the game's own words where it has them.
  const hoverCard = useHoverCardContext();
  const sortedMetric = sortedMetricFor(useValue(BuildingCatalogSortColumn$));
  const cards = variant === "cards";

  // Locked assets are shown and refused, not hidden.
  const place = useGuardedPlace(onPlace);

  return (
    <div className={styles.list}>
      {/* In page order, which every view shares; nothing is re-ranked here. */}
      {entries.map((entry) => (
        <BuildingListCard
          key={entry.id}
          entry={entry}
          cards={cards}
          selected={selectedId === entry.id}
          sortedMetric={sortedMetric}
          hoverCard={hoverCard}
          onPlace={place}
        />
      ))}
    </div>
  );
};

interface BuildingListCardProps {
  entry: BuildingCatalogEntry;
  cards: boolean;
  selected: boolean;
  sortedMetric: ReturnType<typeof sortedMetricFor>;
  /** The hover card's context, whose separators and state words the row draws with too. */
  hoverCard: HoverCardContext;
  onPlace: (entry: BuildingCatalogEntry) => void;
}

/**
 * One row or card. Memoised: an entry keeps its object while its content is the
 * same (see stableEntries), so growing the window draws only the new cards.
 */
const BuildingListCard = memo(function BuildingListCard({
  entry,
  cards,
  selected,
  sortedMetric,
  hoverCard,
  onPlace,
}: BuildingListCardProps) {
  const { separators } = hoverCard;
  const sortedText = sortedBadgeText(entry, sortedMetric, separators);
  const fullName = entryLabel(entry);
  const label = listLabel(fullName);
  const stateWord = entryStateWord(entry, hoverCard.labels.lockedValue, hoverCard.labels.alreadyBuilt);
  const cost = formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance);
  const lot = formatLotDimensions(entry.lotWidth, entry.lotDepth);
  // A road's lot is 0x0 and a zone has none: "0 × 0" measures something
  // that does not exist, so the fact is dropped rather than stated.
  const lotKnown = hasFootprint(entry.lotWidth, entry.lotDepth);
  // Category-aware, returning nothing where capacity means nothing, so
  // this needs no rule per category of its own.
  const capacity = formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators);
  // Zero is not a capacity fact: an upgrade that adds no students is
  // common, and "0 students" reads as a figure while carrying nothing.
  const hasCapacity = capacity !== "" && capacity !== "—" && (entry.capacity ?? 0) !== 0;

  return (
    <BuildingHoverCard entry={entry} context={hoverCard}>
      <Button
        className={classNames(styles.item, cards && styles.itemCard, selected && styles.itemSelected)}
        variant="icon"
        data-catalog-entry={entry.id}
        data-selected={selected ? "true" : undefined}
        onSelect={() => onPlace(entry)}
        // Both unplaceable states, not just locked: a row has no
        // thumbnail to silhouette, so the ground and this suffix carry
        // the whole message.
        aria-label={stateWord ? `${fullName} — ${stateWord}` : fullName}
        aria-disabled={!canPlace(entry) ? "true" : undefined}
        {...entryStateAttributes(entry)}
      >
        {/* The picture and its badge share a box, as the tile's do, so
            the mark sits ON the building. Sized from base.scss's ratio,
            so it reads the same against a row icon and a grid tile. */}
        {entry.thumbnail
          ? <span className={classNames(styles.artwork, cards && styles.artworkLarge)}>
              {entryThumbnail(entry, classNames(styles.icon, cards && styles.iconLarge))}
              {uniqueBadge(entry, cards ? UNIQUE_BADGE_LARGE : UNIQUE_BADGE)}
            </span>
          : <span className={classNames(styles.iconPlaceholder, cards && styles.iconLarge)} aria-hidden="true" />}
        <span className={styles.text}>
          <span className={styles.name}>{label}</span>
          {/* A zone's own figures arrive as service facts and are drawn
              on the hover card, where there is room for a phrase. This
              row stays size, cost and one key number. */}
          {cards && (
            <span className={styles.facts}>
              {/* Footprint first, and always: whether the thing fits the
                  gap in front of you is asked before anything else. */}
              {/* Separators are characters, not spacing: the dot is
                  punctuation between figures, and two figures with only
                  space between them read as one number. */}
              {lotKnown && (
                <>
                  <span className={styles.fact}>{lot}</span>
                  <span className={styles.factDot} aria-hidden="true">·</span>
                </>
              )}
              <span className={styles.fact}>{cost}</span>
              {/* Size, cost, one key number — and nothing else. A phrase
                  among three figures turns a row that is scanned into one
                  that has to be read. The hover card has room for it. */}
              {hasCapacity && (
                <>
                  <span className={styles.factDot} aria-hidden="true">·</span>
                  <span className={styles.fact}>{capacity}</span>
                </>
              )}
            </span>
          )}
        </span>
        {/* Right-aligned, so the sorted figures line up as a column and
            the order can be read down the page. */}
        {sortedText !== null && <span className={styles.sortedMetric}>{sortedText}</span>}
      </Button>
    </BuildingHoverCard>
  );
});
