using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The box's size as the settings keep it: its body's height, its Width step, and whether it is collapsed to its
	/// top row and tabs.
	/// </summary>
	/// <remarks>Pure, over <see cref="ISettingsValues"/>. See docs/design-notes.md, "The top edge".</remarks>
	public static class AssetMenuSize
	{
		/// <summary>How far a released height must move from the stored one to be saved, in rem.</summary>
		private const float Unmoved = 0.1f;

		/// <summary>
		/// A release of a height drag: the height kept, and a collapsed box opened, as the release that lands from one
		/// opens it. True when either moved, which is when it saves, once.
		/// </summary>
		public static bool Commit(ISettingsValues values, float height)
		{
			if (Math.Abs(values.AssetMenuHeight - height) < Unmoved && !values.AssetMenuCollapsed)
			{
				return false;
			}

			values.AssetMenuHeight = height;
			values.AssetMenuCollapsed = false;

			return true;
		}

		/// <summary>
		/// A double press on the top edge: the game's own size, the body at its default and the first Width step, open.
		/// True when any of the three moved, which is when it saves.
		/// </summary>
		public static bool Restore(ISettingsValues values)
		{
			var moved = !values.AssetMenuHeight.Equals(AssetMenuHeight.Default)
				|| values.AssetMenuWidthStep != WidthSteps.DefaultStep
				|| values.AssetMenuCollapsed;

			values.AssetMenuHeight = AssetMenuHeight.Default;
			values.AssetMenuWidthStep = WidthSteps.DefaultStep;
			values.AssetMenuCollapsed = false;

			return moved;
		}
	}
}
