using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace BetterBuildingMenu.Domain
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
		public const string Progression = "progression";
		public const string Development = "development";

		/// <summary>Every dimension the picker offers, by id, in the picker's order.</summary>
		public static readonly string[] Dimensions =
		{
			MenuCategory, Category, SubCategory, Role, SchoolTier, Progression, Development, Theme, Source, Density, Footprint, Cost, None,
		};

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

		public static bool IsDimension(string? value) =>
			!string.IsNullOrWhiteSpace(value)
			&& Array.Exists(Dimensions, dimension => Is(value!.Trim(), dimension));

		/// <summary>
		/// What a menu opens grouped by when the player has not chosen.
		/// </summary>
		/// <remarks>
		/// Moved from buildingGroups.ts's defaultGroupDimensionFor, where it
		/// was re-derived by two components and pushed back to this side in an
		/// effect — the second refresh on every first open of a menu. The
		/// strip and the headings answer the same question, so they should not
		/// open on different answers: the education menu draws school LEVELS in
		/// its category's place, so it is asked first; a menu with categories
		/// of its own groups by them whatever axis the strip derived
		/// (cm-2xvs.23); otherwise the strip's axis decides.
		/// </remarks>
		public static string DefaultDimension(bool menuHasCategories, string? stripAxis, bool educationMenu)
		{
			if (educationMenu) return SchoolTier;
			if (menuHasCategories) return MenuCategory;

			var axis = stripAxis?.Trim() ?? string.Empty;
			if (Is(axis, StripAxes.Development)) return Development;
			if (Is(axis, StripAxes.AssetType)) return Category;

			return Category;
		}

		/// <summary>The choice when there is one, otherwise the default. Empty means auto.</summary>
		public static string Effective(string? choice, bool menuHasCategories, string? stripAxis, bool educationMenu) =>
			IsDimension(choice) ? choice!.Trim() : DefaultDimension(menuHasCategories, stripAxis, educationMenu);

		/// <summary>
		/// <see cref="Effective(string?, bool, string?, bool)"/>, held to the
		/// dimensions the menu actually offers.
		/// </summary>
		/// <remarks>
		/// Seen live (cm-jjlv.12): the game's Electricity menu has one category,
		/// so the default was menuCategory while <see cref="OfferedDimensions"/>
		/// had dropped it for putting the whole menu in one bucket — the lens
		/// opened on a grouping its own picker did not list. A choice can be
		/// unoffered too: School tier chosen on Education, then Roads opened,
		/// grouped every road under "Other". Either way the answer is the first
		/// of the same candidates that can act here: the menu's default, then
		/// the strip's axis without the categories, then the picker's first
		/// offered grouping, then none. <paramref name="offered"/> empty means
		/// "not judged yet" and the plain rule stands.
		/// </remarks>
		public static string Effective(
			string? choice,
			bool menuHasCategories,
			string? stripAxis,
			bool educationMenu,
			IReadOnlyCollection<string> offered)
		{
			var plain = Effective(choice, menuHasCategories, stripAxis, educationMenu);

			if (offered.Count == 0 || !IsGrouped(plain) || offered.Contains(plain))
			{
				return plain;
			}

			var candidates = new[]
			{
				DefaultDimension(menuHasCategories, stripAxis, educationMenu),
				DefaultDimension(false, stripAxis, educationMenu),
			}.Concat(Dimensions.Where(IsGrouped));

			return candidates.FirstOrDefault(offered.Contains) ?? None;
		}

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
			// These two used to have no key at all: the UI built their trees by
			// label and sorted the headings itself, so the page was never
			// group-contiguous and a group could straddle a window boundary.
			if (Is(dimension, Progression)) return entry.UnlockMilestone.ToString("D3", CultureInfo.InvariantCulture);
			if (Is(dimension, Development)) return string.IsNullOrWhiteSpace(entry.DevTreeBranch)
				? UnnamedKey
				: entry.DevTreeBranchDepth.ToString("D3", CultureInfo.InvariantCulture) + Normalize(entry.DevTreeBranch);

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

		public const string Other = "Other";
		public const string ProgressionUngated = "From the start";

		public readonly record struct GroupLabels(string[] Path, string? LabelId);

		/// <summary>
		/// The headings an entry files under, for the dimension the page is grouped by.
		/// </summary>
		/// <remarks>
		/// Moved from buildingGroups.ts (groupLevelsFor and its helpers) so the
		/// band edges, tier names and category words have one home; the keys
		/// above and these labels agree because they read the same constants.
		/// LabelId carries the game's own category id for a menu-category
		/// heading so the UI can localise it; every other label is final text.
		/// </remarks>
		public static GroupLabels Labels(BuildingCatalogEntry entry, string? groupBy, IReadOnlyList<string>? milestoneNames = null)
		{
			if (entry is null || !IsGrouped(groupBy))
			{
				return new GroupLabels(Array.Empty<string>(), null);
			}

			var dimension = groupBy!.Trim();

			if (Is(dimension, Category))
			{
				return new GroupLabels(new[]
				{
					Text(entry.CategoryLabel) ?? Text(entry.Category) ?? Other,
					Text(entry.SubCategoryLabel) ?? Text(entry.SubCategory) ?? Other,
				}, null);
			}

			if (Is(dimension, MenuCategory))
			{
				var id = (entry.UiCategory ?? string.Empty).Trim();

				return new GroupLabels(
					new[] { MenuCategoryLabel(entry), CategoryTierLabel(entry, milestoneNames) },
					id.Length == 0 ? null : id);
			}

			if (Is(dimension, SubCategory)) return new GroupLabels(new[] { Text(entry.SubCategoryLabel) ?? Text(entry.SubCategory) ?? Other }, null);
			if (Is(dimension, Role)) return new GroupLabels(new[] { Text(entry.BuildingType) ?? Other }, null);
			if (Is(dimension, Progression)) return new GroupLabels(new[] { MilestoneLabel(entry.UnlockMilestone, milestoneNames) }, null);
			if (Is(dimension, Development)) return new GroupLabels(new[] { Text(entry.DevTreeBranch) ?? Other }, null);
			if (Is(dimension, SchoolTier)) return new GroupLabels(new[] { SchoolTierLabel(entry.EducationLevel) ?? MenuCategoryLabel(entry) }, null);
			if (Is(dimension, Theme)) return new GroupLabels(new[] { Text(entry.Theme) ?? Other }, null);
			if (Is(dimension, Source)) return new GroupLabels(new[] { Text(entry.DlcId) ?? Text(entry.Provenance) ?? Other }, null);
			if (Is(dimension, Density)) return new GroupLabels(new[] { DensityTierLabel(entry.ZoneType) }, null);
			if (Is(dimension, Footprint)) return new GroupLabels(new[] { FootprintBandLabel(entry.LotWidth, entry.LotDepth) }, null);
			if (Is(dimension, Cost)) return new GroupLabels(new[] { CostBandLabel(entry.ConstructionCost) }, null);

			return new GroupLabels(Array.Empty<string>(), null);
		}

		/// <summary>The dimensions that can act on a set: two entries file under different keys.</summary>
		/// <remarks>
		/// Moved from buildingGroups.ts's groupDimensionsFor. A dimension that
		/// would put the whole menu in one bucket is a control that cannot act,
		/// in a picker of controls that can; schoolTier only where schools are;
		/// none always, because it is how grouping is turned off; everything
		/// before any entries have arrived, because judging an empty page would
		/// shorten the picker and leave it short.
		/// </remarks>
		public static string[] OfferedDimensions(IEnumerable<BuildingCatalogEntry> entries, bool educationMenu)
		{
			var sample = entries as IReadOnlyList<BuildingCatalogEntry> ?? entries.ToList();

			return Dimensions
				.Where(dimension => educationMenu || !Is(dimension, SchoolTier))
				.Where(dimension => Is(dimension, None)
					|| sample.Count == 0
					|| sample.Select(entry => PrimaryKey(entry, dimension)).Distinct(StringComparer.OrdinalIgnoreCase).Skip(1).Any())
				.ToArray();
		}

		// ---- label helpers, ported line for line from buildingGroups.ts ----

		private static string? Text(string? value)
		{
			if (string.IsNullOrWhiteSpace(value))
			{
				return null;
			}

			return Humanize(value!.Trim());
		}

		/// <summary>Word-splits an id so a heading does not read as one shout.</summary>
		public static string Humanize(string value)
		{
			var spaced = System.Text.RegularExpressions.Regex.Replace(value, "[_-]+", " ");
			spaced = System.Text.RegularExpressions.Regex.Replace(spaced, "([a-z0-9])([A-Z])", "$1 $2");
			spaced = System.Text.RegularExpressions.Regex.Replace(spaced, "\\s+", " ");
			return spaced.Trim();
		}

		private static string SplitWords(string value)
		{
			var split = System.Text.RegularExpressions.Regex.Replace(value, "([a-z0-9])([A-Z])", "$1 $2");
			split = System.Text.RegularExpressions.Regex.Replace(split, "([A-Z]+)([A-Z][a-z])", "$1 $2");
			return split.Trim();
		}

		/// <summary>
		/// A group heading for the game's own category. The id is a prefab name —
		/// "TransportationRoad", "PropsNature", "BikePaths" — so it is split into
		/// words and, where the convention holds, relieved of the menu name it
		/// repeats: "TransportationRoad" inside Transportation is "Road".
		/// </summary>
		public static string MenuCategoryLabel(BuildingCatalogEntry entry)
		{
			var raw = (entry.UiCategory ?? string.Empty).Trim();

			if (raw.Length == 0)
			{
				return Other;
			}

			var menu = System.Text.RegularExpressions.Regex.Replace(entry.UiMenu ?? string.Empty, "[^A-Za-z]", string.Empty);
			var withoutMenu = menu.Length > 0 && raw.StartsWith(menu, StringComparison.OrdinalIgnoreCase)
				? raw.Substring(menu.Length)
				: raw;

			return SplitWords(withoutMenu.Length == 0 ? raw : withoutMenu);
		}

		private static string TransitTierLabel(BuildingCatalogEntry entry)
		{
			var sub = entry.SubCategory ?? string.Empty;

			if (sub.StartsWith("ServiceBuildings_", StringComparison.Ordinal))
			{
				return "Stations";
			}

			return Text(entry.SubCategoryLabel) ?? Text(entry.SubCategory) ?? Other;
		}

		/// <summary>The second level under a menu category: density tier, transit type, branch, or milestone.</summary>
		public static string CategoryTierLabel(BuildingCatalogEntry entry, IReadOnlyList<string>? milestoneNames = null)
		{
			if (entry.ZoneType != ZoneTypeFilter.Any && entry.ZoneType != ZoneTypeFilter.Signature)
			{
				var density = DensityTierLabel(entry.ZoneType);

				if (density != Other)
				{
					return density;
				}
			}

			if (IsTransitMenu(entry.UiMenu))
			{
				return TransitTierLabel(entry);
			}

			var branch = Text(entry.DevTreeBranch);

			if (branch is not null)
			{
				return branch;
			}

			return MilestoneLabel(entry.UnlockMilestone, milestoneNames);
		}

		/// <summary>The density tier's heading; "Other" for a zone with no tier.</summary>
		public static string DensityTierLabel(ZoneTypeFilter density)
		{
			var label = BuildingCatalogLabels.DensityTier(density);

			return label.Length == 0 ? Other : label;
		}

		public static string? SchoolTierLabel(int? level) => level switch
		{
			1 => "Elementary School",
			2 => "High School",
			3 => "College",
			4 => "University",
			_ => null,
		};

		private static string FormatCurrency(double value) =>
			value >= 1000
				? "₡" + Math.Round(value / 1000).ToString(CultureInfo.InvariantCulture) + "k"
				: "₡" + value.ToString(CultureInfo.InvariantCulture);

		public static string CostBandLabel(double? cost)
		{
			if (!cost.HasValue || double.IsNaN(cost.Value) || double.IsInfinity(cost.Value))
			{
				return Other;
			}

			for (var index = 0; index < CostBands.Length; index++)
			{
				if (cost.Value < CostBands[index])
				{
					return index == 0
						? FormatCurrency(0) + "–" + FormatCurrency(CostBands[0])
						: FormatCurrency(CostBands[index - 1]) + "–" + FormatCurrency(CostBands[index]);
				}
			}

			return FormatCurrency(CostBands[CostBands.Length - 1]) + "+";
		}

		public static string FootprintBandLabel(int width, int depth)
		{
			var longest = Math.Max(Math.Max(width, 0), Math.Max(depth, 0));

			if (longest <= 0)
			{
				return Other;
			}

			foreach (var edge in FootprintBands)
			{
				if (longest <= edge)
				{
					return edge + "×" + edge + " and under";
				}
			}

			var last = FootprintBands[FootprintBands.Length - 1];
			return "Larger than " + last + "×" + last;
		}

		public static string MilestoneLabel(int? index, IReadOnlyList<string>? names)
		{
			if (!index.HasValue || index.Value < 0)
			{
				return Other;
			}

			if (names is not null && index.Value < names.Count && !string.IsNullOrEmpty(names[index.Value]))
			{
				return names[index.Value];
			}

			return index.Value == 0 ? ProgressionUngated : "Milestone " + index.Value.ToString(CultureInfo.InvariantCulture);
		}

		private static string Normalize(string? value) =>
			string.IsNullOrWhiteSpace(value) ? UnnamedKey : value.Trim();
	}
}
