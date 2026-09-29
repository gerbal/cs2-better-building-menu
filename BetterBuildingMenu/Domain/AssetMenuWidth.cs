namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The asset menu assembly's width: the build menu plus the control plane
	/// beside it.
	/// </summary>
	/// <remarks>
	/// Pure arithmetic, deliberately: here rather than in GridUtil, which reads it,
	/// so the numbers can be read from a test host without a live <c>World</c>.
	/// </remarks>
	public static class AssetMenuWidth
	{
		/// <summary>
		/// The assembly's width: the band left free beside the left-aligned tool
		/// columns, at the layout's reference resolution.
		/// </summary>
		/// <remarks>The UI's copy is generated from this: see SharedContractsTests.</remarks>
		public const float Max = 1441f;

		/// <summary>What the control plane takes out of the assembly: its width plus the gap.</summary>
		/// <remarks>
		/// Duplicated from the UI's $pane-width and $pane-gap in _assetMenuGeometry.scss,
		/// whose sum assetMenuLayout.ts reads as CONTROL_PANE_TOTAL.
		/// The stylesheet draws the pane, so it holds the numbers and a test keeps this
		/// copy honest.
		/// </remarks>
		public const float ControlPane = 385f;
	}
}
