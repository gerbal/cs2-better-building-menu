import { useValue } from "cs2/api";
import { useEffect, useRef } from "react";
import {
  setVanillaToolbarSelectionCommand,
  toolbarSelectionKey,
} from "domain/vanillaToolbarSelection";
import { ModsSelected$, SelectedAssetPacks$, SelectedThemes$, VanillaSelected$, send } from "mods/bindings";

/**
 * Keeps the catalog in step with the game's own filter row; renders nothing. It
 * FORWARDS entity indices rather than filtering — the rule is C#'s — so a theme
 * another mod adds needs no code change here. Mounted unconditionally.
 */
export const VanillaToolbarWatcher = () => {
  const themes = useValue(SelectedThemes$);
  const packs = useValue(SelectedAssetPacks$);
  const vanillaSelected = useValue(VanillaSelected$);
  const modsSelected = useValue(ModsSelected$);

  // The bindings re-emit on unrelated toolbar churn and emit current state on
  // subscribe, and every spurious forward costs a full catalog rebuild — so
  // this compares the VALUE, not the array identities, which change each tick.
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const state = { themes, packs, vanillaSelected, modsSelected };
    const key = toolbarSelectionKey(state);

    if (key === lastKey.current) {
      return;
    }

    lastKey.current = key;

    send(setVanillaToolbarSelectionCommand(state));
  }, [themes, packs, vanillaSelected, modsSelected]);

  return null;
};
