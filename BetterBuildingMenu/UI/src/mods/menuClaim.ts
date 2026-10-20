import { nextClaim, type MenuClaim, type OwnedAssetMenu } from "domain/menuOwnership";
import { toolbarEntityIndex } from "domain/vanillaMenuWatch";
import { OwnedAssetMenus$, SelectedAssetMenu$ } from "mods/bindings";

/**
 * The claim on the toolbar's open menu (see MenuClaim), kept from the bindings
 * themselves rather than from a render: the asset menu's extension point renders
 * only while a menu is open, so it never sees the selection go back to none
 * between two opens of the same menu. The first emission is the state on
 * subscribe, which VanillaMenuWatcher ignores too, so it never claims.
 */
let claim: MenuClaim | null = null;
let owned: readonly OwnedAssetMenu[] = [];

OwnedAssetMenus$.subscribe((next) => {
  owned = next ?? [];
});

SelectedAssetMenu$.subscribe((entity) => {
  claim = nextClaim(claim, toolbarEntityIndex(entity), owned);
});

/** The claim as of the latest selection; unclaimable before the first. */
export function currentMenuClaim(): MenuClaim {
  return claim ?? { index: null, claimable: false };
}
