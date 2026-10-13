import { trigger, useValue } from "cs2/api";
import { useEffect, useMemo, useRef } from "react";
import {
  escapeAction,
  nextWatchState,
  toolbarEntityIndex,
  vanillaMenuDeselectedCommand,
  vanillaMenuSelectedCommand,
  watchAction,
  watchStateWhileOff,
  type WatchState,
} from "domain/vanillaMenuWatch";
import { searchChangedCommand, setMenusDrawingNoGroupsCommand, setMenusOpeningOnAllCommand, type TriggerCommand } from "domain/buildingCatalogContracts";
import { menusDrawingNoGroups, menusOpeningOnAll, type OnAllInput } from "domain/opensOnAll";
import { textInputText } from "domain/textInput";
import {
  AssetMenuAtLargeText$,
  AssetMenuDefaultView$,
  AssetMenuTileSize$,
  AssetMenuTuning$,
  AssetMenuViews$,
  FindItPanelShown$,
  MenuShares$,
  OwnsCurrentMenu$,
  ReplaceVanillaBuildMenu$,
  SelectedAssetMenu$,
  send,
  SHIPPED_TUNING,
} from "mods/bindings";
import { openListCloser } from "mods/BuildingMenu/openListCloser";
import { blurSearchField, isSearchField } from "mods/TopRow/searchField";

/**
 * Tells C# a set of menus, one name a line: once C# has counted a menu, again whenever the set changes,
 * and on a remount, as C# keeps the last set it was told.
 */
function useToldSet(counted: boolean, joined: string, command: (joined: string) => TriggerCommand): void {
  const told = useRef<string | null>(null);

  useEffect(() => {
    if (!counted || joined === told.current) return;
    told.current = joined;
    send(command(joined));
  }, [counted, joined, command]);
}

/** Escape, by code. Cohtml leaves `key` empty for it; `keyCode` is right. */
const ESCAPE_KEY_CODE = 27;

/**
 * Routes vanilla toolbar menus into the asset menu; renders nothing. The entity index
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

  const assetMenuOpen = useValue(OwnsCurrentMenu$);
  const findItPanelShown = useValue(FindItPanelShown$) === true;

  // The small menus, which open on All, and of them those whose list draws no groups unless picked:
  // told to C# here, where the watcher is mounted before any menu opens, since the asset menu mounts
  // only once one has. See domain/opensOnAll.ts.
  const shares = useValue(MenuShares$);
  const views = useValue(AssetMenuViews$);
  const defaultView = useValue(AssetMenuDefaultView$);
  const tuning = useValue(AssetMenuTuning$);
  const tileSize = useValue(AssetMenuTileSize$);
  const atLargeText = useValue(AssetMenuAtLargeText$);
  const small = useMemo<OnAllInput>(
    () => ({ shares: shares ?? [], views: views ?? [], defaultView, tuning: { ...SHIPPED_TUNING, ...tuning }, tileSize, atLargeText }),
    [shares, views, defaultView, tuning, tileSize, atLargeText]
  );
  const counted = (shares ?? []).length > 0;
  useToldSet(counted, useMemo(() => menusOpeningOnAll(small).join("\n"), [small]), setMenusOpeningOnAllCommand);
  useToldSet(counted, useMemo(() => menusDrawingNoGroups(small).join("\n"), [small]), setMenusDrawingNoGroupsCommand);

  /**
   * Escape, BBM's half: from the search field the open list, then the query, then the menu; from
   * anywhere else the menu. The menu goes by clearing the GAME's selection, so the close branch
   * below does the work and there is one route out. Capture phase, so a control inside the asset
   * menu cannot swallow it. See escapeAction.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.keyCode !== ESCAPE_KEY_CODE) {
        return;
      }

      const closeList = openListCloser();
      const action = escapeAction({
        assetMenuOpen,
        findItPanelShown,
        fieldFocused: isSearchField(event.target),
        listOpen: closeList !== null,
        queryTyped: (textInputText(event) ?? "").trim() !== "",
      });

      if (action === "closeList" || action === "clearQuery") {
        // The field's own Escape blurs it: stopped here, short of the field, it keeps the keys.
        event.stopPropagation();
        if (action === "closeList") closeList?.();
        else send(searchChangedCommand(""));
        return;
      }

      if (action === "closeMenu") {
        // The close goes first, so a blur that fails cannot lose it; the camera keys come back with
        // the menu, and a field left focused would keep them.
        trigger("toolbar", "clearAssetSelection");
        blurSearchField();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, assetMenuOpen, findItPanelShown]);

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
    // closing the moment a null arrives would dismiss the asset menu on every move
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
