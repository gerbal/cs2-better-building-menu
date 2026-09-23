namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The Building Lens assembly's width: the build menu plus the control plane
	/// beside it.
	/// </summary>
	/// <remarks>
	/// Pure arithmetic, deliberately: here rather than in GridUtil, which reads it,
	/// so the numbers can be read from a test host without a live <c>World</c>.
	/// </remarks>
	public static class BuildingLensWidth
	{
		/// <summary>
		/// The assembly's width: the band left free beside the left-aligned tool
		/// columns, at the layout's reference resolution.
		/// </summary>
		public const float Max = 1441f;

		/// <summary>What the control plane takes out of the assembly: its width plus the gap.</summary>
		/// <remarks>
		/// Duplicated from the UI's $pane-width and $pane-gap in _lensGeometry.scss,
		/// whose sum buildingLensLayout.ts reads as BUILDING_LENS_CONTROL_PANE_TOTAL.
		/// Nothing is shared across the C#/UI boundary, so a test keeps the two honest.
		/// </remarks>
		public const float ControlPane = 385f;
	}
}
