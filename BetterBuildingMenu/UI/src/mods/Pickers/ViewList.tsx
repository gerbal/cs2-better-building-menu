import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useState } from "react";

import { setAssetMenuView } from "domain/assetMenuViewStore";
import { WIDTH_STEP_DEFAULT } from "domain/sharedContracts.generated";
import { chooseViewMode, DEFAULT_VIEW_MODE, VIEW_MODES, type ViewModeKind } from "domain/viewModeChoice";
import { coversTheChirper, WIDTH_STEP_NUMBERS } from "domain/widthSteps";
import { AssetMenuViewMode$, send } from "mods/bindings";
import popover from "mods/ControlPopover/controlPopover.module.scss";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { useAssetMenuView } from "mods/useAssetMenuView";
import { PickerRow } from "./PickerRow";
import styles from "./pickerList.module.scss";

export interface ViewOption {
  id: ViewModeKind;
  label: string;
  selected: boolean;
}

/**
 * The views, the one drawn lit, and the pick: the store first, so it redraws now, then C#, which
 * keeps it for the next session. Only from a click: an effect would answer C#'s own echo.
 */
export function useViewOptions(): { current: string; options: ViewOption[]; pick: (view: ViewModeKind) => void } {
  const { translate } = useLocalization();
  const chosen = chooseViewMode(useAssetMenuView((view) => view.viewMode), useValue(AssetMenuViewMode$), DEFAULT_VIEW_MODE);
  const options = VIEW_MODES.map((mode) => ({
    id: mode.id,
    label: translate(mode.localizationKey, mode.fallback) ?? mode.fallback,
    selected: mode.id === chosen,
  }));

  return {
    current: options.find((option) => option.selected)?.label ?? options[0].label,
    options,
    pick: (view) => {
      setAssetMenuView({ viewMode: view });
      send({ method: "SetAssetMenuViewMode", args: [view] });
    },
  };
}

/**
 * "Width, every menu", to the VIEW list's left: the five steps, the stored one lit, beside the pane
 * the ones that do not fit dimmed (a stored one among them draws as the widest that fits). A click
 * stores a step and keeps both lists open.
 */
const WidthList = () => {
  const { translate } = useLocalization();
  const label = (key: string, fallback: string): string => translate(key, fallback) ?? fallback;
  const { step, snaps } = useAssetMenuLayout();
  const fits = new Set(snaps.map((snap) => snap.step));
  const note = (candidate: number): string | undefined => {
    if (candidate === WIDTH_STEP_DEFAULT) return label("Tooltip.LABEL[BetterBuildingMenu.WidthDefault]", "default");
    return coversTheChirper(candidate) ? label("Tooltip.LABEL[BetterBuildingMenu.CoversTheChirper]", "covers the chirper") : undefined;
  };

  return (
    <div className={classNames(popover.popover, styles.list, styles.widthList)}>
      <div className={styles.header}>{label("Tooltip.LABEL[BetterBuildingMenu.WidthEveryMenu]", "Width, every menu")}</div>
      {WIDTH_STEP_NUMBERS.map((candidate) => (
        <PickerRow
          key={candidate}
          label={String(candidate)}
          lit={candidate === step}
          dim={!fits.has(candidate)}
          note={note(candidate)}
          onSelect={() => send({ method: "SetAssetMenuWidthStep", args: [candidate] })}
        />
      ))}
    </div>
  );
};

/**
 * VIEW's list, in a popover or the control pane: the four views, the drawn one lit, a pick closing
 * it; then the doors to what applies to every menu, Width with its sub-list beside it and More
 * options…, which opens the mod's page.
 */
export const ViewList = ({ onPicked }: { onPicked: () => void }) => {
  const { translate } = useLocalization();
  const label = (key: string, fallback: string): string => translate(key, fallback) ?? fallback;
  const view = useViewOptions();
  const { step } = useAssetMenuLayout();
  const [widthOpen, setWidthOpen] = useState(false);

  return (
    <div className={classNames(styles.list, styles.viewList)}>
      {view.options.map((option) => (
        <PickerRow
          key={option.id}
          label={option.label}
          lit={option.selected}
          onSelect={() => {
            view.pick(option.id);
            onPicked();
          }}
        />
      ))}
      <div className={styles.divider} />
      <PickerRow
        label={label("Tooltip.LABEL[BetterBuildingMenu.ViewWidth]", "Width · {0}").replace("{0}", String(step))}
        note={`${label("Tooltip.LABEL[BetterBuildingMenu.EveryMenu]", "every menu")} ›`}
        onSelect={() => setWidthOpen((shown) => !shown)}
      />
      <PickerRow
        label={label("Tooltip.LABEL[BetterBuildingMenu.MoreOptions]", "More options…")}
        onSelect={() => {
          send({ method: "OpenModOptions", args: [] });
          onPicked();
        }}
      />
      {widthOpen && <WidthList />}
    </div>
  );
};
