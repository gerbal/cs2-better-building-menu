import { bindValue, trigger, useValue } from "cs2/api";
import { useEffect, useRef } from "react";
import mod from "../../../mod.json";
import type { ToolbarEntity } from "domain/toolbarEntity";
import {
  shouldRouteSelection,
  toolbarEntityIndex,
  vanillaMenuSelectedCommand,
} from "domain/vanillaMenuWatch";

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
  // The binding re-emits on unrelated toolbar churn, and emits current state
  // on subscribe. shouldRouteSelection filters both.
  const state = useRef<{ seen: boolean; last: number | null }>({ seen: false, last: null });

  useEffect(() => {
    if (!enabled) {
      state.current = { seen: false, last: null };
      return;
    }

    const index = toolbarEntityIndex(selected);
    const route = shouldRouteSelection(state.current, index);

    // Observed either way: the first emission is state, not a click, and a
    // closed menu must be remembered so reopening the same one counts as new.
    state.current = { seen: true, last: route ? index : (index === null ? null : state.current.last) };

    if (!route || index === null) {
      return;
    }

    const command = vanillaMenuSelectedCommand(index);
    trigger(mod.id, command.method, ...command.args);
  }, [enabled, selected]);

  return null;
};
