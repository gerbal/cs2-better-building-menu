using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Utilities
{
    internal static class GridUtil
    {
        internal static float GetCurrentAssetMenuWidth()
        {
            // The band the asset menu may fill, between vanilla's options column on
            // the left and the social column on the right. The build menu's own
            // width, which the player drags, is resolved inside it by the UI.
            return AssetMenuWidth.Max;
        }
    }
}
