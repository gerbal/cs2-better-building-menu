import { useValue } from "cs2/api";
import { FOCUS_DISABLED } from "cs2/input";
import { useLocalization } from "cs2/l10n";
import { Button, Tooltip } from "cs2/ui";
import classNames from "classnames";
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

import { getNumberSeparators, groupDigits } from "domain/assetMenuMetricFormat";
import { setReadoutSaid } from "domain/assetMenuViewStore";
import { listForm } from "domain/bodyGeometry";
import { hoverCardLabels } from "domain/hoverCardLines";
import { LEGEND_FORMS, legendParts, NOTHING_SAID, shownKinds, statedValues, type LegendForm, type LegendPart, type LegendWords } from "domain/saidOnce";
import { sortedMetricFor } from "domain/sortedMetric";
import { useTextScale } from "domain/textScaleSetting";
import { NO_TIER_BRACKET } from "domain/menuProgression";
import { setCollapsedCommand } from "domain/boxEdges";
import { arrivedCount, cellsOf, cssUrl, planTabRow, readoutRange, readoutRoom, tabForm, tabRow, type TabCell, type TabForm } from "domain/tabRow";
import type { VanillaMenuCategory } from "domain/vanillaMenuCategories";
import { ALL_CATEGORIES_KEYS, resolveVanillaLabel, vanillaCategoryNameKeys } from "domain/vanillaServiceLabels";
import {
  AssetMenu$,
  AssetMenuAllCount$,
  AssetMenuAtLargeText$,
  AssetMenuCategories$,
  AssetMenuCategory$,
  AssetMenuCategoryCounts$,
  AssetMenuCollapsed$,
  AssetMenuExpandedCategories$,
  AssetMenus$,
  AssetMenuSchoolTier$,
  AssetMenuStripTab$,
  AssetMenuStripTabs$,
  AssetMenuTierBracket$,
  AssetMenuTuning$,
  BuildingCatalog$,
  BuildingCatalogSortColumn$,
  CurrentSearch$,
  send,
} from "mods/bindings";
import { UNIT_GLYPHS } from "mods/Bodies/unitGlyphs";
import { useUnitMarks } from "mods/Bodies/useBodyWords";
import { useStatusLine } from "mods/HoverCard/HoverCard";
import { useAssetMenuView } from "mods/useAssetMenuView";
import { useMenuBody } from "mods/useMenuBody";
import styles from "./tabRow.module.scss";
import { drawnAt, useDrawnReadout, type DrawnReadout } from "./useDrawnReadout";

/**
 * A picture in a cell's icon slot, drawn as a background, whole at its own aspect: Cohtml has no
 * object-fit and reports no picture's natural size, and a mod's picture need not be square.
 */
const TabIcon = ({ src, plate, inline, onFail }: { src: string; plate: boolean; inline: boolean; onFail: (src: string) => void }) => {
  // A background says nothing when its picture fails, so a picture of BBM's own finds out.
  useEffect(() => {
    if (typeof Image !== "function") return undefined;
    const probe = new Image();
    probe.onerror = () => onFail(src);
    probe.src = src;
    return () => {
      probe.onerror = null;
    };
  }, [src, onFail]);

  return (
    <span className={classNames(styles.iconSlot, inline && styles.iconInline)}>
      <span className={classNames(styles.picture, plate && styles.plate)} style={{ backgroundImage: cssUrl(src) }} />
    </span>
  );
};

const NONE_FAILED: ReadonlySet<string> = new Set();

/** The legend's words: BBM's own two, and the hover card's names for each kind and for jobs. */
function legendWords(translate: (id: string, fallback?: string | null) => string | null): LegendWords {
  const labels = hoverCardLabels(translate);

  return {
    unlessShown: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutUnlessShown]", "{0} unless shown") ?? "{0} unless shown",
    others: translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutOthers]", "others {0}") ?? "others {0}",
    workersUnit: labels.workersUnit,
    kinds: { speed: labels.speed, capacity: labels.capacity, workers: labels.workers, lot: labels.lot },
  };
}

