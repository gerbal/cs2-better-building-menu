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

        internal static float GetBuildingLensWidth()
        {
            return ClampBuildingLensWidth(Mod.Settings.BuildingLensPanelWidth);
        }

        internal static float GetCurrentPanelWidth()
        {
            if (_findItUISystem.BuildingLensEnabled)
            {
                // Maximise and restore, not a floor.
                //
                // This used to return max(savedWidth, BuildingLensExpandedWidth)
                // against a fixed 1005f while the resize handle clamps to
                // BuildingLensMaxWidth (1200f). Any panel the player had already
                // dragged past 1005 made the button permanently inert: it swapped
                // its own icon, took the selected treatment, and changed the width
                // by nothing at all — verified live at a saved width of 1042.
                //
                // Restoring reads the saved width back, which is the width the
                // player last chose by hand, because CommitBuildingLensPanelWidth
                // only writes the setting on a drag.
                return _findItUISystem.IsExpanded
                    ? BuildingLensMaxWidth
                    : GetBuildingLensWidth();
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
