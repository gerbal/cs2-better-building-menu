import { bindValue, trigger, useValue } from "cs2/api";
import { useEffect, useRef } from "react";
import mod from "../../../mod.json";
import { parsePickerMenuRequest, toolbarEntityArg } from "domain/pickerMenuRequest";

const PickerMenuRequest$ = bindValue<string>(mod.id, "PickerMenuRequest", "");

/**
 * Opens the vanilla menu the picker asked for.
 *
 * Renders nothing. The picker resolves which menu holds the building the player
 * clicked, and publishes it here; this hands it to the game's own
 * `toolbar.selectAssetMenu`, which only the UI can call.
 *
 * Deliberately does NOT open the lens itself. Selecting the menu is enough:
 * the game mounts its asset menu, VanillaMenuWatcher sees the selection, and
 * the ordinary path scopes the lens to it. One route in, whether the player
 * clicked a toolbar icon or picked a building out of the world.
 *
 * Mounted alongside the other watchers rather than inside the menu surface,
 * because the whole point is that no surface exists yet when the request
 * arrives.
 */
export const PickerMenuOpener = () => {
  const raw = useValue(PickerMenuRequest$);
  const lastNonce = useRef<number | null>(null);

  useEffect(() => {
    const request = parsePickerMenuRequest(raw);

    if (!request || request.nonce === lastNonce.current) {
      return;
    }

    lastNonce.current = request.nonce;

    // "toolbar" is the game's own binding group, not ours — this is the same
    // trigger its asset-menu buttons call.
    trigger("toolbar", "selectAssetMenu", toolbarEntityArg(request));
  }, [raw]);

  return null;
};
