import { bindValue, trigger, useValue } from "cs2/api";
import { tool } from "cs2/bindings";
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

/** The game's default tool, by the id its binding reports. */
const DEFAULT_TOOL_ID = "Default Tool";

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
  // When a tool last fell back to default, so an Escape can tell the press
  // that cancelled a tool from the one after it. See shouldClearOnEscape.
  const disarmedAt = useRef(Number.NEGATIVE_INFINITY);
  const lastToolId = useRef<string | null>(null);

  useEffect(() => {
    const seen = tool.activeTool$.subscribe((active) => {
      const id = active?.id;

      if (id === DEFAULT_TOOL_ID && lastToolId.current !== DEFAULT_TOOL_ID) {
        disarmedAt.current = performance.now();
      }

      lastToolId.current = id ?? null;
    });

    return () => seen.dispose();
  }, []);

  /**
   * Escape takes the lens down.
   *
   * cm-z9lm. It could not before: the second press went to the pause menu and
   * the panel stayed, so the only way out was the toolbar icon.
   *
   * This clears the GAME's selection rather than hiding our panel, which is
   * the same path the toolbar button uses — VanillaMenuWatcher's own close
   * branch above picks up the resulting null. Clearing nulls menu, category
   * and asset together, so nothing is left for the vanilla grid to draw into
   * the gap, which was the original defect.
   *
   * Capture phase, because the panel's own controls should not get to swallow
   * it first.
   *
   * KNOWN GAP, measured rather than assumed: in the armed path the game still
   * opens the pause menu on the second press. Its Escape chain spends the
   * first press on the tool and treats the second as 'nothing left to close',
   * because it checks its OWN panel and ours replaced it. A DOM listener
   * cannot suppress a native handler, so this closes the lens but does not
   * stop the pause. That is unchanged from before this existed.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.keyCode !== ESCAPE_KEY_CODE) {
        return;
      }

      if (!shouldClearOnEscape({
        lensOpen,
        msSinceToolDisarmed: performance.now() - disarmedAt.current,
      })) {
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
