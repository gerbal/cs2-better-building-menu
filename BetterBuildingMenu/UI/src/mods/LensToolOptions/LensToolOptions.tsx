import { useValue } from "cs2/api";
import { game } from "cs2/bindings";
import { ModuleRegistryExtend } from "cs2/modding";
import classNames from "classnames";
import { cloneElement, isValidElement, type ReactNode } from "react";

import styles from "./LensToolOptions.module.scss";
import lockIcon from "images/lock.svg";
import unlockIcon from "images/unlock.svg";
import { isBankDimension } from "domain/filterRail";
import { shouldMountInAssetMenu } from "domain/buildingMenuMount";
import { toggleBuildingLensFacetCommand, type BuildingLensFacetState } from "domain/buildingCatalogFacets";
import type { AvailabilityOption } from "domain/sharedContracts.generated";
import { VanillaComponentResolver } from "mods/VanillaComponentResolver/VanillaComponentResolver";
import { BuildingLensFacets$, LensOwnsCurrentMenu$, send } from "mods/bindings";
import { ExtensionBoundary } from "mods/ExtensionBoundary";

/**
 * Availability, drawn in the game's own tool-options panel beside Theme and
 * Pack. WHICH dimensions come here is BANK_DIMENSION_IDS' answer and the rail
 * renders its complement; the state and the toggle are the rail's, unchanged.
 */

/**
 * The icon each availability option wears: the padlock pair the rail imports,
 * plus vanilla's AlreadyBuilt symbol. Plain <img>, no mask and no tint, because
 * these SVGs carry their own fill and this engine cannot composite a vector.
 */
const OPTION_ICONS: Readonly<Record<AvailabilityOption, string>> = {
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
              // Vanilla's own icon button, as the Theme row beside this one
              // uses, so the two read as one panel.
              src={OPTION_ICONS[option.id as AvailabilityOption] ?? ""}
              selected={option.selected}
              multiSelect
              tooltip={option.label}
              onSelect={() => send(toggleBuildingLensFacetCommand(group.id, option.id))}
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

export const LensToolOptions: ModuleRegistryExtend = (Component: any) => {
  return function MouseToolOptionsWithBank() {
    const facets = useValue(BuildingLensFacets$);
    const lensOwnsCurrentMenu = useValue(LensOwnsCurrentMenu$);
    const isPhotoMode = useValue(game.activeGamePanel$)?.__Type == game.GamePanelType.PhotoMode;

    // Do not put any Hooks after this point.
    const result: JSX.Element = Component();

    // The same predicate the panel itself mounts on, so the bank cannot offer
    // a control for a menu that is not there, nor withhold one that is.
    if (!isValidElement(result) || !shouldMountInAssetMenu({ lensOwnsCurrentMenu, isPhotoMode })) {
      return result;
    }

    // A copy with our sections after vanilla's, never a push into vanilla's own
    // element: its children may be one element rather than an array. The copy
    // keeps vanilla's type with an array of children, which is what a mod
    // extending after us pushes into. Our section alone sits behind a boundary.
    const children = (result.props as { children?: ReactNode }).children;

    return cloneElement(
      result,
      undefined,
      ...(Array.isArray(children) ? children : [children]),
      <ExtensionBoundary key="betterBuildingMenuBank" name="MouseToolOptions" fallback={() => null}>
        <BankFacets facets={facets} />
      </ExtensionBoundary>
    );
  };
};
