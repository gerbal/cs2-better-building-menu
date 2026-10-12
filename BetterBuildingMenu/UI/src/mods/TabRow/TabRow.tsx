import { useValue } from "cs2/api";
import { FOCUS_DISABLED } from "cs2/input";
import { useLocalization } from "cs2/l10n";
import { Button, Tooltip } from "cs2/ui";
import classNames from "classnames";
import { useMemo, useState, type SyntheticEvent } from "react";

import { getNumberSeparators, groupDigits } from "domain/assetMenuMetricFormat";
import { NO_TIER_BRACKET } from "domain/menuProgression";
import { fitIcon, SQUARE, tabRow, type IconFit, type TabCell } from "domain/tabRow";
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
  CurrentSearch$,
  send,
} from "mods/bindings";
import styles from "./tabRow.module.scss";

const percent = (fraction: number): string => `${Math.round(fraction * 10000) / 100}%`;

/** A picture in a cell's icon slot: square until it loads, then fitted by its long side. */
const TabIcon = ({ src, plate }: { src: string; plate: boolean }) => {
  const [fit, setFit] = useState<IconFit>(SQUARE);
  // Cohtml has no object-fit, and a mod's picture need not be square.
  const onLoad = (event: SyntheticEvent<HTMLImageElement>) =>
    setFit(fitIcon(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight));

  return (
    <span className={classNames(styles.iconSlot, plate && styles.plate)}>
      <img
        className={styles.icon}
        src={src}
        alt=""
        aria-hidden="true"
        onLoad={onLoad}
        style={{ width: percent(fit.width), height: percent(fit.height) }}
      />
    </span>
  );
};

/**
 * The menu's tabs along the box's bottom edge, under the list: All, then the game's tabs with their
 * branches or levels, each with its count, on one line. See docs/design-notes.md, "The tab row".
 */
export const TabRow = () => {
  const { translate } = useLocalization();
  const menu = useValue(AssetMenu$) ?? "";
  const menus = useValue(AssetMenus$) ?? [];
  const categories = useValue(AssetMenuCategories$) ?? [];
  const counts = useValue(AssetMenuCategoryCounts$) ?? [];
  const allCount = useValue(AssetMenuAllCount$) ?? 0;
  const selectedCategory = useValue(AssetMenuCategory$) ?? "";
  const expanded = useValue(AssetMenuExpandedCategories$) ?? [];
  const stripTabs = useValue(AssetMenuStripTabs$) ?? [];
  // A list, because the filter rail writes the same state and can hold several.
  const selectedStripTabs = useValue(AssetMenuStripTab$) ?? [];
  const bracket = useValue(AssetMenuTierBracket$) ?? NO_TIER_BRACKET;
  const selectedTier = useValue(AssetMenuSchoolTier$) ?? -1;
  const searching = (useValue(CurrentSearch$) ?? "").trim() !== "";
  const separators = useMemo(() => getNumberSeparators(translate), [translate]);

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
  });

  const select = (cell: TabCell) => {
    if (cell.kind === "branch") send({ method: "SetAssetMenuStripTab", args: [cell.id] });
    else if (cell.kind === "tier") send({ method: "SetAssetMenuSchoolTier", args: [Number(cell.id)] });
    // All sends the empty category, which clears every narrowing.
    else send({ method: "SetAssetMenuCategory", args: [cell.id] });
  };

  const renderCell = (cell: TabCell) => {
    const count = cell.count === null ? "" : groupDigits(cell.count, separators);
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
          {/* Keyed by its picture, so a new menu's picture starts square rather than at the fit
              the cell's last picture loaded with. */}
          {worded ? <span className={styles.name}>{cell.label}</span> : <TabIcon key={cell.icon} src={cell.icon} plate={cell.kind === "all"} />}
          <span className={styles.count}>{count}</span>
        </Button>
      </Tooltip>
    );
  };

  return (
    <div className={styles.band}>
      <div className={styles.tabRow}>
        {row.items.map((item) =>
          item.kind === "bracket"
            ? <div key={item.key} className={styles.segment}>{[item.parent, ...item.tiers].map(renderCell)}</div>
            : renderCell(item)
        )}
        <div className={styles.spacer} />
      </div>
    </div>
  );
};
