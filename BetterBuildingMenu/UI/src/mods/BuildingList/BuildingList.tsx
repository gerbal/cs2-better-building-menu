import { bindValue, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
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
  const { translate } = useLocalization();
  const separators = getNumberSeparators(translate, useUnitSystem());
  // The same card the grid and the table show, so which facts a building
  // states does not depend on which view mode the player is in.
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
  // search is active — so list, grid and table agree.
  const ordered = entries;

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
        // A road's lot is 0x0 and a zone has none: "0 × 0" measures something
        // that does not exist, so the fact is dropped rather than stated.
        const lotKnown = hasFootprint(entry.lotWidth, entry.lotDepth);
        const footprints = entry.footprints ?? [];
        const footprintOverflow = entry.footprintOverflow ?? 0;
        // Category-aware, returning nothing where capacity means nothing, so
        // this needs no rule per category of its own.
        const capacity = formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators);
        // Zero is not a capacity fact: an upgrade that adds no students is
        // common, and "0 students" reads as a figure while carrying nothing.
        const hasCapacity = capacity !== "" && capacity !== "—" && (entry.capacity ?? 0) !== 0;

        return (
          <BuildingHoverCard key={entry.id} entry={entry} context={hoverCard}>
            <Button
              className={classNames(styles.item, cards && styles.itemCard, selectedId === entry.id && styles.itemSelected)}
              variant="icon"
              data-catalog-entry={entry.id}
              data-selected={selectedId === entry.id ? "true" : undefined}
              onSelect={() => place(entry)}
              // Both unplaceable states, not just locked: a row has no
              // thumbnail to silhouette, so the ground and this suffix carry
              // the whole message.
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
              {/* The picture and its badge share a box, as the tile's do, so
                  the mark sits ON the building. Sized from base.scss's ratio,
                  so it reads the same against a row icon and a grid tile. */}
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
              {sortedBadge(entry)}
            </Button>
          </BuildingHoverCard>
        );
      })}
    </div>
  );
};
