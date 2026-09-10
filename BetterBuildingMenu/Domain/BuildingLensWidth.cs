namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The Building Lens assembly's width: the build menu plus the control plane
	/// beside it — what the layout lays out and what the resize handle drags.
	/// </summary>
	/// <remarks>
	/// Pure arithmetic, deliberately: here rather than in GridUtil, which forwards
	/// to it, so the numbers can be read from a test host without a live <c>World</c>.
	/// </remarks>
	public static class BuildingLensWidth
	{
		/// <summary>
		/// The widest the assembly may be dragged: the band left free beside the
		/// left-aligned tool columns, at the layout's reference resolution.
		/// </summary>
		public const float Max = 1441f;

		/// <summary>
		/// The narrowest the assembly may be dragged: any less and the control plane
		/// takes so much of it that what is left is no longer a grid.
		/// </summary>
		public const float Min = 1000f;

		/// <summary>What the control plane takes out of the assembly: its width plus the gap.</summary>
		/// <remarks>
		/// Duplicated from the UI's BUILDING_LENS_CONTROL_PANE_TOTAL. Nothing is shared
		/// across the C#/TS boundary, so a test keeps the two honest instead.
		/// </remarks>
		public const float ControlPane = 385f;

		public static float Clamp(float width)
		{
			return width < Min ? Min : width > Max ? Max : width;
		}

	}
}
