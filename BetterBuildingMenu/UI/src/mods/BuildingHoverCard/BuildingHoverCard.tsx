import { useValue } from "cs2/api";
import { Tooltip } from "cs2/ui";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useMemo } from "react";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import { getNumberSeparators } from "domain/buildingLensMetricFormat";
import type { TileTooltipLine } from "domain/buildingTileTooltip";
import { hoverCardLabels, hoverCardTiers, type HoverCardLineContext } from "domain/hoverCardLines";
import { clampAssetDescription, leisureLabel, resolveAssetDescription } from "domain/buildingLensRowDetails";
import { FootprintGlyph } from "mods/BuildingGlyphs/FootprintGlyph";
import { useUnitSystem } from "domain/unitSettings";
import styles from "./buildingHoverCard.module.scss";
import { BuildingLensMilestones$ } from "mods/bindings";

export interface HoverCardContext extends HoverCardLineContext {
  /**
   * The game's own sentence about an asset, resolved per entry. A function on
   * the context rather than a hook in the card, because the card wraps every
   * tile and only one of them is ever pointed at.
   */
  describe: (prefabName: string | null | undefined) => string | null;
}

/**
 * Read the live city state ONCE, in the component that owns the list. There are
 * a dozen bindings here, and a view that subscribed per row would open hundreds
 * of them to render one hover card. The card takes the result as a prop.
 */
const NO_MILESTONE_NAMES: string[] = [];

export const useHoverCardContext = (): HoverCardContext => {
  const { translate } = useLocalization();
  // One subscription per grid, like the milestones below — the whole reason
  // this context exists rather than each card reading its own.
  const unitSystem = useUnitSystem();
  const milestoneNames = useValue(BuildingLensMilestones$) ?? NO_MILESTONE_NAMES;

  // One object until one of these changes, so the rows it is handed to can skip
  // a render; translate holds still until the language changes.
  return useMemo(() => ({
    milestoneNames,
    // Clamped here, not in the resolver: the expanded table row shows the same
    // description where there is room for all of it, and shortening it there
    // would be the card dictating to the table.
    describe: (prefabName) => clampAssetDescription(resolveAssetDescription(prefabName, translate)),
    // Resolved up here for the same reason describe is: translate belongs to
    // the component that holds the localization hook, not to the card.
    leisureName: (leisureType: string | null | undefined) => leisureLabel(leisureType, translate),
    translateFact: translate,
    separators: getNumberSeparators(translate, unitSystem),
    labels: hoverCardLabels(translate),
  }), [translate, unitSystem, milestoneNames]);
};

/**
 * One card body, shared by every view mode, rendered only when the tooltip is
 * shown. Its own component ON PURPOSE: React does not invoke the function until
 * then, so the lines are worked out on hover, not once per tile.
 */
const HoverCardContent = ({
  entry,
  context,
}: {
  entry: BuildingCatalogEntry;
  context: HoverCardContext;
}) => {
  const label = entry.name || entry.prefabName;
  // What the thing IS, before every line that is a number about it — the same
  // sentence vanilla shows on selection.
  const description = context.describe(entry.prefabName);
  const { vanilla: vanillaTier, extra: extraTier } = hoverCardTiers(entry, context);
  const footprints = entry.footprints ?? [];
  const footprintOverflow = entry.footprintOverflow ?? 0;

  const renderLine = (line: TileTooltipLine) => (
    <div
      key={line.key}
      data-line={line.key}
      className={classNames(
        styles.cardLine,
        // A list of values is a stack; pairing it with a neighbour would
        // put a one-line figure beside a three-line block.
        line.values && line.values.length > 0 && styles.cardLineWide,
        line.tone === "warn" && styles.cardWarn,
        line.tone === "good" && styles.cardGood,
      )}
    >
      <span className={styles.cardLabel}>{line.label}</span>
      {line.values
        ? (
          <span className={classNames(styles.cardValue, styles.cardValueList)}>
            {line.values.map((entryValue) => (
              <span key={entryValue} className={styles.cardValueLine}>{entryValue}</span>
            ))}
          </span>
        )
        : <span className={styles.cardValue}>{line.value}</span>}
    </div>
  );

  return (
    <div className={styles.card}>
      <div className={styles.cardName}>{label}</div>
      {description && <div className={styles.cardDescription}>{description}</div>}
      {/* Two across where they fit, so short figures do not each take a whole
          row. Paired by the flow rather than by a column count, so a long line
          still gets a row to itself. */}
      {/* With the game's tier empty, ours IS the card: normal weight, no
          divider, so it does not read as an afterthought. With both empty
          there is no block at all — a frame around nothing promises detail. */}
      {vanillaTier.length === 0
        ? (extraTier.length === 0 ? null : (
          <div className={styles.cardLines}>
            {extraTier.map(renderLine)}
          </div>
        ))
        : (
          <>
            <div className={styles.cardLines}>
              {vanillaTier.map(renderLine)}
            </div>
            {extraTier.length > 0 && (
              <>
                <div className={styles.cardDivider} aria-hidden="true" />
                <div className={classNames(styles.cardLines, styles.cardLinesExtra)} data-tier="extra">
                  {extraTier.map(renderLine)}
                </div>
              </>
            )}
          </>
        )}
      {/* The shapes, narrowest first. A player choosing a zone is matching
          against a block on the map, and a picture of the lot is closer to
          that than "2–4 wide" is. */}
      {footprints.length > 0 && (
        <div className={styles.glyphs}>
          {footprints.map((footprint) => (
            <FootprintGlyph key={`${footprint.width}x${footprint.depth}`} footprint={footprint} />
          ))}
          {footprintOverflow > 0 && <span className={styles.glyphOverflow}>+{footprintOverflow}</span>}
        </div>
      )}
    </div>
  );
};

/**
 * Wraps a tile so hovering it explains the asset. Deliberately does no work of
 * its own: see HoverCardContent.
 */
export const BuildingHoverCard = ({
  entry,
  context,
  children,
}: {
  entry: BuildingCatalogEntry;
  context: HoverCardContext;
  children: JSX.Element;
}) => (
  <Tooltip tooltip={<HoverCardContent entry={entry} context={context} />}>
    {children}
  </Tooltip>
);
