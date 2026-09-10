namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// How tall the Building Lens catalog is drawn — one number the player sets
	/// by dragging, and the panel then keeps.
	/// </summary>
	public static class BuildingLensHeight
	{
		/// <summary>
		/// The shortest the catalog can be and still show two tile rows with their padding,
		/// rather than a sliver of a second row.
		/// </summary>
		public const float Min = 200f;

		/// <summary>
		/// The viewport less the toolbar and the chrome below the panel.
		/// </summary>
		/// <remarks>
		/// The cohtml layer renders at a fixed logical viewport at every resolution, so this is a
		/// constant rather than something to recompute per screen.
		/// </remarks>
		public const float Max = 960f;

		/// <summary>
		/// A useful working height rather than the shortest legal one.
		/// </summary>
		/// <remarks>
		/// Roughly five tile rows — enough for every view mode to be itself, since nothing grows the
		/// panel automatically — and the player can drag it anywhere between Min and Max.
		/// </remarks>
		public const float Default = 420f;

		public static float Clamp(float height)
		{
			// A non-finite height would propagate into an inline style and
			// leave the panel unsized, so it resolves to the default rather
			// than passing through the way a plain comparison would let it.
			if (float.IsNaN(height) || float.IsInfinity(height))
			{
				return Default;
			}

			return height < Min ? Min : height > Max ? Max : height;
		}
	}
}
