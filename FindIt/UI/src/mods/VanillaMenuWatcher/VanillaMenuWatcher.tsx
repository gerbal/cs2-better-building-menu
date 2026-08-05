import { bindValue, trigger, useValue } from "cs2/api";
import { useEffect, useRef } from "react";
import mod from "../../../mod.json";
import type { ToolbarEntity } from "domain/toolSurfaceContracts";
import { toolbarEntityIndex, vanillaMenuSelectedCommand } from "domain/vanillaMenuWatch";

const SelectedAssetMenu$ = bindValue<ToolbarEntity | null>("toolbar", "selectedAssetMenu", null);
const ReplaceVanillaBuildMenu$ = bindValue<boolean>(mod.id, "ReplaceVanillaBuildMenu", false);

/**
 * Routes vanilla toolbar menus into the lens.
 *
 * Renders nothing. It watches the game's own `toolbar.selectedAssetMenu`
 * binding and hands the entity to the backend, which resolves the prefab name
 * and decides whether it has a preset — the UI has only an entity index, and
 * naming the menu needs the prefab system.
 *
 * The backend declines quietly for Roads, Landscaping and any menu it has no
 * preset for, so those keep using the vanilla grid.
 */
export const VanillaMenuWatcher = () => {
  const enabled = useValue(ReplaceVanillaBuildMenu$);
  const selected = useValue(SelectedAssetMenu$);
  // The binding re-emits on unrelated toolbar churn; without this the trigger
  // would fire repeatedly for a menu that is already open and fight the
  // player's own navigation inside it.
  const lastSent = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastSent.current = null;
      return;
    }

    const index = toolbarEntityIndex(selected);

    if (index === null) {
      // Menu closed. Clear so reopening the same one is seen as a new
      // selection rather than swallowed as a duplicate.
      lastSent.current = null;
      return;
    }

    if (lastSent.current === index) {
      return;
    }

    lastSent.current = index;

    const command = vanillaMenuSelectedCommand(index);
    trigger(mod.id, command.method, ...command.args);
  }, [enabled, selected]);

  return null;
};
