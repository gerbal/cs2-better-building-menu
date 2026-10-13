import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useState } from "react";

import { drawnBody, VIEW_ROWS, type BodyKind, type DrawnBody } from "domain/bodyChoice";
import { WIDTH_STEP_DEFAULT } from "domain/sharedContracts.generated";
import { coversTheChirper, WIDTH_STEP_NUMBERS } from "domain/widthSteps";
import { send } from "mods/bindings";
import popover from "mods/ControlPopover/controlPopover.module.scss";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { useMenuBody } from "mods/useMenuBody";
import { PickerRow } from "./PickerRow";
import styles from "./pickerList.module.scss";

/** Each body's name in VIEW, its string's key and its English. */
const BODY_LABELS: Readonly<Record<DrawnBody, { key: string; fallback: string }>> = {
  list: { key: "Tooltip.LABEL[BetterBuildingMenu.ViewList]", fallback: "List" },
  tiles: { key: "Tooltip.LABEL[BetterBuildingMenu.ViewTiles]", fallback: "Tiles" },
  cards: { key: "Tooltip.LABEL[BetterBuildingMenu.ViewCards]", fallback: "Cards" },
};

export interface ViewOption {
  /** The pick a row sends: a body, or "" for Default view. */
  id: BodyKind | "";
  label: string;
  selected: boolean;
}

/**
 * VIEW's rows for the open menu: "Default view · <body>", lit while the menu has no pick of its own,
 * then each body, the menu's own pick lit; the drawn body's name for the control; and the pick, which
 * C# keeps for the menu and echoes, redrawing the body.
 */
export function useViewOptions(): { current: string; changed: boolean; options: ViewOption[]; pick: (kind: BodyKind | "") => void } {
  const { translate } = useLocalization();
  const body = useMenuBody();
  const name = (kind: DrawnBody): string => translate(BODY_LABELS[kind].key, BODY_LABELS[kind].fallback) ?? BODY_LABELS[kind].fallback;
  const byDefault = (translate("Tooltip.LABEL[BetterBuildingMenu.DefaultViewRow]", "Default view · {0}") ?? "Default view · {0}")
    .replace("{0}", name(drawnBody(body.byDefault)));

  return {
    current: name(body.drawn),
    changed: body.pick !== "",
    options: [
      { id: "", label: byDefault, selected: body.pick === "" },
      ...VIEW_ROWS.map((kind) => ({ id: kind, label: name(kind), selected: body.pick === kind })),
    ],
    pick: (kind) => send({ method: "SetAssetMenuView", args: [kind] }),
  };
}

/**
 * "Width, every menu", to the VIEW list's left: the five steps, the stored one lit, beside the pane
 * the ones that do not fit dimmed (a stored one among them draws as the widest that fits). A click
 * stores a step and keeps both lists open. It opens the way its VIEW list does.
 */
const WidthList = ({ opensDown }: { opensDown: boolean }) => {
  const { translate } = useLocalization();
  const label = (key: string, fallback: string): string => translate(key, fallback) ?? fallback;
  const { step, snaps } = useAssetMenuLayout();
  const fits = new Set(snaps.map((snap) => snap.step));
  const note = (candidate: number): string | undefined => {
    if (candidate === WIDTH_STEP_DEFAULT) return label("Tooltip.LABEL[BetterBuildingMenu.WidthDefault]", "default");
    return coversTheChirper(candidate) ? label("Tooltip.LABEL[BetterBuildingMenu.CoversTheChirper]", "covers the chirper") : undefined;
  };

  return (
    <div className={classNames(popover.popover, styles.list, styles.widthList, opensDown ? styles.down : styles.up)}>
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
 * VIEW's list, in a popover or the control pane: Default view and the bodies, the menu's own pick lit,
 * a pick closing it; then the doors to what applies to every menu, Width with its sub-list beside it
 * and More options…, which opens the mod's page. `opensDown` when its popover hangs from under the top row.
 */
export const ViewList = ({ onPicked, opensDown = false }: { onPicked: () => void; opensDown?: boolean }) => {
  const { translate } = useLocalization();
  const label = (key: string, fallback: string): string => translate(key, fallback) ?? fallback;
  const view = useViewOptions();
  const { step } = useAssetMenuLayout();
  const [widthOpen, setWidthOpen] = useState(false);

  return (
    <div className={classNames(styles.list, styles.viewList)}>
      {view.options.map((option) => (
        <PickerRow
          key={option.id || "default"}
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
      {widthOpen && <WidthList opensDown={opensDown} />}
    </div>
  );
};
