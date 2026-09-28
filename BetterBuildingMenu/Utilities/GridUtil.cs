using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Utilities
{
    internal static class GridUtil
    {
        internal static float GetCurrentAssetMenuWidth()
        {
            // One width, and it is not a choice: the asset menu fills the band between
            // vanilla's options column on the left and the social column on the
            // right, so anything narrower is only giving space back.
            return AssetMenuWidth.Max;
        }
    }
}
