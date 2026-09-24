using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Diagnostics.CodeAnalysis;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The ordering half of grouped views.
	/// </summary>
	/// <remarks>
	/// Grouping is a primary sort key, not a separate axis: with paging, grouping only the
	/// visible page splits a group across a boundary and the heading then lies about what it
	/// contains. This side produces keys, so banded dimensions rank rather than label.
	/// </remarks>
	public static class BuildingCatalogGrouping
	{
		public const string None = "none";
		public const string Category = "category";
		/// <summary>
		/// The game's own category — the tab strip's dimension.
		/// </summary>
		/// <remarks>
		/// Distinct from Category, which is OUR taxonomy. Grouping a scoped menu by that says
		/// almost nothing; the game's own categories reproduce the split the tab strip already
		/// shows, which is the model the player is holding.
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
		/// <remarks>The UI's copy of the ids and the order is generated from this; the labels
		/// are the UI's.</remarks>
		public static readonly IReadOnlyList<string> Dimensions = new[]
		{
			// The game's own categories, the split the tab strip shows: first, because it
			// is the division the player already has in mind.
			MenuCategory,
			// Ours: Buildings, Networks, Service Buildings.
			Category,
			SubCategory,
			Role,
			// Directly under Role, because it is the level below it: Role answers
			// "school", School tier answers "which one".
			SchoolTier,
			// The game's own progression, then the other unlock modality, the per-service
			// tree bought with development points.
			Progression,
			Development,
			Theme,
			Source,
			Density,
			Footprint,
			Cost,
			None,
		};

		/// <summary>Cost band edges.</summary>
		public static readonly double[] CostBands = { 5_000d, 25_000d, 100_000d };

		/// <summary>Footprint band edges, by the longer lot side.</summary>
		public static readonly int[] FootprintBands = { 2, 4, 6 };

		/// <summary>Density tiers in reading order.</summary>
		/// <remarks>
		/// An explicit table, because the enum's own values do not encode this order: Mixed and
		/// LowRent read between Medium and High but sort past Signature. Row before Medium
		/// because row housing unlocks first, and LowRent immediately before High because it IS
		/// high density, whatever its name suggests.
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
		/// An empty key sorts first, which would put "Other" above every named group. Same
		/// reasoning as <see cref="UnrankedKey"/>, applied to the text dimensions.
		/// </remarks>
		private const string UnnamedKey = "\uFFFD";

		public static bool IsGrouped([NotNullWhen(true)] string? groupBy) =>
			groupBy?.Trim() is { Length: > 0 } trimmed
			&& !string.Equals(trimmed, None, StringComparison.OrdinalIgnoreCase);

		public static bool IsDimension([NotNullWhen(true)] string? value) =>
			value?.Trim() is { Length: > 0 } trimmed
			&& Dimensions.Any(dimension => Is(trimmed, dimension));

		/// <summary>
		/// What a menu opens grouped by when the player has not chosen.
		/// </summary>
		/// <remarks>
		/// The strip and the headings answer the same question, so they must not open on different
		/// answers: the education menu draws school levels in its category's place and is asked
		/// first, then a menu with categories of its own, then the strip's axis.
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
			IsDimension(choice) ? choice.Trim() : DefaultDimension(menuHasCategories, stripAxis, educationMenu);

		/// <summary>
		/// <see cref="Effective(string?, bool, string?, bool)"/>, held to the
		/// dimensions the menu actually offers.
		/// </summary>
		/// <remarks>
		/// A default or a stored choice can name a dimension this menu does not offer, which would
		/// open the lens on a grouping its own picker does not list. The answer is the first of the
		/// candidates that can act here; <paramref name="offered"/> empty means "not judged yet".
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
		/// Matched with <see cref="Is"/> rather than by lowercasing and switching on the constants,
		/// so a dimension id that is not already all-lowercase still matches its own case. A missing
		/// key costs paging: a group split across a page boundary is what this design prevents.
		/// </remarks>
		public static string PrimaryKey(BuildingCatalogEntry entry, string? groupBy)
		{
			if (entry is null || !IsGrouped(groupBy))
			{
				return string.Empty;
			}

			string dimension = groupBy.Trim();

			if (Is(dimension, Category)) return Normalize(entry.Category);
			if (Is(dimension, MenuCategory)) return MenuCategoryRank(entry.UiCategory, entry.UiCategoryPriority, entry.UiCategoryTab);
			if (Is(dimension, SubCategory)) return Normalize(entry.SubCategory);
			if (Is(dimension, Role)) return Normalize(entry.BuildingType);
			if (Is(dimension, SchoolTier)) return SchoolTierRank(entry.EducationLevel);
			if (Is(dimension, Theme)) return Normalize(entry.Theme);
			// The DLC name is the more specific answer where there is one.
			if (Is(dimension, Source)) return Normalize(string.IsNullOrWhiteSpace(entry.DlcId) ? entry.Provenance : entry.DlcId);
			if (Is(dimension, Density)) return DensityRank(entry.ZoneType);
			if (Is(dimension, Footprint)) return FootprintRank(entry.LotWidth, entry.LotDepth);
			if (Is(dimension, Cost)) return CostRank(entry.ConstructionCost);
			if (Is(dimension, Progression)) return entry.UnlockMilestone.ToString("D3", CultureInfo.InvariantCulture);
			if (Is(dimension, Development)) return string.IsNullOrWhiteSpace(entry.DevTreeBranch)
				? UnnamedKey
				: entry.DevTreeBranchDepth.ToString("D3", CultureInfo.InvariantCulture) + Normalize(entry.DevTreeBranch);

			return string.Empty;
		}

		private static bool Is(string value, string dimension) =>
			string.Equals(value, dimension, StringComparison.OrdinalIgnoreCase);

		/// <summary>The menu whose tier is what an asset IS, not when it unlocks.</summary>
		private static bool IsTransitMenu(string? menu) =>
			menu is { Length: > 0 }
			&& menu.IndexOf("Transportation", StringComparison.OrdinalIgnoreCase) >= 0;

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

			var dimension = groupBy.Trim();

			if (Is(dimension, Category))
			{
				return Normalize(entry.SubCategory);
			}

			// The tier beneath the game's own category needs a KEY, not just a heading:
			// grouping is a primary sort key precisely so a group cannot straddle a page
			// boundary. Three sources, prefixed so they cannot collide.
			if (Is(dimension, MenuCategory))
			{
				// Signature is a marker, not a density: every signature building
				// carries it, so taking it here would collapse all of them into
				// one child and never reach the milestone that does vary.
				if (entry.ZoneType != ZoneTypeFilter.Any && entry.ZoneType != ZoneTypeFilter.Signature)
				{
					return "d" + DensityRank(entry.ZoneType);
				}

				// Transit before the branch, because its branches divide nothing: they run
				// one to one with its categories. Its subcategory is the real split —
				// tracks, stops, lines, and the stations themselves.
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
		/// By priority, then by the tab's place in the strip, which breaks a tie the way vanilla's
		/// unstable sort broke it (see <see cref="BuildingCatalogEntry.UiCategoryTab"/>). The name
		/// comes last: a key must be a function of the group, or two categories sharing both would
		/// interleave.
		/// </remarks>
		public static string MenuCategoryRank(string? category, int priority, int tab = int.MaxValue)
		{
			if (category?.Trim() is not { Length: > 0 } trimmed)
			{
				return UnnamedKey;
			}

			// Priority is a signed int, so shift it into an unsigned range
			// before padding. Zero-padding it as-is would sort every negative
			// priority after every positive one, and "-100" ahead of "-99".
			long rank = (long)priority - int.MinValue;

			// U+0000 as the separator: it sorts below every character a prefab
			// name can hold, so a name that is another name's prefix cannot
			// outrank it. Written as an escape so the file stays text to grep.
			return rank.ToString("D10", CultureInfo.InvariantCulture)
				+ Math.Max(0, tab).ToString("D10", CultureInfo.InvariantCulture)
				+ '\u0000'
				+ trimmed;
		}

		/// <summary>
		/// Orders school tiers as a school career runs, not as the alphabet does.
		/// </summary>
		/// <remarks>
		/// SchoolLevel is a 1-based tier index, so the value already ranks itself and only needs
		/// padding to sort as text. Everything outside 1..4 — a tierless school upgrade, the outside
		/// connection, every non-school — belongs in one "Other" group at the end.
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
		/// The band edges, tier names and category words have one home here, so these labels and
		/// the keys above agree by reading the same constants. LabelId carries the game's own
		/// category id for a menu-category heading; every other label is final text.
		/// </remarks>
		public static GroupLabels Labels(BuildingCatalogEntry entry, string? groupBy, IReadOnlyList<string>? milestoneNames = null)
		{
			if (entry is null || !IsGrouped(groupBy))
			{
				return new GroupLabels(Array.Empty<string>(), null);
			}

			var dimension = groupBy.Trim();

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
		/// A dimension that would put the whole menu in one bucket is a control that cannot act;
		/// schoolTier only where schools are; none always, because it is how grouping is turned
		/// off; everything before any entries arrive, since an empty page judges nothing.
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

		// ---- label helpers ----

		private static string? Text(string? value) =>
			value?.Trim() is { Length: > 0 } trimmed ? Humanize(trimmed) : null;

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
		/// A group heading for the game's own category. The id is a prefab name, so it is split into
		/// words and, where the convention holds, relieved of the menu name it repeats:
		/// "TransportationRoad" inside Transportation is "Road".
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
			value?.Trim() is { Length: > 0 } trimmed ? trimmed : UnnamedKey;
	}
}
