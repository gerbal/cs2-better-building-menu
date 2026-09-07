import { bindValue, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import { useEffect } from "react";
import classNames from "classnames";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import {
  formatBuildingMetric,
  formatCapacity,
  formatLotDimensions,
  getNumberSeparators,
  hasFootprint,
} from "domain/buildingLensMetricFormat";
import { canPlace, entryStateWord, hasVectorThumbnail, isEntryAlreadyBuilt, isEntryLocked, lockedThumbnail } from "domain/buildingLockState";
import { topSearchResult } from "domain/buildingSearchRank";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { FootprintGlyph } from "mods/BuildingGlyphs/FootprintGlyph";
import { BuildingHoverCard, useHoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import type { ZoneFootprint } from "domain/zoningHierarchy";
import { sortedMetricFor, sortedMetricValue } from "domain/sortedMetric";
import type { SortColumn } from "domain/buildingCatalogContracts";
import { useUnitSystem } from "domain/unitSettings";
import mod from "../../../mod.json";
import styles from "./buildingList.module.scss";

const BuildingCatalogSortColumn$ = bindValue<SortColumn>(mod.id, "BuildingCatalogSortColumn", "Name");

/**
 * compact — icon and name only.
 * cards — a larger icon and the two questions asked before every placement:
 * does it fit, and can I afford it.
 */
export type BuildingListVariant = "compact" | "cards";

interface BuildingListProps {
  entries: BuildingCatalogEntry[];
  searchText: string;
  onPlace: (entry: BuildingCatalogEntry) => void;
  variant?: BuildingListVariant;
  /**
   * The entry whose tool is active, if the caller knows it. The extension
   * picker does — vanilla publishes selectedUpgrade — and its rows read back
   * the way vanilla's tiles do. The build menu passes nothing.
   */
  selectedId?: number;
}

/**
 * Compact wrapped rows of fully-readable names.
 *
 * The third mode, and the one the zoning view was already doing by hand. Grid
 * shows a thumbnail with the name truncated — "Canopy-Covered Parkl…" — which
 * is fine when you recognise the building by sight and useless when you are
 * looking for one by name. Table shows every metric but fits about twelve rows
 * on a screen.
 *
 * This shows a small icon and the whole name, several to a row. It is the mode
 * for "there are two hundred of these and I know roughly what it is called",
 * which is the case that arrives with DLC and mods and that the other two
 * modes both handle badly.
 *
 * Two variants. Compact is icon and name only. Cards adds a larger icon and one
 * short line: footprint, cost, and the category's own capacity where that means
 * anything. Those are constraints rather than comparisons — does it fit, can I
 * afford it — which is what keeps this from drifting back into the table.
 */
export const BuildingList = ({ entries, searchText, onPlace, variant = "compact", selectedId }: BuildingListProps) => {
  const { translate } = useLocalization();
  const separators = getNumberSeparators(translate, useUnitSystem());
  // The same card the grid and the table show. This view used to carry its own
  // thinner one — a name and a single "cost · lot" line — so which facts the
  // game would tell you about a building depended on which view mode you
  // happened to be in.
  const hoverCard = useHoverCardContext();
  const sortedMetric = sortedMetricFor(useValue(BuildingCatalogSortColumn$));
  const lockedLabel = translate("Tooltip.LABEL[BetterBuildingMenu.Locked]", "Locked") ?? "Locked";
  // The game's own words first, so the row reads as vanilla's does; see the
  // hover card, which asks for the same key.
  const builtLabel =
    translate("Toolbar.ASSET_ALREADY_BUILT", "")
    || translate("Tooltip.LABEL[BetterBuildingMenu.AlreadyBuilt]", "Already built")
    || "Already built";
  const cards = variant === "cards";
  // The page arrives in the order every view shows — relevance first while a
  // search is active — so the list, the grid and the table agree.
  const ordered = entries;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;

      const top = topSearchResult(ordered, searchText ?? "");
      if (!top) return;

      onPlace(top);
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [ordered, searchText, onPlace]);

  const place = (entry: BuildingCatalogEntry) => {
    // See BuildingGrid: locked assets are shown and refused, not hidden.
    if (!canPlace(entry)) return;

    onPlace(entry);
  };

  /** The figure this list is ordered by. See sortedMetric.ts. */
  const sortedBadge = (entry: BuildingCatalogEntry) => {
    if (sortedMetric === null) {
      return null;
    }

    const text = sortedMetric === "lot"
      ? (hasFootprint(entry.lotWidth, entry.lotDepth)
        ? formatLotDimensions(entry.lotWidth, entry.lotDepth)
        : null)
      : (() => {
        const value = sortedMetricValue(entry, sortedMetric);
        return value === null
          ? null
          : formatBuildingMetric(value, sortedMetric, separators, entry.costIsPerDistance);
      })();

    return text === null ? null : <span className={styles.sortedMetric}>{text}</span>;
  };

  return (
    <div className={styles.list}>
      {ordered.map((entry) => {
        const label = entry.name || entry.prefabName;
        const cost = formatBuildingMetric(entry.constructionCost, "cost", separators, entry.costIsPerDistance);
        const lot = formatLotDimensions(entry.lotWidth, entry.lotDepth);
        // A road's lot is 0x0 and a zone has none at all. "0 × 0" is a
        // measurement of something that does not exist, so the fact is dropped
        // rather than stated.
        const lotKnown = hasFootprint(entry.lotWidth, entry.lotDepth);
        const footprints = entry.footprints ?? [];
        const footprintOverflow = entry.footprintOverflow ?? 0;
        // Category-aware, and it returns nothing for a category where capacity
        // means nothing — so a park bench's card stays as narrow as a
        // hospital's is informative, without a rule per category here.
        const capacity = formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators);
        // Zero is not a capacity fact. An extension that adds no students is
        // common (a school's clinic, its playground); "0 students" beside the
        // wing's 500 reads as a figure and carries nothing.
        const hasCapacity = capacity !== "" && capacity !== "—" && (entry.capacity ?? 0) !== 0;

        return (
          <BuildingHoverCard key={entry.id} entry={entry} context={hoverCard}>
            <Button
              className={classNames(styles.item, cards && styles.itemCard, selectedId === entry.id && styles.itemSelected)}
              variant="icon"
              data-catalog-entry={entry.id}
              data-selected={selectedId === entry.id ? "true" : undefined}
              onSelect={() => place(entry)}
              // Both unplaceable states, not just locked. A row has no
              // thumbnail to silhouette, so the ground and the suffix carry the
              // whole message here — which is why saying nothing about
              // already-built left the row looking freely placeable.
              aria-label={
                (() => {
                  const word = entryStateWord(entry, lockedLabel, builtLabel);
                  return word ? `${label} — ${word}` : label;
                })()
              }
              aria-disabled={!canPlace(entry) ? "true" : undefined}
              data-locked={isEntryLocked(entry) ? "true" : undefined}
              data-vector-thumb={hasVectorThumbnail(entry.thumbnail) ? "true" : "false"}
              data-already-built={isEntryAlreadyBuilt(entry) ? "true" : undefined}
            >
              {/* The picture and its badge share a box, the way the tile's do,
                  so the mark sits ON the building rather than beside it. Sized
                  from base.scss's ratio, so the badge reads the same size
                  against a 20rem row icon as against the grid's 45rem one. */}
              {entry.thumbnail
                ? <span className={classNames(styles.artwork, cards && styles.artworkLarge)}>
                    <img
                      className={classNames(styles.icon, cards && styles.iconLarge)}
                      src={lockedThumbnail(entry, isEntryLocked(entry) || isEntryAlreadyBuilt(entry))}
                      onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
                      alt=""
                      aria-hidden="true"
                    />
                    {entry.isUnique === true && (
                      <img
                        className={classNames(
                          styles.uniqueAsset,
                          cards && styles.uniqueAssetLarge,
                          isEntryAlreadyBuilt(entry) ? styles.alreadyBuilt : styles.uniqueMark
                        )}
                        src={isEntryAlreadyBuilt(entry)
                          ? "Media/Game/Icons/AlreadyBuilt.svg"
                          : "Media/Game/Icons/Unique.svg"}
                        alt=""
                        aria-hidden="true"
                      />
                    )}
                  </span>
                : <span className={classNames(styles.iconPlaceholder, cards && styles.iconLarge)} aria-hidden="true" />}
              <span className={styles.text}>
                <span className={styles.name}>{label}</span>
                {/* A zone's own figures used to have a branch here, reading an
                    `entry.facts` string array nothing ever wrote — so it never
                    ran and the card fell through to this one anyway. They now
                    arrive as service facts and are drawn on the hover card,
                    where there is room for a phrase; this row stays size, cost
                    and one key number. */}
                {cards && (
                  <span className={styles.facts}>
                    {/* Footprint first, and always: it is a constraint rather
                        than a comparison — whether the thing fits the gap you
                        are looking at, which you ask before anything else. */}
                    {/* Separators are characters, not flex gap. Cohtml did not
                        apply the gap here, so "3 × 3" and "8 000" ran together
                        and read as a single number, "3 × 38 000". */}
                    {lotKnown && (
                      <>
                        <span className={styles.fact}>{lot}</span>
                        <span className={styles.factDot} aria-hidden="true">·</span>
                      </>
                    )}
                    <span className={styles.fact}>{cost}</span>
                    {/* Size, cost, one key number — and nothing else. The
                        recreation kind was here and made the row long: "Outdoor
                        recreation" is a phrase where the rest of the line is
                        three figures, and a fact row that has to be READ rather
                        than scanned stops being a fact row. It says the same
                        thing on the hover card, where there is room for it. */}
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
                  the order can be read down the page — which is the one thing
                  the table had and this view did not. */}
              {sortedBadge(entry)}
            </Button>
          </BuildingHoverCard>
        );
      })}
    </div>
  );
};
