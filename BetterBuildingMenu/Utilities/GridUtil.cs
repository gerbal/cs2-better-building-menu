using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Utilities
{
    internal static class GridUtil
    {
        // Forwarded from Domain/BuildingLensWidth, which owns the arithmetic.
        internal const float BuildingLensMinWidth = BuildingLensWidth.Min;
        internal const float BuildingLensMaxWidth = BuildingLensWidth.Max;
        internal const float LensControlPaneWidth = BuildingLensWidth.ControlPane;

        internal static float GetCurrentPanelWidth()
        {
            // One width, and it is not a choice: the lens fills the band between
            // vanilla's options column on the left and the social column on the
            // right, so anything narrower is only giving space back.
            return BuildingLensWidth.Max;
        }
    }
}
