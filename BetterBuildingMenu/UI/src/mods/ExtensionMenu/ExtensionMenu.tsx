import { useMapValue, useValue } from "cs2/api";
import { selectedInfo, upgrade } from "cs2/bindings";
import { useLocalization } from "cs2/l10n";
import { ModuleRegistryExtend } from "cs2/modding";
import { Button, Tooltip } from "cs2/ui";
import classNames from "classnames";
import { decideExtensionMenu, type ExtensionRow, type VanillaUpgradeRow } from "domain/extensionMenu";
import { BuildingList } from "mods/BuildingList/BuildingList";
import { LensResizeHandle, useLensPanelHeight } from "mods/LensResizeHandle/LensResizeHandle";
import styles from "./extensionMenu.module.scss";
import { BuildingExtensionMenu$, ReplaceVanillaBuildMenu$ } from "mods/bindings";
import { gameClasses } from "mods/gameModules";

// The same vanilla class the build menu's body wears, so both panels are sized
// by the one rule vanilla applies to its asset panel.
const AssetMenuTheme = gameClasses("game-ui/game/components/asset-menu/asset-menu.module.scss");

interface UpgradesMenuProps {
  focusKey?: unknown;
  className?: string;
  onClose?: () => void;
}

/**
 * Stands in for the game's UpgradesMenu. Vanilla lists what may be attached and
 * decides what is locked or built, the click is still its own `selectUpgrade`,
 * and it draws the panel unless we can account for every row it lists.
 */
export const ExtensionMenuComponent: ModuleRegistryExtend = (Component) => {
  return function UpgradesMenuOrOurs(props) {
    const { className, onClose } = (props ?? {}) as UpgradesMenuProps;
    const enabled = useValue(ReplaceVanillaBuildMenu$) === true;
    const selected = useValue(selectedInfo.selectedEntity$);
    // Vanilla's rows for this selection, keyed by the selected entity exactly
    // as vanilla's own UpgradeGrid reads them.
    const listed = (useMapValue(upgrade.upgrades$, selected) ?? []) as VanillaUpgradeRow[];
    const menu = useValue(BuildingExtensionMenu$);
    const selectedUpgrade = useValue(upgrade.selectedUpgrade$);

    // Do not put any Hooks (i.e. UseXXXX) after this point.

    const decision = decideExtensionMenu({ enabled, listed, entries: menu?.entries ?? [] });

    if (decision.mode !== "ours") {
      return <Component {...props} />;
    }

    return (
      <ExtensionMenuPanel
        className={className}
        buildingName={menu.buildingName}
        rows={decision.rows}
        selectedUpgrade={selectedUpgrade}
        onPlace={(row) => upgrade.selectUpgrade(selected, row.entity)}
        onClose={onClose}
      />
    );
  };
};

interface ExtensionMenuPanelProps {
  className?: string;
  buildingName: string;
  rows: ExtensionRow[];
  selectedUpgrade: { index: number; version: number } | undefined;
  onPlace: (row: ExtensionRow) => void;
  onClose?: () => void;
}

const ExtensionMenuPanel = ({ className, buildingName, rows, selectedUpgrade, onPlace, onClose }: ExtensionMenuPanelProps) => {
  const { translate } = useLocalization();
  // The build menu's height, as a CAP: a two-row picker stays two rows, a
  // long one scrolls at the dragged height instead of growing over the screen.
  const { height, isResizing, beginResize, blocker } = useLensPanelHeight();
  const kind = translate("UpgradesMenu.TITLE", "Upgrades") ?? "Upgrades";
  const closeLabel = translate("Tooltip.LABEL[BetterBuildingMenu.CloseMenu]", "Close") ?? "Close";
  const byId = new Map(rows.map((row) => [row.entry.id, row]));
  const selectedId = rows.find(
    (row) => selectedUpgrade && row.entity.index === selectedUpgrade.index && row.entity.version === selectedUpgrade.version
  )?.entry.id;

  return (
    <div className={classNames(styles.panel, className)} data-extension-menu="true">
      {blocker}
      <LensResizeHandle active={isResizing} onBeginResize={beginResize} />
      <div className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.title}>{buildingName}</span>
          <span className={styles.kind}>{kind}</span>
        </div>
        {onClose && (
          <Tooltip tooltip={closeLabel}>
            <Button className={styles.close} variant="icon" aria-label={closeLabel} onSelect={onClose}>
              <span className={styles.closeGlyph} style={{ maskImage: "url(Media/Glyphs/Close.svg)" }} aria-hidden="true" />
            </Button>
          </Tooltip>
        )}
      </div>
      <div className={classNames(styles.content, AssetMenuTheme?.assetPanel)} style={{ maxHeight: `${height}rem` }}>
        <BuildingList
          entries={rows.map((row) => row.entry)}
          variant="cards"
          selectedId={selectedId}
          onPlace={(entry) => {
            const row = byId.get(entry.id);
            if (row) onPlace(row);
          }}
        />
      </div>
    </div>
  );
};
