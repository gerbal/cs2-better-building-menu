using FindItBuildingMenu.Domain.Enums;

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
		/// <summary>
		/// The game's own category — the tab strip's dimension.
		/// </summary>
		/// <remarks>
		/// Distinct from Category, which is OUR taxonomy (Buildings, Networks,
		/// ServiceBuildings). Grouping a scoped menu by that says almost nothing;
		/// grouping by the game's own categories reproduces the split the tab
		/// strip already shows, which is the model the player is holding.
		/// </remarks>
		public const string MenuCategory = "menuCategory";
		public const string SubCategory = "subCategory";
		public const string Role = "role";
		/// <summary>
		/// The tier a school grants, from SchoolData.m_EducationLevel.
		/// </summary>
		public const string SchoolTier = "schoolTier";
		public const string Theme = "theme";
		public const string Source = "source";
		public const string Density = "density";
		public const string Footprint = "footprint";
		public const string Cost = "cost";

		/// <summary>Cost band edges. Mirrored in buildingGroups.ts.</summary>
		public static readonly double[] CostBands = { 5_000d, 25_000d, 100_000d };

		/// <summary>Footprint band edges, by the longer lot side. Mirrored in TS.</summary>
		public static readonly int[] FootprintBands = { 2, 4, 6 };

		/// <summary>Density tiers in reading order. Mirrored in buildingGroups.ts.</summary>
		/// <remarks>
		/// An explicit table, because the enum's own values do not encode this
		/// order and never did. Low=1, Row=2, Medium=4, High=8 happened to sort
		/// correctly, which hid the fact that the rank was accidental — and the
		/// accident stops working the moment the vocabulary grows: Mixed=32 and
		/// LowRent=64 read between Medium and High but sort past Signature=16.
		///
		/// Row before Medium because row housing unlocks at milestone 1 and
		/// medium at 2 — measured against a live catalog, not assumed. LowRent
		/// immediately before High because it IS high density, whatever its
		/// name suggests.
		/// </remarks>
		public static readonly ZoneTypeFilter[] DensityOrder =
		{
			ZoneTypeFilter.Low,
			ZoneTypeFilter.Row,
			ZoneTypeFilter.Medium,
			ZoneTypeFilter.Mixed,
			ZoneTypeFilter.LowRent,
			ZoneTypeFilter.High,
			ZoneTypeFilter.Signature,
		};

		/// <summary>The sort key for one density tier. Untiered sorts last.</summary>
		public static string DensityRank(ZoneTypeFilter density)
		{
			var index = Array.IndexOf(DensityOrder, density);

			return index < 0 ? UnrankedKey : index.ToString(CultureInfo.InvariantCulture);
		}

		/// <summary>
		/// Sorts after every ranked band, so entries with no value land together
		/// at the end instead of ahead of the cheapest band.
		/// </summary>
		private const string UnrankedKey = "9";

		/// <summary>
		/// Sorts after every real name, so the "Other" heading lands at the end.
		/// </summary>
		/// <remarks>
		/// An empty key sorts first, which put OTHER above every named group —
		/// grouping Police &amp; Administration by role opened on the six
		/// buildings that have no role. Same reasoning as
		/// <see cref="UnrankedKey"/>, applied to the text dimensions.
		/// </remarks>
		private const string UnnamedKey = "\uFFFD";

		public static bool IsGrouped(string? groupBy) =>
			!string.IsNullOrWhiteSpace(groupBy)
			&& !string.Equals(groupBy.Trim(), None, StringComparison.OrdinalIgnoreCase);

		/// <summary>
		/// Outermost group key. Empty when the dimension is unknown or "none",
		/// which leaves the ordering to the chosen sort alone.
		/// </summary>
		/// <remarks>
		/// Matched with <see cref="Is"/> rather than by lowercasing and
		/// switching on the constants. That is not style: this WAS a
		/// <c>groupBy.ToLowerInvariant() switch</c> over the constants, so any
		/// dimension whose id is not already all-lowercase could never match its
		/// own case and fell through to the empty key. SubCategory papered over
		/// it with a hand-written <c>"subcategory"</c> literal; MenuCategory,
		/// added later, did not — so grouping by the game's category emitted no
		/// ordering key at all and the UI grouped whatever order arrived.
		///
		/// It looked right on screen because buildGroupedView appends to a node
		/// it has already created, so non-contiguous members still land under
		/// one heading with the right count. What it cost was paging: a group
		/// split across a page boundary is exactly the failure the
		/// group-as-sort-key design exists to prevent.
		/// </remarks>
		public static string PrimaryKey(BuildingCatalogEntry entry, string? groupBy)
		{
			if (entry is null || !IsGrouped(groupBy))
			{
				return string.Empty;
			}

			string dimension = groupBy!.Trim();

			if (Is(dimension, Category)) return Normalize(entry.Category);
			if (Is(dimension, MenuCategory)) return MenuCategoryRank(entry.UiCategory, entry.UiCategoryPriority);
			if (Is(dimension, SubCategory)) return Normalize(entry.SubCategory);
			if (Is(dimension, Role)) return Normalize(entry.BuildingType);
			if (Is(dimension, SchoolTier)) return SchoolTierRank(entry.EducationLevel);
			if (Is(dimension, Theme)) return Normalize(entry.Theme);
			// The DLC name is the more specific answer where there is one.
			if (Is(dimension, Source)) return Normalize(string.IsNullOrWhiteSpace(entry.DlcId) ? entry.Provenance : entry.DlcId);
			// Was the raw enum value, zero-padded. See DensityOrder for why that
			// could not survive two new members.
			if (Is(dimension, Density)) return DensityRank(entry.ZoneType);
			if (Is(dimension, Footprint)) return FootprintRank(entry.LotWidth, entry.LotDepth);
			if (Is(dimension, Cost)) return CostRank(entry.ConstructionCost);

			return string.Empty;
		}

		private static bool Is(string value, string dimension) =>
			string.Equals(value, dimension, StringComparison.OrdinalIgnoreCase);

		/// <summary>The menu whose tier is what an asset IS, not when it unlocks.</summary>
		/// <remarks>Mirrored as isTransitMenu in buildingGroups.ts.</remarks>
		private static bool IsTransitMenu(string? menu) =>
			!string.IsNullOrEmpty(menu)
			&& menu!.IndexOf("Transportation", StringComparison.OrdinalIgnoreCase) >= 0;

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

			var dimension = groupBy!.Trim();

			if (Is(dimension, Category))
			{
				return Normalize(entry.SubCategory);
			}

			// The tier beneath the game's own category. Without a key here the
			// tier would only be a HEADING, and grouping is a primary sort key
			// precisely so a group cannot straddle a page boundary — the
			// heading would then describe something other than what follows it.
			//
			// Three sources, mirroring categoryTierLabel in buildingGroups.ts.
			// Each menu is homogeneous, so a category never mixes them; the
			// prefixes only keep the three from colliding if one ever did.
			if (Is(dimension, MenuCategory))
			{
				// Signature is a marker, not a density: every signature building
				// carries it, so taking it here would collapse all of them into
				// one child and never reach the milestone that does vary.
				if (entry.ZoneType != ZoneTypeFilter.Any && entry.ZoneType != ZoneTypeFilter.Signature)
				{
					return "d" + DensityRank(entry.ZoneType);
				}

				// Transit before the branch, because it HAS branches and they
				// divide nothing: measured live, {Road, Train, Tram} against
				// categories {TransportationRoad, TransportationTrain,
				// TransportationTram} is one to one. Its subcategory is the real
				// split — tracks, stops, lines, and the stations themselves.
				if (IsTransitMenu(entry.UiMenu))
				{
					return "s" + Normalize(entry.SubCategory);
				}

				// Depth first, so the branches read in the order the game's own
				// development tree lays them out rather than alphabetically.
				if (!string.IsNullOrWhiteSpace(entry.DevTreeBranch))
				{
					return "b"
						+ entry.DevTreeBranchDepth.ToString("D3", CultureInfo.InvariantCulture)
						+ Normalize(entry.DevTreeBranch);
				}

				return "m" + entry.UnlockMilestone.ToString("D3", CultureInfo.InvariantCulture);
			}

			return string.Empty;
		}

		/// <summary>
		/// Orders category groups the way the game orders the tabs above them.
		/// </summary>
		/// <remarks>
		/// Grouping by the game's category used to key on the raw prefab name,
		/// which sorted the headings alphabetically while the tab strip beside
		/// them ran in the game's order. Two organisations of the same assets,
		/// disagreeing on screen at the same time.
		///
		/// Vanilla sorts a menu's categories by UIObject.m_Priority ascending
		/// with no tiebreak at all — ToolbarUISystem.GetSortedCategories calls
		/// Sort() on UIObjectInfo, whose comparator is
		/// <c>priority.CompareTo(other.priority)</c>.
		///
		/// The name still has to be part of the key even though vanilla does not
		/// compare it. A key must be a function of the group: two categories
		/// sharing a priority would otherwise share a key, their members would
		/// interleave, and the UI would draw the same heading twice around the
		/// gap.
		/// </remarks>
		public static string MenuCategoryRank(string? category, int priority)
		{
			if (string.IsNullOrWhiteSpace(category))
			{
				return UnnamedKey;
			}

			// Priority is a signed int, so shift it into an unsigned range
			// before padding. Zero-padding it as-is would sort every negative
			// priority after every positive one, and "-100" ahead of "-99".
			long rank = (long)priority - int.MinValue;

			// A separator below every character a prefab name can hold, so a
			// name that is another name's prefix cannot outrank it.
			return rank.ToString("D10", CultureInfo.InvariantCulture)
				+ ' '
				+ category.Trim();
		}

		/// <summary>
		/// Orders school tiers as a school career runs, not as the alphabet does.
		/// </summary>
		/// <remarks>
		/// SchoolLevel { Elementary = 1, HighSchool, College, University,
		/// Outside } — a 1-based tier index, so the value already ranks itself
		/// and only needs padding to sort as text.
		///
		/// Everything outside 1..4 is unranked: 0 is a school upgrade that adds
		/// capacity without a tier, 5 is the outside connection, and null is
		/// every building in the catalog that is not a school. All three belong
		/// in one "Other" group at the end, which is what UnrankedKey does.
		///
		/// The labels are never compared here. "College" and "High School"
		/// alphabetise into the wrong career order, which is the whole reason
		/// this ranks rather than naming — same as CostRank.
		/// </remarks>
		public static string SchoolTierRank(int? level)
		{
			if (!level.HasValue || level.Value < 1 || level.Value > 4)
			{
				return UnrankedKey;
			}

			return level.Value.ToString(CultureInfo.InvariantCulture);
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
			string.IsNullOrWhiteSpace(value) ? UnnamedKey : value.Trim();
	}
}
