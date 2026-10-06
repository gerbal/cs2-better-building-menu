namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// How tall the asset menu catalog is drawn — one number the player sets
	/// by dragging, and the asset menu then keeps.
	/// </summary>
	/// <remarks>
	/// The UI clamps its drag with the same three numbers, generated from these into
	/// sharedContracts.generated.ts: see SharedContractsTests.
	/// </remarks>
	public static class AssetMenuHeight
	{
		/// <summary>
		/// The shortest the catalog can be and still show one row of cards whole under the
		/// deepest grouping a menu draws: the catalog padding, two heading reserves, the list
		/// padding and one card.
		/// </summary>
		public const float Min = 108f;

		/// <summary>
		/// The viewport less the toolbar and the chrome below the asset menu.
		/// </summary>
		/// <remarks>
		/// The cohtml layer renders at a fixed logical viewport at every resolution, so this is a
		/// constant rather than something to recompute per screen.
		/// </remarks>
		public const float Max = 960f;

		/// <summary>
		/// The catalog's share of the vanilla build menu: with the strip and header above it, the
		/// menu starts exactly as tall as the two-row menu it replaces.
		/// </summary>
		/// <remarks>
		/// Judged at the game's own text size and the default width. More rows are a drag of the top
		/// edge away, anywhere between Min and Max.
		/// </remarks>
		public const float Default = 155f;

		public static float Clamp(float height)
		{
			// A non-finite height would propagate into an inline style and
			// leave the asset menu unsized, so it resolves to the default rather
			// than passing through the way a plain comparison would let it.
			if (float.IsNaN(height) || float.IsInfinity(height))
			{
				return Default;
			}

			return height < Min ? Min : height > Max ? Max : height;
		}
	}
}
