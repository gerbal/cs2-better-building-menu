namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// How tall the asset menu's body is — one number the player sets by dragging, and the asset
	/// menu then keeps. The box is this and the chrome around it, 63.75 rem.
	/// </summary>
	/// <remarks>
	/// The UI clamps its drag with the same three numbers, generated from these into
	/// sharedContracts.generated.ts: see SharedContractsTests. The body draws at the box less the
	/// chrome the box draws, never below <see cref="Min"/>. See docs/design-notes.md, "The box's height".
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
		/// The body's height that makes the whole box as tall as the game's own build menu, 208, with
		/// the top row's band above it and the tab row's below.
		/// </summary>
		/// <remarks>
		/// The box is this height and 63.75 in every look. The player can drag it anywhere between Min
		/// and Max. A height an earlier release shipped as its default moves here once. See
		/// docs/design-notes.md, "The box's height".
		/// </remarks>
		public const float Default = 144.25f;

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
