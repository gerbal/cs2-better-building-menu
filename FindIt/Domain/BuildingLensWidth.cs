namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// The Building Lens assembly's width: the build menu and the control plane
	/// beside it, which is what the layout lays out and what the resize handle
	/// drags.
	/// </summary>
	/// <remarks>
	/// Pure arithmetic, deliberately. It lives here rather than in GridUtil
	/// because GridUtil resolves a live <c>World</c> system in a static
	/// initialiser, so touching any member of it from a test host throws before
	/// the test body runs. GridUtil forwards to this.
	/// </remarks>
	public static class BuildingLensWidth
	{
		/// <summary>
		/// The band, measured at 1280x720.
		/// </summary>
		/// <remarks>
		/// It used to start at 399px, where vanilla's tool-side-column ended
		/// when tool-layout centred its column trio, giving 845px to the social
		/// column at 1248. With the lens open that trio is left-aligned, so the
		/// options column now ends at 260 and the band starts at 264 — 984px.
		/// At 0.6667px per rem that is 1476rem, less the 35rem MainContainer
		/// adds on top of this value.
		///
		/// Widening the ceiling needs no migration. A saved width still means
		/// the same thing it did — the assembly, pane included — so every
		/// existing value stays valid and simply has more room to grow into.
		/// That is the difference between this change and the one
		/// <see cref="Migrate"/> exists for, which altered what the number meant.
		/// </remarks>
		public const float Max = 1441f;

		/// <summary>
		/// Raised from 700 when the control plane arrived: 700 left the grid
		/// 315rem once the pane took its share, which is barely three tiles wide
		/// and not a grid.
		/// </summary>
		public const float Min = 1000f;

		/// <summary>
		/// What the control plane takes out of the assembly: its own 379rem plus
		/// a 6rem gap.
		/// </summary>
		/// <remarks>
		/// Duplicated from LENS_CONTROL_PANE_TOTAL in LensControlPane.tsx. There
		/// is no shared source across the C#/TS boundary, so the two are kept
		/// honest by a test rather than by construction — the same arrangement
		/// the grouping band edges already use.
		/// </remarks>
		public const float ControlPane = 385f;

		public static float Clamp(float width)
		{
			return width < Min ? Min : width > Max ? Max : width;
		}

	}
}
