using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Utilities
{
    internal static class GridUtil
    {
        internal static float GetCurrentAssetMenuWidth()
        {
            // The band the asset menu may fill, between vanilla's options column on
            // the left and the social column on the right, less the UI's chrome. The
            // UI fits it to the text scale and resolves the build menu's width in it.
            return AssetMenuWidth.Max;
        }
    }
}
