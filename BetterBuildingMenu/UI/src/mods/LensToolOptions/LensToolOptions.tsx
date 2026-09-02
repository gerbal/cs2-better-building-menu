import { bindValue, trigger, useValue } from "cs2/api";
import { game } from "cs2/bindings";
import { ModuleRegistryExtend } from "cs2/modding";
import classNames from "classnames";

import mod from "../../../mod.json";
import styles from "./LensToolOptions.module.scss";
import lockIcon from "images/lock.svg";
import unlockIcon from "images/unlock.svg";
import { BANK_DIMENSION_IDS, isBankDimension } from "domain/filterRail";
import { shouldMountInAssetMenu } from "domain/buildingMenuMount";
import { toggleBuildingLensFacetCommand, type BuildingLensFacetState } from "domain/buildingCatalogFacets";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";

const BuildingLensFacets$ = bindValue<BuildingLensFacetState | null>(mod.id, "BuildingLensFacets", null);
const LensOwnsCurrentMenu$ = bindValue<boolean>(mod.id, "LensOwnsCurrentMenu", false);

/**
 * Availability, drawn in the game's own left-hand tool-options panel.
 *
 * cm-2xvs.15. Locked / Unlocked / Already built is chrome the game's panel
 * should carry, in the band that already holds Theme, Pack and the tool's own
 * options — not a tenth icon on our filter rail.
 *
 * WHICH dimensions come here is not decided locally. BANK_DIMENSION_IDS is the
 * one list, and the rail renders its complement, because the last time this
 * axis was split the two sides disagreed and five dimensions were drawn
 * nowhere at all (593e756, undone by 3fff26e). filterRail.test.ts asserts the
 * partition rather than trusting it.
 *
 * The state and the toggle are the rail's, unchanged: the same
 * BuildingLensFacets binding and the same toggle command. Only the furniture
 * differs, which is what keeps a move from becoming a fork.
 */
/**
 * The icon each availability option wears.
 *
 * The mod's own padlock pair, the same two the filter rail already imports for
 * this axis, plus vanilla's AlreadyBuilt symbol — the one the grid badge draws
 * on a unique the city already holds. A filter reads better when its options
 * look like the thing they filter for.
 *
 * Plain <img> sources, no mask and no tint: these SVGs carry fill="#ffffff" of
 * their own, so they need no compositing effect to be visible — which matters,
 * because an effect over a vector is what this engine cannot draw (see
 * SilhouetteIcons). The grid's padlock needs a raster only because it wants a
 * DIFFERENT colour from the file's own.
 */
const OPTION_ICONS: Readonly<Record<string, string>> = {
  Locked: lockIcon,
  Unlocked: unlockIcon,
  AlreadyBuilt: "Media/Game/Icons/AlreadyBuilt.svg",
};

const BankFacets = ({ facets }: { facets: BuildingLensFacetState | null | undefined }) => {
  const groups = (facets?.groups ?? []).filter(
    (group) => isBankDimension(group.id) && (group.options?.length ?? 0) > 0
  );

  if (groups.length === 0) {
    return <></>;
  }

  const Section = VanillaComponentResolver.instance.Section;
  const ToolButton = VanillaComponentResolver.instance.ToolButton;

  return (
    <>
      {groups.map((group) => (
        <Section key={group.id} title={group.label}>
          {group.options.map((option) => (
            <ToolButton
              key={option.id}
              // Vanilla's own icon button, which is what the Theme row beside
              // this one uses — so the two read as one panel rather than as a
              // mod bolted to a game.
              src={OPTION_ICONS[option.id] ?? ""}
              selected={option.selected}
              multiSelect
              tooltip={option.label}
              onSelect={() => trigger(mod.id, ...toggleArgs(group.id, option.id))}
              focusKey={VanillaComponentResolver.instance.FOCUS_DISABLED}
              className={classNames(
                VanillaComponentResolver.instance.toolButtonTheme.button,
                styles.option,
                option.selected && styles.optionSelected
              )}
            />
          ))}
        </Section>
      ))}
    </>
  );
};

/** The command as (method, ...args), so the trigger call stays one line. */
function toggleArgs(groupId: string, optionId: string): [string, ...unknown[]] {
  const command = toggleBuildingLensFacetCommand(groupId, optionId);

  return [command.method, ...command.args];
}

export const LensToolOptions: ModuleRegistryExtend = (Component: any) => {
  return () => {
    const facets = useValue(BuildingLensFacets$);
    const lensOwnsCurrentMenu = useValue(LensOwnsCurrentMenu$);
    const isPhotoMode = useValue(game.activeGamePanel$)?.__Type == game.GamePanelType.PhotoMode;

    // Do not put any Hooks after this point.
    const result: JSX.Element = Component();

    // The same predicate the panel itself mounts on, so the bank cannot offer
    // a control for a menu that is not there — nor withhold one from a menu
    // that is.
    if (!shouldMountInAssetMenu({ lensOwnsCurrentMenu, isPhotoMode })) {
      return result;
    }

    result.props.children?.push(<BankFacets facets={facets} />);

    return result;
  };
};

export { BANK_DIMENSION_IDS };
