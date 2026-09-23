import { trigger, useValue } from "cs2/api";
import { useEffect, useRef } from "react";
import {
  nextWatchState,
  shouldClearOnEscape,
  toolbarEntityIndex,
  vanillaMenuDeselectedCommand,
  vanillaMenuSelectedCommand,
  watchAction,
  watchStateWhileOff,
  type WatchState,
} from "domain/vanillaMenuWatch";
import {
  FindItPanelShown$,
  LensOwnsCurrentMenu$,
  ReplaceVanillaBuildMenu$,
  SelectedAssetMenu$,
  send,
} from "mods/bindings";

/** Escape, by code. Cohtml leaves `key` empty for it; `keyCode` is right. */
const ESCAPE_KEY_CODE = 27;

/**
 * Routes vanilla toolbar menus into the lens; renders nothing. The entity index
 * goes to the backend because naming a menu needs the prefab system, and a menu
 * the index cannot name is declined quietly and keeps its vanilla grid.
 */
export const VanillaMenuWatcher = () => {
  const enabled = useValue(ReplaceVanillaBuildMenu$);
  const selected = useValue(SelectedAssetMenu$);
  // The binding re-emits on unrelated toolbar churn, and emits current state
  // on subscribe. watchAction filters both.
  const state = useRef<WatchState>({ seen: false, last: null });
  // Bumped on every observation so a deferred close can tell whether the
  // toolbar moved on after it was scheduled.
  const generation = useRef(0);

  const lensOpen = useValue(LensOwnsCurrentMenu$);
  const findItPanelShown = useValue(FindItPanelShown$) === true;

  /**
   * Escape takes the lens down by clearing the GAME's selection, so the close
   * branch below does the work and there is one route out. Capture phase, so a
   * control inside the panel cannot swallow it. See shouldClearOnEscape.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.keyCode !== ESCAPE_KEY_CODE) {
        return;
      }

      if (!shouldClearOnEscape({ lensOpen, findItPanelShown })) {
        return;
      }

      trigger("toolbar", "clearAssetSelection");
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, lensOpen, findItPanelShown]);

  useEffect(() => {
    if (!enabled) {
      state.current = watchStateWhileOff();
      return;
    }

    const index = toolbarEntityIndex(selected);
    const action = watchAction(state.current, index);

    state.current = nextWatchState(state.current, index, action);

    const observed = ++generation.current;

    if (action === "open" && index !== null) {
      send(vanillaMenuSelectedCommand(index));
      return;
    }

    if (action !== "close") {
      return;
    }

    // Switching menus passes through Entity.Null within one JS tick, so
    // closing the moment a null arrives would dismiss the lens on every move
    // between menus. The microtask lets the replacement land first.
    Promise.resolve().then(() => {
      if (generation.current !== observed) {
        return;
      }

      send(vanillaMenuDeselectedCommand());
    });
  }, [enabled, selected]);

  return null;
};
