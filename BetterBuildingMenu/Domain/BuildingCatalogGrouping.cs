using BetterBuildingMenu.Domain.Enums;

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
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

		/// <summary>No grouping: what none, a blank id and no choice all mean.</summary>
		private static readonly BuildingCatalogGroupDimension Ungrouped = new(None, NoKey, NoKey, NoLabels, isGrouped: false);

		/// <summary>An id that names no dimension: grouped, but under one empty key and no heading.</summary>
		private static readonly BuildingCatalogGroupDimension Unrecognised = new(string.Empty, NoKey, NoKey, NoLabels);

		/// <summary>Every dimension the picker offers, in its order. Band edges, tier names and category
		/// words have one home in this class, so each row's keys and headings agree. LabelId carries the
		/// game's category id for a menu-category heading; every other label is final text.</summary>
		private static readonly BuildingCatalogGroupDimension[] Table =
		{
			// The game's own categories, the split the tab strip shows: first, because it
			// is the division the player already has in mind.
			new(
				MenuCategory,
				entry => MenuCategoryRank(entry.UiCategory, entry.UiCategoryPriority, entry.UiCategoryTab),
				MenuCategoryTierKey,
				(entry, milestoneNames, _) => new GroupLabels(
					new[] { MenuCategoryLabel(entry), CategoryTierLabel(entry, milestoneNames) },
					MenuCategoryId(entry))),
			// Ours: Buildings, Networks, Service Buildings. The subcategory beneath is what keeps it
			// useful once the player has navigated into a category and the outer heading says nothing.
			new(
				Category,
				entry => Normalize(entry.Category),
				entry => Normalize(entry.SubCategory),
				(entry, _, _) => new GroupLabels(
					new[]
					{
						Text(entry.CategoryLabel) ?? Text(entry.Category) ?? Other,
						Text(entry.SubCategoryLabel) ?? Text(entry.SubCategory) ?? Other,
					},
					null)),
			new(
				SubCategory,
				entry => Normalize(entry.SubCategory),
				NoKey,
				(entry, _, _) => Heading(Text(entry.SubCategoryLabel) ?? Text(entry.SubCategory) ?? Other)),
			new(
				Role,
				entry => Normalize(entry.BuildingType),
				NoKey,
				(entry, _, _) => Heading(entry.BuildingType?.Trim() is { Length: > 0 } role ? BuildingCatalogLabels.ForRole(role) : Other)),
			// Directly under Role, because it is the level below it: Role answers
			// "school", School tier answers "which one".
			new(
				SchoolTier,
				entry => SchoolTierRank(entry.EducationLevel),
				NoKey,
				(entry, _, schoolTierNames) => SchoolTierLabels(entry, schoolTierNames)),
			// The game's own progression, then the other unlock modality, the per-service
			// tree bought with development points.
			new(
				Progression,
				entry => entry.UnlockMilestone.ToString("D3", CultureInfo.InvariantCulture),
				NoKey,
				(entry, milestoneNames, _) => Heading(MilestoneLabel(entry.UnlockMilestone, milestoneNames))),
			new(
				Development,
				entry => string.IsNullOrWhiteSpace(entry.DevTreeBranch)
					? UnnamedKey
					: entry.DevTreeBranchDepth.ToString("D3", CultureInfo.InvariantCulture) + Normalize(entry.DevTreeBranch),
				NoKey,
				(entry, _, _) => Heading(Text(entry.DevTreeBranch) ?? Other)),
			new(
				Theme,
				entry => Normalize(entry.Theme),
				NoKey,
				(entry, _, _) => Heading(entry.Theme?.Trim() is { Length: > 0 } theme ? BuildingCatalogLabels.ForTheme(theme) : Other)),
			// The DLC name is the more specific answer where there is one.
			new(
				Source,
				entry => Normalize(string.IsNullOrWhiteSpace(entry.DlcId) ? entry.Provenance : entry.DlcId),
				NoKey,
				(entry, _, _) => Heading(Text(entry.DlcId) ?? Text(entry.Provenance) ?? Other)),
			new(
				Density,
				entry => DensityRank(entry.ZoneType),
				NoKey,
				(entry, _, _) => Heading(DensityTierLabel(entry.ZoneType))),
			new(
				Footprint,
				entry => FootprintRank(entry.LotWidth, entry.LotDepth),
				NoKey,
				(entry, _, _) => Heading(FootprintBandLabel(entry.LotWidth, entry.LotDepth))),
			new(
				Cost,
				entry => CostRank(entry.ConstructionCost),
				NoKey,
				(entry, _, _) => Heading(CostBandLabel(entry.ConstructionCost))),
			Ungrouped,
		};

		/// <summary>Every dimension the picker offers, by id, in the picker's order.</summary>
		/// <remarks>The UI's copy of the ids and the order is generated from this; the labels
		/// are the UI's.</remarks>
		public static readonly IReadOnlyList<string> Dimensions = Table.Select(dimension => dimension.Id).ToArray();

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
			&& DescriptorIds.Find(Table, trimmed) is not null;

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
		/// open the asset menu on a grouping its own picker does not list. The answer is the first of the
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

		/// <summary>The dimension a grouping id names, ignoring case and surrounding space.</summary>
		/// <remarks>Blank and "none" group nothing. Any other id that names no dimension groups everything
		/// under one empty key with no heading, which leaves the order to the chosen sort.</remarks>
		public static BuildingCatalogGroupDimension Find(string? groupBy) =>
			!IsGrouped(groupBy) ? Ungrouped
			: DescriptorIds.Find(Table, groupBy.Trim()) ?? Unrecognised;

		private static bool Is(string value, string dimension) =>
			string.Equals(value, dimension, StringComparison.OrdinalIgnoreCase);

		private static string NoKey(BuildingCatalogEntry entry) => string.Empty;

		private static GroupLabels NoLabels(
			BuildingCatalogEntry entry,
			IReadOnlyList<string>? milestoneNames,
			IReadOnlyDictionary<int, string>? schoolTierNames) =>
			new(Array.Empty<string>(), null);

		private static GroupLabels Heading(string label) => new(new[] { label }, null);

		/// <summary>The game's id for an entry's category, or null when it has none.</summary>
		private static string? MenuCategoryId(BuildingCatalogEntry entry)
		{
			var id = (entry.UiCategory ?? string.Empty).Trim();

			return id.Length == 0 ? null : id;
		}

		/// <summary>The menu whose tier is what an asset IS, not when it unlocks.</summary>
		private static bool IsTransitMenu(string? menu) =>
			menu is { Length: > 0 }
			&& menu.IndexOf("Transportation", StringComparison.OrdinalIgnoreCase) >= 0;

		/// <summary>The tier beneath the game's own category. It needs a KEY, not just a heading, so a
		/// group cannot straddle a page boundary; three sources, prefixed so they cannot collide.</summary>
		private static string MenuCategoryTierKey(BuildingCatalogEntry entry)
		{
			// Signature is a marker, not a density: every signature building
			// carries it, so taking it here would collapse all of them into
			// one child and never reach the milestone that does vary.
			if (entry.ZoneType != ZoneTypeFilter.Any && entry.ZoneType != ZoneTypeFilter.Signature)
			{
				return "d" + DensityRank(entry.ZoneType);
			}

			// Transit before the branch, because its branches divide nothing: they run
			// one to one with its categories. What each asset is for is the real split.
			// See docs/design-notes.md, "Transit tiers".
			if (IsTransitMenu(entry.UiMenu))
			{
				var tier = TransitTier(entry);

				// The ways keep their subcategory in the key: lanes, seaways and tracks are
				// each their own heading, all ahead of the stations.
				return tier switch
				{
					0 => "s0" + Normalize(entry.SubCategory),
					> 0 => "s" + tier.ToString(CultureInfo.InvariantCulture),
					_ => "s9" + Normalize(entry.SubCategory),
				};
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

		/// <summary>
		/// Orders category groups the way the game orders the tabs above them.
		/// </summary>
		/// <remarks>
		/// By priority, then by the tab's place in the strip, which breaks a tie the way vanilla's
		/// unstable sort breaks it (see <see cref="BuildingCatalogEntry.UiCategoryTab"/>). The name
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

		/// <summary>A school's level; any other entry, such as a research facility, under its category's
		/// heading, with the game's id so the UI can say it in the game's language, as menuCategory's does.</summary>
		private static GroupLabels SchoolTierLabels(BuildingCatalogEntry entry, IReadOnlyDictionary<int, string>? schoolTierNames) =>
			SchoolTierLabel(entry.EducationLevel, schoolTierNames) is { } tier
				? Heading(tier)
				: new GroupLabels(new[] { MenuCategoryLabel(entry) }, MenuCategoryId(entry));

		/// <summary>The dimensions that can act on a set: two entries file under different keys.</summary>
		/// <remarks>
		/// A dimension that would put the whole menu in one bucket is a control that cannot act;
		/// schoolTier only where schools are; none always, because it is how grouping is turned
		/// off; everything before any entries arrive, since an empty page judges nothing.
		/// </remarks>
		public static string[] OfferedDimensions(IEnumerable<BuildingCatalogEntry> entries, bool educationMenu)
		{
			var sample = entries as IReadOnlyList<BuildingCatalogEntry> ?? entries.ToList();

			return Table
				.Where(dimension => educationMenu || !Is(dimension.Id, SchoolTier))
				.Where(dimension => !dimension.IsGrouped
					|| sample.Count == 0
					|| sample.Select(dimension.PrimaryKey).Distinct(StringComparer.OrdinalIgnoreCase).Skip(1).Any())
				.Select(dimension => dimension.Id)
				.ToArray();
		}

		// ---- label helpers ----

		private static string? Text(string? value) =>
			value?.Trim() is { Length: > 0 } trimmed ? Humanize(trimmed) : null;

		// The label helpers below run for every row of a page, and again on each Load more, so they
		// loop rather than use Mono's slow Regex. LabelRegexParityTests holds the expressions they
		// replaced.

		/// <summary>Word-splits an id so a heading does not read as one shout.</summary>
		/// <remarks>"Service_BuildingsHealth" is "Service Buildings Health": a run of underscores,
		/// hyphens and whitespace is one space, and a capital after a lower-case letter or a digit
		/// starts a word.</remarks>
		public static string Humanize(string value)
		{
			var spaced = new StringBuilder(value.Length + 8);

			for (var index = 0; index < value.Length; index++)
			{
				var current = value[index];

				if (current is '_' or '-' || char.IsWhiteSpace(current))
				{
					if (spaced.Length > 0 && spaced[spaced.Length - 1] != ' ')
					{
						spaced.Append(' ');
					}

					continue;
				}

				if (index > 0 && current is >= 'A' and <= 'Z' && IsLowerOrDigit(value[index - 1]))
				{
					spaced.Append(' ');
				}

				spaced.Append(current);
			}

			return spaced.ToString().Trim();
		}

		/// <summary>"TransportationRoad" is "Transportation Road", and "HTMLParser" "HTML Parser".</summary>
		internal static string SplitWords(string value)
		{
			var split = new StringBuilder(value.Length + 8);

			for (var index = 0; index < value.Length; index++)
			{
				var current = value[index];

				if (index > 0 && current is >= 'A' and <= 'Z'
					&& (IsLowerOrDigit(value[index - 1])
						|| (value[index - 1] is >= 'A' and <= 'Z' && index + 1 < value.Length && value[index + 1] is >= 'a' and <= 'z')))
				{
					split.Append(' ');
				}

				split.Append(current);
			}

			return split.ToString().Trim();
		}

		/// <summary>The ASCII letters of a value, in order.</summary>
		internal static string Letters(string value)
		{
			var letters = new StringBuilder(value.Length);

			foreach (var c in value)
			{
				if (c is >= 'A' and <= 'Z' or >= 'a' and <= 'z')
				{
					letters.Append(c);
				}
			}

			return letters.ToString();
		}

		private static bool IsLowerOrDigit(char c) => c is >= 'a' and <= 'z' or >= '0' and <= '9';

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

			var menu = Letters(entry.UiMenu ?? string.Empty);
			var withoutMenu = menu.Length > 0 && raw.StartsWith(menu, StringComparison.OrdinalIgnoreCase)
				? raw.Substring(menu.Length)
				: raw;

			return SplitWords(withoutMenu.Length == 0 ? raw : withoutMenu);
		}

		private static string TransitTierLabel(BuildingCatalogEntry entry)
		{
			// Chosen by the tier, not the entry: the key is the tier, and two entries
			// under one key must read one heading.
			switch (TransitTier(entry) is int tier && tier >= 0 ? TransitTiers[tier] : null)
			{
				case TracksTier:
					return SubCategoryHeading(entry, TransitWay(entry) ?? PrefabSubCategory.Networks_Tracks);
				case TransitRole.Stop:
					return SubCategoryHeading(entry, PrefabSubCategory.Networks_Stops);
				case TransitRole.Station:
					return "Stations";
				case TransitRole.Depot:
					return "Depots";
				case TransitRole.CargoStation:
					return "Cargo Stations";
				default:
					return Text(entry.SubCategoryLabel) ?? Text(entry.SubCategory) ?? Other;
			}
		}

		/// <summary>A subcategory's heading: the entry's own label where it is filed there, else the
		/// label the adapter would have given it.</summary>
		private static string SubCategoryHeading(BuildingCatalogEntry entry, PrefabSubCategory subCategory) =>
			(string.Equals(entry.SubCategory?.Trim(), subCategory.ToString(), StringComparison.Ordinal)
				? Text(entry.SubCategoryLabel)
				: null)
			?? Text(BuildingCatalogLabels.ForSubCategory(subCategory, subCategory.ToString()))
			?? Other;

		/// <summary>The tier a mode's way files under: a network, so it has no transit role.</summary>
		private const string TracksTier = nameof(PrefabSubCategory.Networks_Tracks);

		/// <summary>
		/// What a mode runs on: Train, Tram and Subway their tracks, Road its public transport
		/// lanes, Ship its seaways.
		/// </summary>
		private static readonly PrefabSubCategory[] TransitWays =
		{
			PrefabSubCategory.Networks_Tracks, PrefabSubCategory.Networks_Roads, PrefabSubCategory.Networks_Waterways,
		};

		/// <summary>The way an entry is filed under, or null when it is none.</summary>
		private static PrefabSubCategory? TransitWay(BuildingCatalogEntry entry)
		{
			var sub = (entry.SubCategory ?? string.Empty).Trim();

			foreach (var way in TransitWays)
			{
				if (string.Equals(sub, way.ToString(), StringComparison.Ordinal))
				{
					return way;
				}
			}

			return null;
		}

		/// <summary>
		/// A transit mode's tiers in the order it is built: the track, then where passengers
		/// board, then the depot that runs the vehicles, then freight.
		/// </summary>
		private static readonly string[] TransitTiers =
		{
			TracksTier, TransitRole.Station, TransitRole.Stop, TransitRole.Depot, TransitRole.CargoStation,
		};

		/// <summary>
		/// A transit asset's place within its mode, as its index in <see cref="TransitTiers"/>;
		/// -1 for one that has none, such as a line.
		/// </summary>
		/// <remarks>
		/// The role where the indexer found one. Otherwise its subcategory stands in: a way (a
		/// track, a lane, a seaway) by its own, a building with no transit component with the stations, the transit building
		/// a player looks for first, and a stop with no role still with the stops.
		/// </remarks>
		private static int TransitTier(BuildingCatalogEntry entry)
		{
			var role = entry.BuildingType?.Trim();
			var sub = (entry.SubCategory ?? string.Empty).Trim();

			if (role is { Length: > 0 } && Array.IndexOf(TransitTiers, role) is var rank && rank > 0)
			{
				return rank;
			}

			if (TransitWay(entry) is not null)
			{
				return Array.IndexOf(TransitTiers, TracksTier);
			}

			if (sub.StartsWith("ServiceBuildings_", StringComparison.Ordinal))
			{
				return Array.IndexOf(TransitTiers, TransitRole.Station);
			}

			if (string.Equals(sub, nameof(PrefabSubCategory.Networks_Stops), StringComparison.Ordinal))
			{
				return Array.IndexOf(TransitTiers, TransitRole.Stop);
			}

			return -1;
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

		/// <summary>A school level's heading: the game's name for it from <paramref name="names"/>
		/// (see CatalogIndex.SchoolTierNames), or the English word when that has none.</summary>
		/// <returns>Null for a level beyond the game's four, which files under its menu category.</returns>
		public static string? SchoolTierLabel(int? level, IReadOnlyDictionary<int, string>? names = null) =>
			level is int known && names is not null && names.TryGetValue(known, out var name)
				? name
				: EnglishSchoolTierLabel(level);

		private static string? EnglishSchoolTierLabel(int? level) => level switch
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
