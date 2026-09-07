import { bindValue, useMapValue, useValue } from "cs2/api";
import { selectedInfo, upgrade } from "cs2/bindings";
import { useLocalization } from "cs2/l10n";
import { ModuleRegistryExtend, getModule } from "cs2/modding";
import { Button, Tooltip } from "cs2/ui";
import classNames from "classnames";
import { BuildingCatalogEntry } from "domain/buildingCatalog";
import { decideExtensionMenu, type ExtensionRow, type VanillaUpgradeRow } from "domain/extensionMenu";
import { BuildingList } from "mods/BuildingList/BuildingList";
import mod from "../../../mod.json";
import styles from "./extensionMenu.module.scss";

// The same vanilla class the build menu's body wears (BuildingMenuSurface),
// so both panels are sized by the one rule vanilla applies to the asset panel.
const AssetMenuTheme: Record<string, string> | undefined = getModule("game-ui/game/components/asset-menu/asset-menu.module.scss", "classes");

/** The mod's replace-vanilla-menus setting: one switch for both pickers. */
const ReplaceVanillaBuildMenu$ = bindValue<boolean>(mod.id, "ReplaceVanillaBuildMenu", false);

interface BuildingExtensionMenu {
  buildingName: string;
  entries: BuildingCatalogEntry[];
}

/** The catalog entries behind the selected building's upgrades; see BuildingExtensionMenu.cs. */
const BuildingExtensionMenu$ = bindValue<BuildingExtensionMenu>(mod.id, "BuildingExtensionMenu", { buildingName: "", entries: [] });

interface UpgradesMenuProps {
  focusKey?: unknown;
  className?: string;
  onClose?: () => void;
}

/**
 * Stands in for the game's UpgradesMenu — the picker that appears when a
 * building with upgrades is selected.
 *
 * Vanilla lists what may be attached and decides what is locked or already
 * built on this building; we only change how the rows are drawn. The click is
 * still vanilla's own `selectUpgrade`, so the tool, the `upgrading` flag and
 * the gamepad path are untouched. When we cannot account for every row vanilla
 * lists, vanilla draws the panel — see decideExtensionMenu for the rule.
 */
export const ExtensionMenuComponent: ModuleRegistryExtend = (Component) => {
  return (props) => {
    const { className, onClose } = (props ?? {}) as UpgradesMenuProps;
    const enabled = useValue(ReplaceVanillaBuildMenu$) === true;
    const selected = useValue(selectedInfo.selectedEntity$);
    // Vanilla's rows for this selection. The map is keyed by the selected
    // entity, exactly as vanilla's own UpgradeGrid reads it.
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
  const kind = translate("UpgradesMenu.TITLE", "Upgrades") ?? "Upgrades";
  const closeLabel = translate("Tooltip.LABEL[BetterBuildingMenu.CloseMenu]", "Close") ?? "Close";
  const byId = new Map(rows.map((row) => [row.entry.id, row]));
  const selectedId = rows.find(
    (row) => selectedUpgrade && row.entity.index === selectedUpgrade.index && row.entity.version === selectedUpgrade.version
  )?.entry.id;

  return (
    <div className={classNames(styles.panel, className)} data-extension-menu="true">
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
      <div className={classNames(styles.content, AssetMenuTheme?.assetPanel)}>
        <BuildingList
          entries={rows.map((row) => row.entry)}
          searchText=""
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
