namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// How tall the Building Lens catalog is drawn — one number the player sets
	/// by dragging, and the panel then keeps.
	/// </summary>
	/// <remarks>
	/// It replaces a binary. The panel used to rest at a 200rem strip and jump
	/// to a near-full-screen "expanded", with an automatic floor raising it
	/// whenever the result set was unscoped, and the content sizing it in
	/// between — so the same menu was measured at 163px, 425px and 529px within
	/// one session depending on what was in it. A height the player sets is
	/// stable, which is what a menu you aim at with the mouse needs to be.
	///
	/// The old binary also leaked: the catalog forced grid mode whenever the
	/// panel was not expanded, because a table at strip height is a sliver.
	/// With a height the player controls, that override had nothing left to
	/// protect and is gone.
	/// </remarks>
	public static class BuildingLensHeight
	{
		/// <summary>
		/// Two tile rows plus their padding — what the old strip measured, and
		/// the shortest the catalog can be and still show a row of results
		/// rather than a sliver of one.
		/// </summary>
		/// <remarks>
		/// 2 tiles * 80rem + 4rem gap + 16rem catalog padding + 12rem tile-row
		/// padding = 192rem, so 200 carries 8rem of slack. Anything below this
		/// clips the second row; see mainContainer.module.scss.
		/// </remarks>
		public const float Min = 200f;

		/// <summary>
		/// What the old expanded state resolved to: the viewport less the
		/// toolbar and chrome below the panel.
		/// </summary>
		/// <remarks>
		/// 100vh is 1080rem — the cohtml layer renders at a fixed 1280x720
		/// logical viewport at every resolution, so this is a constant rather
		/// than something to recompute per screen. Less the 120rem the old
		/// `calc(100vh - 120rem)` reserved.
		/// </remarks>
		public const float Max = 960f;

		/// <summary>
		/// A useful working height rather than the shortest legal one.
		/// </summary>
		/// <remarks>
		/// The strip was only ever the resting half of a toggle, and it is a
		/// poor standing default now that nothing automatically grows it: two
		/// rows is not a list, a table or a set of cards. This is roughly five
		/// tile rows — enough for every view mode to be itself — and the player
		/// can drag it anywhere between Min and Max.
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
