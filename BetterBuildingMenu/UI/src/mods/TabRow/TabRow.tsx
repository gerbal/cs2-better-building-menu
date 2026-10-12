import { useValue } from "cs2/api";
import { FOCUS_DISABLED } from "cs2/input";
import { useLocalization } from "cs2/l10n";
import { Button, Tooltip } from "cs2/ui";
import classNames from "classnames";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getNumberSeparators, groupDigits } from "domain/assetMenuMetricFormat";
import { useTextScale } from "domain/textScaleSetting";
import { NO_TIER_BRACKET } from "domain/menuProgression";
import { arrivedCount, cssUrl, planTabRow, readoutRange, tabRow, type TabCell } from "domain/tabRow";
import type { VanillaMenuCategory } from "domain/vanillaMenuCategories";
import { ALL_CATEGORIES_KEYS, resolveVanillaLabel, vanillaCategoryNameKeys } from "domain/vanillaServiceLabels";
import {
  AssetMenu$,
  AssetMenuAllCount$,
  AssetMenuCategories$,
  AssetMenuCategory$,
  AssetMenuCategoryCounts$,
  AssetMenuExpandedCategories$,
  AssetMenus$,
  AssetMenuSchoolTier$,
  AssetMenuStripTab$,
  AssetMenuStripTabs$,
  AssetMenuTierBracket$,
  BuildingCatalog$,
  CurrentSearch$,
  send,
} from "mods/bindings";
import styles from "./tabRow.module.scss";

/**
 * A picture in a cell's icon slot, drawn as a background, whole at its own aspect: Cohtml has no
 * object-fit and reports no picture's natural size, and a mod's picture need not be square.
 */
const TabIcon = ({ src, plate, onFail }: { src: string; plate: boolean; onFail: (src: string) => void }) => {
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
    <span className={styles.iconSlot}>
      <span className={classNames(styles.picture, plate && styles.plate)} style={{ backgroundImage: cssUrl(src) }} />
    </span>
  );
};

const NONE_FAILED: ReadonlySet<string> = new Set();

/**
 * The menu's tabs along the box's bottom edge, under the list: All, then the game's tabs with their
 * branches or levels, each with its count, on one line. See docs/design-notes.md, "The tab row".
 */
export const TabRow = ({ width }: { width: number }) => {
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
  const separators = useMemo(() => getNumberSeparators(translate), [translate]);
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
  const plan = planTabRow(row.items, { place, range }, width, textScale, format);

  const select = (cell: TabCell) => {
    if (cell.kind === "branch") send({ method: "SetAssetMenuStripTab", args: [cell.id] });
    else if (cell.kind === "tier") send({ method: "SetAssetMenuSchoolTier", args: [Number(cell.id)] });
    // All sends the empty category, which clears every narrowing.
    else send({ method: "SetAssetMenuCategory", args: [cell.id] });
  };

  const renderCell = (cell: TabCell) => {
    const count = cell.count === null ? "" : format(cell.count);
    const label = cell.count === null ? cell.label : `${cell.label} · ${count}`;
    const worded = cell.named || cell.kind === "tier";

    return (
      <Tooltip key={cell.key} tooltip={label}>
        <Button
          className={classNames(styles.cell, worded && styles.inline, cell.lit && styles.lit, cell.empty && styles.empty, searching && styles.matches)}
          variant="icon"
          focusKey={FOCUS_DISABLED}
          aria-label={label}
          aria-current={cell.lit ? "true" : undefined}
          onSelect={() => select(cell)}
        >
          {worded ? <span className={styles.name}>{cell.label}</span> : <TabIcon src={cell.icon} plate={cell.kind === "all"} onFail={fail} />}
          <span className={styles.count}>{count}</span>
        </Button>
      </Tooltip>
    );
  };

  return (
    <div className={styles.band}>
      <div className={styles.tabRow} data-clipped={plan.clipped ? "true" : undefined}>
        <div className={styles.cells}>
          {row.items.map((item) =>
            item.kind === "bracket"
              ? <div key={item.key} className={styles.segment}>{[item.parent, ...item.tiers].map(renderCell)}</div>
              : renderCell(item)
          )}
        </div>
        <div className={styles.spacer} />
        <div className={styles.readout} data-readout={plan.readout}>
          {plan.readout === "full" && <span className={styles.place}>{place}</span>}
          <span className={styles.range}>{range}</span>
        </div>
      </div>
    </div>
  );
};
