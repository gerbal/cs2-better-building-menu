import { useValue } from "cs2/api";
import { useLocalization } from "cs2/l10n";
import classNames from "classnames";
import { useState } from "react";

import { ICONS_NAMED, VIEW_ROWS, type BodyKind } from "domain/bodyChoice";
import { lookOf, releasedLooks } from "domain/looks";
import { WIDTH_STEP_DEFAULT } from "domain/sharedContracts.generated";
import { coversTheChirper, WIDTH_STEP_NUMBERS } from "domain/widthSteps";
import { AssetMenuLook$, AssetMenuTuning$, send } from "mods/bindings";
import popover from "mods/ControlPopover/controlPopover.module.scss";
import { useAssetMenuLayout } from "mods/useAssetMenuLayout";
import { useMenuBody } from "mods/useMenuBody";
import { PickerRow } from "./PickerRow";
import styles from "./pickerList.module.scss";

/** A pick VIEW offers: a body, or in developer mode the icons with names. */
type ViewPick = BodyKind | typeof ICONS_NAMED;

/** Each pick's name in VIEW, its string's key and its English. */
const BODY_LABELS: Readonly<Record<ViewPick, { key: string; fallback: string }>> = {
  list: { key: "Tooltip.LABEL[BetterBuildingMenu.ViewList]", fallback: "List" },
  icons: { key: "Tooltip.LABEL[BetterBuildingMenu.ViewIcons]", fallback: "Icons" },
  tiles: { key: "Tooltip.LABEL[BetterBuildingMenu.ViewTiles]", fallback: "Tiles" },
  cards: { key: "Tooltip.LABEL[BetterBuildingMenu.ViewCards]", fallback: "Cards" },
  [ICONS_NAMED]: { key: "Tooltip.LABEL[BetterBuildingMenu.ViewIconsNamed]", fallback: "Icons with names" },
};

export interface ViewOption {
  /** The pick a row sends: a body, the icons with names, or "" for Default view. */
  id: ViewPick | "";
  label: string;
  selected: boolean;
}

/**
 * VIEW's rows for the open menu: "Default view · <body>", lit while the menu has no pick of its own,
 * then each body, and in developer mode the icons with names, the menu's own pick lit; the drawn body's
 * name for the control; and the pick, which C# keeps for the menu and echoes, redrawing the body. With
 * no menu open, as under Search everything, there is no menu to keep a pick, so the list offers none.
 */
export function useViewOptions(): { current: string; changed: boolean; options: ViewOption[]; offered: boolean; pick: (kind: ViewPick | "") => void } {
  const { translate } = useLocalization();
  const body = useMenuBody();
  const developerMode = useValue(AssetMenuTuning$).developerMode;
  const name = (kind: ViewPick): string => translate(BODY_LABELS[kind].key, BODY_LABELS[kind].fallback) ?? BODY_LABELS[kind].fallback;
  const byDefault = (translate("Tooltip.LABEL[BetterBuildingMenu.DefaultViewRow]", "Default view · {0}") ?? "Default view · {0}")
    .replace("{0}", name(body.byDefault));
  const rows: readonly ViewPick[] = developerMode ? [...VIEW_ROWS, ICONS_NAMED] : VIEW_ROWS;

  return {
    current: name(body.named ? ICONS_NAMED : body.drawn),
    changed: body.pick !== "",
    options: [
      { id: "", label: byDefault, selected: body.pick === "" },
      ...rows.map((kind) => ({ id: kind, label: name(kind), selected: body.pick === kind })),
    ],
    offered: body.menu !== "",
    pick: (kind) => send({ method: "SetAssetMenuView", args: [kind] }),
  };
}

/**
 * "Look, every menu", to the VIEW list's left: the finished looks, the one in force lit. A click stores a
 * look for every menu and keeps both lists open, so looks compare on the player's own city. It opens the
 * way its VIEW list does.
 */
const LookList = ({ opensDown }: { opensDown: boolean }) => {
  const { translate } = useLocalization();
  const current = lookOf(useValue(AssetMenuLook$)).id;

  return (
    <div className={classNames(popover.popover, styles.list, styles.lookList, opensDown ? styles.down : styles.up)}>
      <div className={styles.header}>{translate("Tooltip.LABEL[BetterBuildingMenu.LookEveryMenu]", "Look, every menu") ?? "Look, every menu"}</div>
      {releasedLooks().map((look) => (
        <PickerRow
          key={look.id}
          label={translate(look.nameKey, look.name) ?? look.name}
          lit={look.id === current}
          onSelect={() => send({ method: "SetAssetMenuLook", args: [look.id] })}
        />
      ))}
    </div>
  );
};

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
 * a pick closing it; then the doors to what applies to every menu, Look and Width, each with its list
 * beside it, one at a time, and More options…, which opens the mod's page. `opensDown` when its popover
 * hangs from under the top row.
 */
export const ViewList = ({ onPicked, opensDown = false }: { onPicked: () => void; opensDown?: boolean }) => {
  const { translate } = useLocalization();
  const label = (key: string, fallback: string): string => translate(key, fallback) ?? fallback;
  const view = useViewOptions();
  const { step } = useAssetMenuLayout();
  const look = lookOf(useValue(AssetMenuLook$));
  const [beside, setBeside] = useState<"look" | "width" | null>(null);
  const everyMenu = `${label("Tooltip.LABEL[BetterBuildingMenu.EveryMenu]", "every menu")} ›`;
  const toggle = (list: "look" | "width") => setBeside((shown) => (shown === list ? null : list));

  return (
    <div className={classNames(styles.list, styles.viewList)}>
      {view.offered && view.options.map((option) => (
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
      {view.offered && <div className={styles.divider} />}
      <PickerRow
        label={label("Tooltip.LABEL[BetterBuildingMenu.ViewLook]", "Look · {0}").replace("{0}", label(look.nameKey, look.name))}
        note={everyMenu}
        onSelect={() => toggle("look")}
      />
      <PickerRow
        label={label("Tooltip.LABEL[BetterBuildingMenu.ViewWidth]", "Width · {0}").replace("{0}", String(step))}
        note={everyMenu}
        onSelect={() => toggle("width")}
      />
      <PickerRow
        label={label("Tooltip.LABEL[BetterBuildingMenu.MoreOptions]", "More options…")}
        onSelect={() => {
          send({ method: "OpenModOptions", args: [] });
          onPicked();
        }}
      />
      {beside === "look" && <LookList opensDown={opensDown} />}
      {beside === "width" && <WidthList opensDown={opensDown} />}
    </div>
  );
};
