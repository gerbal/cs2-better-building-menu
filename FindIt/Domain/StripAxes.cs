namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// The axes the menu strip can fall back to when vanilla gives a menu no
	/// categories of its own.
	/// </summary>
	/// <remarks>
	/// Strings rather than an enum because they cross the UI binding, where an
	/// enum would arrive as a number and the React side would need a second
	/// table to read it back.
	///
	/// Role is deliberately not here. BuildingType describes a simulation
	/// capability rather than the player's category, and the two come apart in
	/// ways that would mislead: the Water Treatment Plant's role is
	/// WaterPumpingStation, the Incineration Plant's is PowerPlant in a garbage
	/// menu, and pipes and lot tools have none at all. It stays a filter facet,
	/// where the player opts into it knowingly.
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
		/// A development branch is unique across its menu, so its tab id can be
		/// both what it matches and what it says. A tier cannot — "Low Density"
		/// is a tab under Residential, Commercial AND Office — and clicking a
		/// strip tab clears the category by design, so a bare tier would narrow
		/// to all three families at once while the count on the tab promised
		/// one.
		///
		/// The separator is a unit separator rather than a printable string,
		/// because zone category ids and tier labels are both free text and any
		/// visible delimiter is one asset name away from a collision.
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
