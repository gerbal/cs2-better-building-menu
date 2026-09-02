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
            // One width, and it is not a choice.
            //
            // The lens fills the band: vanilla's options column on the left, the
            // social column on the right, nothing spare. It used to be a saved
            // setting the player dragged, and the drag went when left-aligning
            // vanilla's column trio made the band a single correct width —
            // narrower than that is only giving space back.
            //
            // Reading a setting nothing could write left the panel wherever the
            // last drag had happened to leave it: measured at 961px against a
            // 984px band, 23px short with no way for anyone to notice or fix it.
            //
            // The IsExpanded branch went too. It chose a WIDTH from a flag that
            // now only means height, and only for the legacy panel.
            //
            // The `BuildingLensEnabled` branch went with the latch: it fell back
            // to GetWidth() — the legacy grid's own width — for a state the lens
            // no longer has, since it replaces vanilla's menu rather than
            // offering an alternative to it.
            return BuildingLensWidth.Max;
        }
    }
}