export interface TabRowProps {
  /** The box's width as drawn, in rem. */
  width: number;
  /** While an edge of the box is dragged, what the readout says of it; null otherwise. */
  edgeReadout?: string | null;
}

/**
 * The menu's tabs along the box's bottom edge, under the list: All, then the game's tabs with their
 * branches or levels, each with its count, on one line. Memoised, so a height's echo during a drag plans
 * nothing again. See docs/design-notes.md, "The tab row".
 */
export const TabRow = memo(function TabRow({ width, edgeReadout = null }: TabRowProps) {
  const { translate } = useLocalization();
  const page = useValue(BuildingCatalog$);
  // During a load the index has counted nothing yet: no count has arrived, nor the total.
  const indexing = page?.status === "indexing";
  const textScale = useTextScale();
  const menu = useValue(AssetMenu$) ?? "";
  const menus = useValue(AssetMenus$) ?? [];
  const categories = useValue(AssetMenuCategories$) ?? [];
  const counts = useValue(AssetMenuCategoryCounts$) ?? [];
  // Negative until C# sends the counts, which the row draws blank.
  const sentAllCount = useValue(AssetMenuAllCount$);
  const allCount = indexing ? null : arrivedCount(sentAllCount);
  const selectedCategory = useValue(AssetMenuCategory$) ?? "";
  const expanded = useValue(AssetMenuExpandedCategories$) ?? [];
  const stripTabs = useValue(AssetMenuStripTabs$) ?? [];
  // A list on the wire; only a strip tab's pick writes it, one tab at a time.
  const selectedStripTabs = useValue(AssetMenuStripTab$) ?? [];
  const bracket = useValue(AssetMenuTierBracket$) ?? NO_TIER_BRACKET;
  const selectedTier = useValue(AssetMenuSchoolTier$) ?? -1;
  const searching = (useValue(CurrentSearch$) ?? "").trim() !== "";
  const collapsed = useValue(AssetMenuCollapsed$);
  // On unless C# says Never: the binding's fallback is the shipped value.
  const namesAllowed = useValue(AssetMenuTuning$)?.tabNames !== false;
  const separators = useMemo(() => getNumberSeparators(translate), [translate]);
  const words = useMemo(() => legendWords(translate), [translate]);
  const body = useMenuBody().drawn;
  const atLargeText = useValue(AssetMenuAtLargeText$);
  // The form the list draws, a small menu's grown plate among them; before it draws, its text scale's.
  const drawnForm = useAssetMenuView((view) => view.drawnForm);
  const sortedMetric = sortedMetricFor(useValue(BuildingCatalogSortColumn$));
  // A picture that would not load, which the row then draws as the next in the chain.
  const [failedIcons, setFailedIcons] = useState(NONE_FAILED);
  const fail = useCallback((src: string) => setFailedIcons((failed) => (failed.has(src) ? failed : new Set(failed).add(src))), []);

  // A category's own prefab name is its id, and the game ships its string under it.
  const categoryLabel = (category: VanillaMenuCategory) =>
    resolveVanillaLabel(vanillaCategoryNameKeys(category.id), (key) => translate(key, null), category.name);
  const row = tabRow({
    menu,
    menuIcon: menus.find((entry) => entry.id === menu)?.icon ?? "",
    allLabel: resolveVanillaLabel(ALL_CATEGORIES_KEYS, (key) => translate(key, null), "All"),
    allCount,
    categories,
    counts,
    selectedCategory,
    expanded,
    stripTabs,
    selectedStripTabs,
    bracket,
    selectedTier,
    categoryLabel,
    indexing,
    failedIcons,
  });

  const format = (count: number) => groupDigits(count, separators);
  // The window the list holds, with the true total, so a list that stops is never silent.
  const range = indexing ? "" : readoutRange(
    page?.items?.length ?? 0,
    page?.totalCount ?? 0,
    translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutRange]", "1–{0} of {1}") ?? "1–{0} of {1}",
    format
  );
  const place = searching && allCount !== null
    ? (translate("Tooltip.LABEL[BetterBuildingMenu.ReadoutHere]", "{0} here") ?? "{0} here").replace("{0}", format(allCount))
    : row.place;
  // The values said once, of the kinds the body shows, in each of the legend's forms; with none said,
  // the key kind named. See docs/design-notes.md, "Numbers said once".
  const facts = page?.facts;
  const keyKind = facts?.keyKind ?? "";
  const bodyForm = drawnForm ?? listForm(textScale, atLargeText);
  const shown = useMemo(() => shownKinds(body, bodyForm, sortedMetric, keyKind), [body, bodyForm, sortedMetric, keyKind]);
  const stated = useMemo(() => (facts === undefined || indexing ? NOTHING_SAID : statedValues(facts, shown)), [facts, indexing, shown]);
  const items = page?.items;
  // Standard says a unit by its glyph; Plates writes it after each value, as its rows do.
  const marks = useUnitMarks();
  const legends = useMemo(
    () => LEGEND_FORMS.reduce<Partial<Record<LegendForm, LegendPart[]>>>(
      (all, legendForm) => ({ ...all, [legendForm]: legendParts(stated, keyKind, shown, items ?? [], separators, words, legendForm, marks) }),
      {}
    ),
    [stated, keyKind, shown, items, separators, words, marks]
  );
  // Named above the first step where every tab fits so. See docs/design-notes.md, "The tab row".
  const form = tabForm(row.items, { place, range, legends }, width, textScale, format, namesAllowed);
  const plan = planTabRow(row.items, { place, range, legends }, width, textScale, format, form);
  // While an edge is dragged the readout says what the release does, in the range's place: the tabs keep their form
  // and a long line clips the last of them, as a long range does, while the rows keep what the readout said.
  const shownPlan = edgeReadout === null ? plan : planTabRow(row.items, { place: "", range: edgeReadout }, width, textScale, format, form);
  const legend = legends[plan.legend] ?? [];
  // Status line only: the building pointed at, in the readout's room. The rows keep the blanks the legend
  // said, and the legend comes back when the pointer leaves. See docs/design-notes.md, "The hover card".
  // Its room and texts as the game drew them, once it has: the estimates err wide, and would drop a figure
  // the room holds.
  const [readoutRead, setReadoutRead] = useState<DrawnReadout | null>(null);
  // Read for this row, its tabs and their counts in the form they draw: a reading of another menu's row
  // says nothing of this one's room.
  const readAt = `${textScale}\u0001${width}\u0001${form}\u0001${cellsOf(row.items).map((cell) => `${cell.key}\u0002${cell.count ?? ""}`).join("\u0003")}`;
  const drawnReadout = drawnAt(readoutRead, readAt);
  const status = useStatusLine(() => drawnReadout?.room ?? readoutRoom(row.items, width, textScale, format, form), keyKind, drawnReadout?.drawn);
  const readoutRefs = useDrawnReadout(status, readAt, setReadoutRead);
  // The rows leave blank only what the readout says: a legend short of room says nothing, and they print it.
  // Before the paint, so the rows' blanks and the legend change on the same frame.
  const said = plan.legend === "none" ? NOTHING_SAID : stated;
  useLayoutEffect(() => setReadoutSaid(said), [said]);
  useLayoutEffect(() => () => setReadoutSaid(NOTHING_SAID), []);

  const select = (cell: TabCell) => {
    // A tab, All among them, opens a collapsed box: the list it picks is what the player wants to see.
    if (collapsed) send(setCollapsedCommand(false));
    if (cell.kind === "branch") send({ method: "SetAssetMenuStripTab", args: [cell.id] });
    else if (cell.kind === "tier") send({ method: "SetAssetMenuSchoolTier", args: [Number(cell.id)] });
    // All sends the empty category, which clears every narrowing.
    else send({ method: "SetAssetMenuCategory", args: [cell.id] });
  };

  const renderCell = (cell: TabCell, cellForm: TabForm) => {
    const count = cell.count === null ? "" : format(cell.count);
    const label = cell.count === null ? cell.label : `${cell.label} · ${count}`;
    const worded = cell.named || cell.kind === "tier";
    // A picture cell in the named form: its picture, its name and its count in a line.
    const named = !worded && cellForm === "named";

    return (
      <Tooltip key={cell.key} tooltip={label}>
        <Button
          className={classNames(styles.cell, (worded || named) && styles.inline, cell.lit && styles.lit, cell.empty && styles.empty, searching && styles.matches)}
          variant="icon"
          focusKey={FOCUS_DISABLED}
          aria-label={label}
          aria-current={cell.lit ? "true" : undefined}
          onSelect={() => select(cell)}
        >
          {worded ? <span className={styles.name}>{cell.label}</span> : <TabIcon src={cell.icon} plate={cell.kind === "all"} inline={named} onFail={fail} />}
          {named && <span className={styles.name}>{cell.label}</span>}
          <span className={styles.count}>{count}</span>
        </Button>
      </Tooltip>
    );
  };

  return (
    <div className={styles.band}>
      <div ref={readoutRefs.row} className={styles.tabRow} data-clipped={shownPlan.clipped ? "true" : undefined} data-tab-form={form}>
        <div ref={readoutRefs.cells} className={styles.cells}>
          {row.items.map((item) =>
            item.kind === "bracket"
              // Education's plate keeps its own form.
              ? <div key={item.key} className={styles.segment}>{[item.parent, ...item.tiers].map((cell) => renderCell(cell, "stack"))}</div>
              : renderCell(item, form)
          )}
        </div>
        <div className={styles.spacer} />
        {edgeReadout !== null ? (
          <div className={styles.readout} data-readout="edge">
            <span className={styles.line}>
              <span className={styles.range}>{edgeReadout}</span>
            </span>
          </div>
        ) : status !== null ? (
          <div className={styles.readout} data-readout="status">
            {/* Two lines at 100% text, the name over the figures; above it one, the name then its figures. */}
            {!status.oneLine && <span className={styles.statusName}>{status.name}</span>}
            <span className={styles.line}>
              {status.oneLine && <span className={styles.statusName}>{status.name}</span>}
              {status.parts.map((part, index) => (
                <Fragment key={index}>
                  {(index > 0 || status.oneLine) && <span className={styles.sep}>·</span>}
                  <span className={styles.statusFigure}>{part}</span>
                </Fragment>
              ))}
            </span>
          </div>
        ) : (
          <div className={styles.readout} data-readout={plan.readout}>
            {plan.readout === "full" && <span className={styles.place}>{place}</span>}
            {/* The legend, then the range: each part in a box of its own, the glyph its sibling, "·" after it. */}
            <span className={styles.line}>
              {legend.map((part, index) => (
                <Fragment key={index}>
                  <span className={styles.said}>
                    {part.glyph !== null && (
                      <img className={styles.saidGlyph} style={{ maskImage: `url(${UNIT_GLYPHS[part.glyph]})` }} alt="" aria-hidden="true" />
                    )}
                    <span className={styles.saidText}>{part.text}</span>
                  </span>
                  <span className={styles.sep}>·</span>
                </Fragment>
              ))}
              <span className={styles.range}>{range}</span>
            </span>
          </div>
        )}
      </div>
      {/* What Status line only could say, drawn unseen in the readout's faces, out of the row's flow: the
          readout says what fits as the game draws it. */}
      {status !== null && (
        <span ref={readoutRefs.measure} className={styles.statusMeasure} aria-hidden="true">
          <span className={styles.statusName}>{status.name}</span>
          <span className={styles.sep}>·</span>
          {status.figures.map((figure, index) => <span key={index} className={styles.statusFigure}>{figure}</span>)}
        </span>
      )}
    </div>
  );
});
