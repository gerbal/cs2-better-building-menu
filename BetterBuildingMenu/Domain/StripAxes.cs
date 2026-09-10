namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The axes the menu strip can fall back to when vanilla gives a menu no
	/// categories of its own.
	/// </summary>
	/// <remarks>
	/// Strings rather than an enum because they cross the UI binding, where an enum
	/// would arrive as a number. Role is deliberately absent: BuildingType is a
	/// simulation capability, not the player's category, so it stays a filter facet.
	/// </remarks>
	public static class StripAxes
	{
		/// <summary>Vanilla's own categories. Not a fallback — the reference.</summary>
		public const string Category = "category";

		/// <summary>The service's development tree, by branch.</summary>
		public const string Development = "development";

		/// <summary>Buildings against networks.</summary>
		public const string AssetType = "assetType";

		/// <summary>A zone family's density tiers, drawn in its place.</summary>
		public const string Density = "density";

		public const string BuildingValue = "Buildings";
		public const string NetworkValue = "Networks";

		/// <summary>
		/// A density tab's match key: its family and its tier together.
		/// </summary>
		/// <remarks>
		/// A tier alone cannot be both the match key and the label — "Low Density" is a
		/// tab under three families, and a tab click clears the category — so the family
		/// rides along. The separator is unprintable: a visible one could collide.
		/// </remarks>
		public static class DensityTab
		{
			private const char Separator = '';

			public static string Format(string category, string tier) =>
				$"{category}{Separator}{tier}";

			/// <summary>Splits a tab id, or false when it is not one of ours.</summary>
			public static bool TryParse(string? tab, out string category, out string tier)
			{
				category = string.Empty;
				tier = string.Empty;

				if (string.IsNullOrEmpty(tab))
				{
					return false;
				}

				var at = tab!.IndexOf(Separator);

				if (at <= 0 || at == tab.Length - 1)
				{
					return false;
				}

				category = tab.Substring(0, at);
				tier = tab.Substring(at + 1);

				return true;
			}
		}
	}
}
