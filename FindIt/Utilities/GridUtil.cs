using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Systems;
using System;

using Unity.Entities;

namespace FindItBuildingMenu.Utilities
{
    internal static class GridUtil
    {
        // Forwarded from Domain/BuildingLensWidth, which owns the arithmetic.
        // It lives there because this class resolves a live World system in a
        // static initialiser, so a test touching any member of it throws before
        // the test body runs.
        internal const float BuildingLensMinWidth = BuildingLensWidth.Min;
        internal const float BuildingLensMaxWidth = BuildingLensWidth.Max;
        internal const float LensControlPaneWidth = BuildingLensWidth.ControlPane;

        private static readonly FindItUISystem _findItUISystem = World.DefaultGameObjectInjectionWorld.GetExistingSystemManaged<FindItUISystem>();

        internal static float ClampBuildingLensWidth(float width)
        {
            return BuildingLensWidth.Clamp(width);
        }

        internal static float GetCurrentPanelWidth()
        {
            if (_findItUISystem.BuildingLensEnabled)
            {
                // One width, and it is not a choice.
                //
                // The lens fills the band: vanilla's options column on the left,
                // the social column on the right, nothing spare. It used to be a
                // saved setting the player dragged, and the drag went when
                // left-aligning vanilla's column trio made the band a single
                // correct width — narrower than that is only giving space back.
                //
                // Reading a setting nothing could write left the panel wherever
                // the last drag had happened to leave it: measured at 961px
                // against a 984px band, 23px short with no way for anyone to
                // notice or fix it.
                //
                // The IsExpanded branch went too. It chose a WIDTH from a flag
                // that now only means height, and only for the legacy panel.
                return BuildingLensWidth.Max;
            }

            return GetWidth();
        }

        internal static float GetCurrentColumnCount()
        {
            var width = GetWidth();
            var itemWidth = _findItUISystem.ViewStyle switch
            {
                "GridWithText" => 113f,
                "GridNoText" => 100f,
                "GridSmall" => 64f,
                _ => float.MaxValue
            };

            return (float)Math.Max(1, Math.Floor(width / itemWidth));
        }

        internal static float GetWidth()
        {
            if (_findItUISystem.AlignmentStyle != "Center")
            {
                return 150 + Mod.Settings.RightColumnSize * 8.5f;
            }

            return 325 + (_findItUISystem.IsExpanded ? Mod.Settings.ExpandedColumnSize : Mod.Settings.ColumnSize) * 8.5f;
        }

        internal static float GetItemWidth()
        {
            var width = GetWidth();
            var columns = GetCurrentColumnCount();

            return (width - 15) / columns;
        }

        internal static float GetCurrentRowCount()
        {
            var height = GetHeight();
            var itemHeight = _findItUISystem.ViewStyle switch
            {
                "GridWithText" => 98f,
                "GridNoText" => GetItemWidth() + 4,
                "GridSmall" => GetItemWidth() + 2,
                "ListSimple" => 22.5f,
                _ => float.MaxValue
            };

            return (float)Math.Max(0.1, height / itemHeight);
        }

        internal static float GetHeight()
        {
            return 100 + (_findItUISystem.AlignmentStyle != "Center" ? Mod.Settings.RightRowSize * 2.5f : _findItUISystem.IsExpanded ? Mod.Settings.ExpandedRowSize : Mod.Settings.RowSize) * 2.5f;
        }

        internal static float GetScrollMultiplier()
        {
            var multiplier = _findItUISystem.AlignmentStyle != "Center" ? 2.5f : 1f;

            return multiplier * _findItUISystem.ViewStyle switch
            {
                "GridSmall" => _findItUISystem.AlignmentStyle != "Center" ? 12f : 4f,
                "ListSimple" => GetHeight() / 12f,
                _ => _findItUISystem.AlignmentStyle != "Center" ? 5f : 2f
            };
        }
    }
}
