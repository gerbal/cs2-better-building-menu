import { bindValue, trigger, useValue } from "cs2/api";
import { useEffect, useRef } from "react";
import mod from "../../../mod.json";
import type { ToolbarEntity } from "domain/toolbarEntity";
import {
  setVanillaToolbarSelectionCommand,
  toolbarSelectionKey,
} from "domain/vanillaToolbarSelection";

const SelectedThemes$ = bindValue<ToolbarEntity[]>("toolbar", "selectedThemes", []);
const SelectedAssetPacks$ = bindValue<ToolbarEntity[]>("toolbar", "selectedAssetPacks", []);
const VanillaSelected$ = bindValue<boolean>("toolbar", "vanillaSelected", false);
const ModsSelected$ = bindValue<boolean>("toolbar", "modsSelected", false);

/**
 * Keeps the catalog in step with the game's own filter row.
 *
 * Renders nothing. The toolbar's theme, asset-pack and Vanilla/Mods buttons
 * filter the vanilla asset grid before it is drawn; the lens replaced that grid
 * and not the row, so those buttons changed vanilla's menu and did nothing to
 * ours. Reported as cm-2xvs.3, against the EU/NA toggle specifically.
 *
 * It forwards rather than filters. The rule is vanilla's own, transcribed in
 * C# as VanillaToolbarFilter and tested against ToolbarUISystem line by line —
 * a second, nicer rule here would be a menu that shows a different set from the
 * one it replaced.
 *
 * Nothing here knows what a theme or a pack is called. Entity indices go
 * across, and the backend matches them against what each asset requires, so a
 * theme or pack added by another mod is filtered correctly with no code change.
 * That was the constraint the user set when this was scoped: "we want to
 * support other filters dynamically added to the vanilla set by other mods".
 *
 * Mounted unconditionally, not inside the menu surface. The row can be changed
 * while no menu is open, and the next menu has to open already filtered.
 */
export const VanillaToolbarWatcher = () => {
  const themes = useValue(SelectedThemes$);
  const packs = useValue(SelectedAssetPacks$);
  const vanillaSelected = useValue(VanillaSelected$);
  const modsSelected = useValue(ModsSelected$);

  // The bindings re-emit on unrelated toolbar churn and emit current state on
  // subscribe. Every spurious forward costs a full catalog rebuild, so the
  // comparison is on the value rather than on the array identities, which
  // change every tick.
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const state = { themes, packs, vanillaSelected, modsSelected };
    const key = toolbarSelectionKey(state);

    if (key === lastKey.current) {
      return;
    }

    lastKey.current = key;

    const command = setVanillaToolbarSelectionCommand(state);
    trigger(mod.id, command.method, ...command.args);
  }, [themes, packs, vanillaSelected, modsSelected]);

  return null;
};
