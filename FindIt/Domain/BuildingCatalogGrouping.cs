using System;
using System.Globalization;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// The ordering half of grouped views.
	/// </summary>
	/// <remarks>
	/// Grouping is a primary sort key, not a separate axis. With paging the two
	/// cannot be independent: grouping only the visible page splits a group
	/// across a page boundary, and then the heading lies about what it contains.
	/// So the query orders by these keys first and the player's chosen sort
	/// orders rows within each group.
	///
	/// This side produces <em>keys</em>, not headings — the UI derives the
	/// headings from the same fields. The only thing that has to hold is that a
	/// key is a function of the group, which makes every member of a group
	/// contiguous. The two sides may order groups differently relative to one
	/// another without breaking anything.
	///
	/// Banded dimensions therefore return a rank rather than the band's label:
	/// ordering "₡100k+" and "₡25k–₡100k" as text would put the expensive band
	/// first. Band edges are duplicated in `buildingGroups.ts` and asserted in
	/// both test suites.
	/// </remarks>
	public static class BuildingCatalogGrouping
	{
		public const string None = "none";
		public const string Category = "category";
		public const string SubCategory = "subCategory";
		public const string Role = "role";
		public const string Theme = "theme";
		public const string Source = "source";
		public const string Density = "density";
		public const string Footprint = "footprint";
		public const string Cost = "cost";

		/// <summary>Cost band edges. Mirrored in buildingGroups.ts.</summary>
		public static readonly double[] CostBands = { 5_000d, 25_000d, 100_000d };

		/// <summary>Footprint band edges, by the longer lot side. Mirrored in TS.</summary>
		public static readonly int[] FootprintBands = { 2, 4, 6 };

		/// <summary>
		/// Sorts after every ranked band, so entries with no value land together
		/// at the end instead of ahead of the cheapest band.
		/// </summary>
		private const string UnrankedKey = "9";

		public static bool IsGrouped(string? groupBy) =>
			!string.IsNullOrWhiteSpace(groupBy)
			&& !string.Equals(groupBy.Trim(), None, StringComparison.OrdinalIgnoreCase);

		/// <summary>
		/// Outermost group key. Empty when the dimension is unknown or "none",
		/// which leaves the ordering to the chosen sort alone.
		/// </summary>
		public static string PrimaryKey(BuildingCatalogEntry entry, string? groupBy)
		{
			if (entry is null || !IsGrouped(groupBy))
			{
				return string.Empty;
			}

			return groupBy!.Trim().ToLowerInvariant() switch
			{
				Category => Normalize(entry.Category),
				"subcategory" => Normalize(entry.SubCategory),
				Role => Normalize(entry.BuildingType),
				Theme => Normalize(entry.Theme),
				// The DLC name is the more specific answer where there is one.
				Source => Normalize(string.IsNullOrWhiteSpace(entry.DlcId) ? entry.Provenance : entry.DlcId),
				Density => entry.ZoneType.ToString(CultureInfo.InvariantCulture).PadLeft(3, '0'),
				Footprint => FootprintRank(entry.LotWidth, entry.LotDepth),
				Cost => CostRank(entry.ConstructionCost),
				_ => string.Empty,
			};
		}

		/// <summary>
		/// Second group level. Only Category has one — the subcategory beneath
		/// it, which is what keeps Category useful once the player has already
		/// navigated into a category and the outer heading says nothing.
		/// </summary>
		public static string SecondaryKey(BuildingCatalogEntry entry, string? groupBy)
		{
			if (entry is null || !IsGrouped(groupBy))
			{
				return string.Empty;
			}

			return string.Equals(groupBy!.Trim(), Category, StringComparison.OrdinalIgnoreCase)
				? Normalize(entry.SubCategory)
				: string.Empty;
		}

		public static string CostRank(double? cost)
		{
			if (!cost.HasValue || double.IsNaN(cost.Value) || double.IsInfinity(cost.Value))
			{
				return UnrankedKey;
			}

			for (int index = 0; index < CostBands.Length; index++)
			{
				if (cost.Value < CostBands[index])
				{
					return index.ToString(CultureInfo.InvariantCulture);
				}
			}

			return CostBands.Length.ToString(CultureInfo.InvariantCulture);
		}

		public static string FootprintRank(int width, int depth)
		{
			int longest = Math.Max(width, depth);

			if (longest <= 0)
			{
				return UnrankedKey;
			}

			for (int index = 0; index < FootprintBands.Length; index++)
			{
				if (longest <= FootprintBands[index])
				{
					return index.ToString(CultureInfo.InvariantCulture);
				}
			}

			return FootprintBands.Length.ToString(CultureInfo.InvariantCulture);
		}

		private static string Normalize(string? value) =>
			string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
	}
}
