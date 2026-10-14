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
		/// A release of a height drag: the height kept, and a collapsed box opened where <paramref name="opens"/> says
		/// so, as a release that lands from the build menu's collapsed box does; the upgrades panel's never opens it.
		/// True when either moved, which is when it saves, once.
		/// </summary>
		public static bool Commit(ISettingsValues values, float height, bool opens)
		{
			var opened = opens && values.AssetMenuCollapsed;

			if (Math.Abs(values.AssetMenuHeight - height) < Unmoved && !opened)
			{
				return false;
			}

			values.AssetMenuHeight = height;

			if (opened)
			{
				values.AssetMenuCollapsed = false;
			}

			return true;
		}

		/// <summary>
		/// A double press on the top edge: the game's own size, the body at its default and the first Width step, open.
		/// A height within a release's tolerance of the default already is it, as <see cref="Commit"/> reads it, and is
		/// kept. True when any of the three moved, which is when it saves.
		/// </summary>
		public static bool Restore(ISettingsValues values)
		{
			var heightMoved = Math.Abs(values.AssetMenuHeight - AssetMenuHeight.Default) >= Unmoved;
			var moved = heightMoved
				|| values.AssetMenuWidthStep != WidthSteps.DefaultStep
				|| values.AssetMenuCollapsed;

			if (heightMoved)
			{
				values.AssetMenuHeight = AssetMenuHeight.Default;
			}

			values.AssetMenuWidthStep = WidthSteps.DefaultStep;
			values.AssetMenuCollapsed = false;

			return moved;
		}
	}
}
