namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The build menu's width as the player sets it by dragging its right edge, or
	/// "fill".
	/// </summary>
	/// <remarks>
	/// Only kept well-formed here. Which width is drawn depends on whether the control
	/// pane is shown, so the UI resolves it (assetMenuLayout.ts, resolveCatalogWidth).
	/// The numbers reach it through sharedContracts.generated.ts: see SharedContractsTests.
	/// </remarks>
	public static class AssetMenuCatalogWidth
	{
		/// <summary>
		/// The narrowest the build menu draws: the old panel minimum, at which the header
		/// and a row of cards still fit.
		/// </summary>
		public const float Min = 735f;

		/// <summary>Not a width: the build menu takes all the room the row has.</summary>
		/// <remarks>
		/// The default, and the layout from before the width could change. Zero, because no
		/// real width is zero, so a settings file written before this existed reads as fill.
		/// </remarks>
		public const float Fill = 0f;

		/// <summary>How near the room a drag must end to be stored as fill.</summary>
		public const float FillSnap = 2f;

		/// <summary>
		/// A width fit to keep: anything that is not a width is fill, a width below the
		/// minimum is the minimum, and any other is kept for the UI to fit to the room.
		/// </summary>
		public static float Sanitize(float width)
		{
			if (float.IsNaN(width) || float.IsInfinity(width) || width <= Fill)
			{
				return Fill;
			}

			return width < Min ? Min : width;
		}
	}
}
