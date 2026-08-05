export type BuildingLensMode = "catalog" | "tools";

export interface BuildingLensModeView {
  mode: BuildingLensMode;
  showCatalogNavigation: boolean;
  showCatalogContent: boolean;
  showToolsContent: boolean;
  showCatalogPaging: boolean;
}

/**
 * Catalog state lives in the C# query binding. The mode is only a shell view
 * concern, so switching it must not clear, rewrite, or otherwise reinterpret
 * the catalog query.
 */
export function getBuildingLensModeView(mode: BuildingLensMode): BuildingLensModeView {
  const isTools = mode === "tools";
  return {
    mode,
    showCatalogNavigation: !isTools,
    showCatalogContent: !isTools,
    showToolsContent: isTools,
    showCatalogPaging: !isTools,
  };
}
