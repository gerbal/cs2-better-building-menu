import { createContext, useContext } from "react";

/**
 * Whether the kept build menu is in the document. Hidden, it is still mounted
 * (see KeptAssetMenu), so anything that measures, polls or patches the page
 * waits for this. Outside the kept menu, as in a test, the menu is shown.
 */
export const AssetMenuShownContext = createContext(true);

export const useAssetMenuShown = (): boolean => useContext(AssetMenuShownContext);
