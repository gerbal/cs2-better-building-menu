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
  groupDigits,
  hasFootprint,
} from "domain/buildingLensMetricFormat";
import { getCostForecast } from "domain/buildingForecast";
import { recordPlacement } from "domain/buildingShelf";
import { canPlace, isEntryLocked } from "domain/buildingLockState";
import { rankBuildingMatches, topSearchResult } from "domain/buildingSearchRank";
import { thumbnailErrorHandler } from "domain/thumbnailFallback";
import { FootprintGlyph } from "mods/ZoningHierarchy/FootprintGlyph";
import { BuildingHoverCard, useHoverCardContext } from "mods/BuildingHoverCard/BuildingHoverCard";
import type { ZoneFootprint } from "domain/zoningHierarchy";
import styles from "./buildingList.module.scss";

// Same source the grid's hover card uses, so "can I afford it" is answered the
// same way wherever it is asked.
const Money$ = bindValue<number>("toolbarBottom", "money", 0);

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
export const BuildingList = ({ entries, searchText, onPlace, variant = "compact" }: BuildingListProps) => {
  const { translate } = useLocalization();
  const separators = getNumberSeparators(translate);
  const money = useValue(Money$);
  // The same card the grid and the table show. This view used to carry its own
  // thinner one — a name and a single "cost · lot" line — so which facts the
  // game would tell you about a building depended on which view mode you
  // happened to be in.
  const hoverCard = useHoverCardContext();
  const lockedLabel = translate("Tooltip.LABEL[FindItBuildingMenu.Locked]", "Locked") ?? "Locked";
  const cards = variant === "cards";
  // Search relevance still applies within whatever order the query returned,
  // so typing narrows to the best match the same way it does in the grid.
  const ordered = rankBuildingMatches(entries, searchText ?? "");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;

      const top = topSearchResult(ordered, searchText ?? "");
      if (!top) return;

      recordPlacement(top.id);
      onPlace(top);
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [ordered, searchText, onPlace]);

  const place = (entry: BuildingCatalogEntry) => {
    // See BuildingGrid: locked assets are shown and refused, not hidden.
    if (!canPlace(entry)) return;

    recordPlacement(entry.id);
    onPlace(entry);
  };

  return (
    <div className={styles.list}>
      {ordered.map((entry) => {
        const label = entry.name || entry.prefabName;
        const cost = formatBuildingMetric(entry.constructionCost, "cost", separators);
        const lot = formatLotDimensions(entry.lotWidth, entry.lotDepth);
        // A road's lot is 0x0 and a zone has none at all. "0 × 0" is a
        // measurement of something that does not exist, so the fact is dropped
        // rather than stated.
        const lotKnown = hasFootprint(entry.lotWidth, entry.lotDepth);
        const facts = (entry as unknown as { facts?: string[] }).facts ?? [];
        const footprints = (entry as unknown as { footprints?: ZoneFootprint[] }).footprints ?? [];
        const footprintOverflow = (entry as unknown as { footprintOverflow?: number }).footprintOverflow ?? 0;
        // Category-aware, and it returns nothing for a category where capacity
        // means nothing — so a park bench's card stays as narrow as a
        // hospital's is informative, without a rule per category here.
        const capacity = formatCapacity(entry.capacity, entry.category, entry.subCategory, entry.buildingType, separators);
        const hasCapacity = capacity !== "" && capacity !== "—";
        const forecast = getCostForecast(entry.constructionCost, money);

        return (
          <BuildingHoverCard key={entry.id} entry={entry} context={hoverCard}>
            <Button
              className={classNames(styles.item, cards && styles.itemCard)}
              variant="icon"
              onSelect={() => place(entry)}
              aria-label={isEntryLocked(entry) ? `${label} — ${lockedLabel}` : label}
              aria-disabled={isEntryLocked(entry) ? "true" : undefined}
              data-locked={isEntryLocked(entry) ? "true" : undefined}
            >
              {entry.thumbnail
                ? <img
                    className={classNames(styles.icon, cards && styles.iconLarge)}
                    src={entry.thumbnail}
                    onError={thumbnailErrorHandler(entry.fallbackThumbnail)}
                    alt=""
                    aria-hidden="true"
                  />
                : <span className={classNames(styles.iconPlaceholder, cards && styles.iconLarge)} aria-hidden="true" />}
              <span className={styles.text}>
                <span className={styles.name}>{label}</span>
                {cards && facts.length > 0 && (
                  <span className={styles.facts}>
                    {/* A zone carries its own facts: the game measures how tall
                        it grows and what it trades in, and shows neither. */}
                    {facts.map((fact, index) => (
                      <span key={fact}>
                        {index > 0 && <span className={styles.factDot} aria-hidden="true">·</span>}
                        <span className={styles.fact}>{fact}</span>
                      </span>
                    ))}
                  </span>
                )}
                {cards && facts.length === 0 && (
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
                    <span
                      className={classNames(
                        styles.fact,
                        forecast && !forecast.affordable && styles.factUnaffordable
                      )}
                    >
                      {forecast && forecast.treasury !== null ? groupDigits(forecast.cost, separators) : cost}
                    </span>
                    {hasCapacity && (
                      <>
                        <span className={styles.factDot} aria-hidden="true">·</span>
                        <span className={styles.fact}>{capacity}</span>
                      </>
                    )}
                  </span>
                )}
              </span>
            </Button>
          </BuildingHoverCard>
        );
      })}
    </div>
  );
};
