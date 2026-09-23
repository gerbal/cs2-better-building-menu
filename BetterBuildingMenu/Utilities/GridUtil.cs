using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Utilities
{
    internal static class GridUtil
    {
        internal static float GetCurrentPanelWidth()
        {
            // One width, and it is not a choice: the lens fills the band between
            // vanilla's options column on the left and the social column on the
            // right, so anything narrower is only giving space back.
            return BuildingLensWidth.Max;
        }
    }
}
