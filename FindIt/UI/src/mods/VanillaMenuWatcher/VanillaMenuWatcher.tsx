import { bindValue, trigger, useValue } from "cs2/api";
import { useEffect, useRef } from "react";
import mod from "../../../mod.json";
import type { ToolbarEntity } from "domain/toolbarEntity";
import {
  nextWatchState,
  shouldClearOnEscape,
  toolbarEntityIndex,
  vanillaMenuDeselectedCommand,
  vanillaMenuSelectedCommand,
  watchAction,
  type WatchState,
} from "domain/vanillaMenuWatch";

const SelectedAssetMenu$ = bindValue<ToolbarEntity | null>("toolbar", "selectedAssetMenu", null);
const ReplaceVanillaBuildMenu$ = bindValue<boolean>(mod.id, "ReplaceVanillaBuildMenu", false);
const LensOwnsCurrentMenu$ = bindValue<boolean>(mod.id, "LensOwnsCurrentMenu", false);

/** Escape, by code. Cohtml leaves `key` empty for it; `keyCode` is right. */
const ESCAPE_KEY_CODE = 27;

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
  const state = useRef<WatchState>({ seen: false, last: null });
  // Bumped on every observation so a deferred close can tell whether the
  // toolbar moved on after it was scheduled.
  const generation = useRef(0);

  const lensOpen = useValue(LensOwnsCurrentMenu$);

  /**
   * Escape takes the lens down.
   *
   * Clears the GAME's selection rather than hiding our panel, so the close
   * branch below does the actual work — one route out, the same one the
   * toolbar button uses. Capture phase, so a control inside the panel cannot
   * swallow it first.
   *
   * See shouldClearOnEscape for why this asks nothing about the active tool.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.keyCode !== ESCAPE_KEY_CODE) {
        return;
      }

      if (!shouldClearOnEscape({ lensOpen })) {
        return;
      }

      trigger("toolbar", "clearAssetSelection");
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, lensOpen]);

  useEffect(() => {
    if (!enabled) {
      state.current = { seen: false, last: null };
      return;
    }

    const index = toolbarEntityIndex(selected);
    const action = watchAction(state.current, index);

    state.current = nextWatchState(state.current, index, action);

    const observed = ++generation.current;

    if (action === "open" && index !== null) {
      const command = vanillaMenuSelectedCommand(index);
      trigger(mod.id, command.method, ...command.args);
      return;
    }

    if (action !== "close") {
      return;
    }

    // Switching menus passes through Entity.Null on the way. Measured on the
    // live toolbar as 16934 -> 0 -> 16928, all three delivered inside one JS
    // tick, before any microtask ran. Closing the moment a null arrives would
    // therefore dismiss the lens every time the player moved between menus.
    // Deferring to a microtask lets the replacement selection land first, and
    // the generation check turns this into a no-op when it does.
    Promise.resolve().then(() => {
      if (generation.current !== observed) {
        return;
      }

      const command = vanillaMenuDeselectedCommand();
      trigger(mod.id, command.method, ...command.args);
    });
  }, [enabled, selected]);

  return null;
};
