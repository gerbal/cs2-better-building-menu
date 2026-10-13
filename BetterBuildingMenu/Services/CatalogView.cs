using System;
using System.Collections.Generic;
using System.Linq;
using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Services
{
	/// <summary>
	/// Every answer one refresh needs, from one pass over the snapshot.
	/// </summary>
	/// <remarks>
	/// The snapshot is scoped to the menu ONCE (<see cref="PresentSet"/>); every other answer is a
	/// pass over that much smaller array, computed once and kept, so a refresh does not re-derive
	/// the same scope for each question it asks. Which tabs a row draws comes from the present set,
	/// and every count from <see cref="FilteredMenuSet"/>. See docs/design-notes.md, "Tab counts".
	/// </remarks>
	public sealed class CatalogView
	{
		private readonly IReadOnlyList<BuildingCatalogEntry> _snapshot;
		private readonly BuildingCatalogQuery _query;
		private readonly Func<IReadOnlyList<BuildingCatalogEntry>>? _packScope;
		private readonly Func<CatalogView, string>? _groupByResolver;
		private readonly IReadOnlyList<string>? _milestoneNames;
		private readonly IReadOnlyDictionary<int, string>? _schoolTierNames;
		private readonly bool _educationMenu;
		private readonly bool _vanillaSelected;
		private readonly IReadOnlyList<string>? _menuCategories;
		private readonly string? _menuIcon;
		private string? _effectiveGroupBy;
		private string[]? _dimensions;

		private BuildingCatalogEntry[]? _presentSet, _menuSet, _filteredMenuSet, _viewSet, _tabSet, _filteredTabSet, _wholeMenu;
		private BuildingCatalogPage? _page;
		private BuildingCatalogMetricRangeState? _bounds;
		private BuildingCatalogFacetState? _facets;
		private IReadOnlyList<MenuCategoryCount>? _counts;
		private string? _expandedId, _axis;
		private IReadOnlyList<MenuBranchCount>? _expandedTabs, _stripTabs;
		private TierBracket? _bracket;
		private IReadOnlyList<MenuCategoryTabs>? _expanded;

		/// <param name="menuCategories">The menu's tabs in the game's order, which the counts follow; null orders them by id.</param>
		/// <param name="menuIcon">The menu's own icon, which a tab with no picture of its own draws.</param>
		public CatalogView(
			IReadOnlyList<BuildingCatalogEntry> snapshot,
			BuildingCatalogQuery query,
			Func<IReadOnlyList<BuildingCatalogEntry>>? packScope = null,
			Func<CatalogView, string>? groupByResolver = null,
			IReadOnlyList<string>? milestoneNames = null,
			bool educationMenu = false,
			bool vanillaSelected = false,
			IReadOnlyDictionary<int, string>? schoolTierNames = null,
			IReadOnlyList<string>? menuCategories = null,
			string? menuIcon = null)
		{
			_snapshot = snapshot ?? throw new ArgumentNullException(nameof(snapshot));
			_query = query ?? throw new ArgumentNullException(nameof(query));
			_packScope = packScope;
			_groupByResolver = groupByResolver;
			_milestoneNames = milestoneNames;
			_educationMenu = educationMenu;
			_vanillaSelected = vanillaSelected;
			_schoolTierNames = schoolTierNames;
			_menuCategories = menuCategories;
			_menuIcon = menuIcon;
		}

		/// <summary>The dimension ids the picker should offer for this menu set.</summary>
		public string[] GroupDimensions => _dimensions ??= BuildingCatalogGrouping.OfferedDimensions(MenuSet, _educationMenu);

		/// <summary>The grouping the page is ordered by: the player's choice, or the menu's default.</summary>
		/// <remarks>
		/// Resolved here rather than by the UI. The resolver may read this view's own strip axis;
		/// nothing it reads depends on Page, so there is no cycle.
		/// </remarks>
		public string EffectiveGroupBy => _effectiveGroupBy ??= _groupByResolver?.Invoke(this) ?? _query.GroupBy;

		/// <summary>Whether the view stands in for one of the game's menus; without one the row draws All alone.</summary>
		private bool Scoped => !string.IsNullOrWhiteSpace(_query.UiMenu);

		/// <summary>The query with the search and every metric range cleared; the facet selections stay.</summary>
		private BuildingCatalogQuery Unsearched => BuildingCatalogMetricRange.Clear(_query) with { SearchText = string.Empty };

		/// <summary>The query as the game's toolbar row leaves the menu: no tab, strip tab, level, search or range.</summary>
		private BuildingCatalogQuery PresentQuery => Unsearched with { UiCategory = string.Empty, StripTabs = null, SchoolTier = -1 };

		/// <summary>
		/// The menu as the game's toolbar row leaves it: no tab, strip tab, level, search, facet or
		/// range. The one pass over the snapshot.
		/// </summary>
		/// <remarks>Which tabs a row draws comes from here, so a filter or a keystroke never moves a tab.</remarks>
		public BuildingCatalogEntry[] PresentSet => _presentSet ??= BuildingCatalogQueryEngine.InScope(_snapshot, PresentQuery).ToArray();

		/// <summary>The menu, with category, strip tab and school tier cleared, the facets ignored.</summary>
		public BuildingCatalogEntry[] MenuSet => _menuSet ??=
			BuildingCatalogQueryEngine.InScope(PresentSet, TabFreeQuery).ToArray();

		/// <summary>The query with no tab, strip tab or level: the menu as every count sees it.</summary>
		private BuildingCatalogQuery TabFreeQuery => _query with { UiCategory = string.Empty, StripTabs = null, SchoolTier = -1 };

		/// <summary>
		/// The menu with the search, every facet and every range applied, and no tab, strip tab or
		/// level: what every count counts, so a tab's count is what a click on it lists.
		/// </summary>
		public BuildingCatalogEntry[] FilteredMenuSet => _filteredMenuSet ??= BuildingCatalogQueryEngine
			.Matching(MenuSet, TabFreeQuery)
			.ToArray();

		/// <summary>The All cell's count: every row the filters and the search leave in the menu.</summary>
		public int AllCount => FilteredMenuSet.Length;

		/// <summary>
		/// Where this menu opens, asked of a view of it as it opens (no tab, no search): the armed
		/// building's tab when the menu holds it (All, anchored on it, when the row draws no such tab),
		/// else Education's first level with rows, else the menu's first tab with rows; All where the
		/// row draws fewer than two tabs.
		/// </summary>
		/// <param name="armed">The prefab the game has armed, as the index's id, or 0 for none.</param>
		/// <remarks>See docs/design-notes.md, "Opening on the building's tab".</remarks>
		public MenuOpening Opening(int armed)
		{
			// One tab draws no tab cells: the row draws All and the strip, vanilla's one tab being the whole menu.
			var tabs = DrawsTabs ? MenuCategoryCounts : Array.Empty<MenuCategoryCount>();
			var held = armed > 0 ? PresentSet.FirstOrDefault(entry => entry.Id == armed) : null;

			if (held is not null)
			{
				// A tab the row draws no cell for would narrow the list under an All readout: All, still anchored.
				var own = TabOf(held);
				var tab = tabs.Any(count => string.Equals(count.Id, own, StringComparison.Ordinal)) ? own : string.Empty;

				return new MenuOpening(tab, LevelOf(held, tab), armed);
			}

			if (DrawsLevels
				&& TierBracket.Tiers.FirstOrDefault(tier => tier.Count > 0) is { } level
				&& int.TryParse(level.Id, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var first))
			{
				return new MenuOpening(TierBracket.ParentCategory, first, 0);
			}

			// A tab the filters empty is passed over; the toolbar's own row already narrowed the set.
			var opened = tabs.FirstOrDefault(count => count.Count > 0) ?? tabs.FirstOrDefault();

			return opened is null ? MenuOpening.All : new MenuOpening(opened.Id, -1, 0);
		}

		/// <summary>Whether the row draws the menu's tabs: two or more, as the UI's shouldShowCategoryStrip draws them.</summary>
		private bool DrawsTabs => MenuCategoryCounts.Count > 1;

		/// <summary>Whether Education's levels draw as chips beside their tab: two or more, inside a drawn tab row.</summary>
		/// <remarks>The same rule as the UI's tab row, whose categoryItems alone draws levels (tabRow.ts).</remarks>
		private bool DrawsLevels => DrawsTabs && TierBracket.Tiers.Length > 1;

		/// <summary>The level an armed school opens on, where its tab draws its levels; -1 anywhere else.</summary>
		private int LevelOf(BuildingCatalogEntry entry, string tab) =>
			DrawsLevels && string.Equals(tab, TierBracket.ParentCategory, StringComparison.Ordinal) && entry.EducationLevel is int level and >= 1 and <= 4
				? level
				: -1;

		/// <summary>What the page is drawn from: menu, category, tab and tier, facets cleared.</summary>
		public BuildingCatalogEntry[] ViewSet => _viewSet ??= BuildingCatalogQueryEngine.InScope(MenuSet, _query).ToArray();

		/// <summary>The present set at the picked category and level, with no strip tab: which strip tabs draw, and on which axis.</summary>
		public BuildingCatalogEntry[] TabSet => _tabSet ??= BuildingCatalogQueryEngine
			.InScope(PresentSet, Unsearched with { StripTabs = null })
			.ToArray();

		/// <summary>The menu at the picked category and level, with the search, the facets and the ranges, and no strip tab: what the strip tabs count.</summary>
		private BuildingCatalogEntry[] FilteredTabSet => _filteredTabSet ??= BuildingCatalogQueryEngine
			.Matching(MenuSet, _query with { StripTabs = null })
			.ToArray();

		public BuildingCatalogPage Page => _page ??= WithGroupLabels(BuildingCatalogQueryEngine.Query(MenuSet, _query with { GroupBy = EffectiveGroupBy }));

		/// <summary>Stamps the page's items with their headings. The page only — a hundred entries, not the set.</summary>
		private BuildingCatalogPage WithGroupLabels(BuildingCatalogPage page)
		{
			var dimension = EffectiveGroupBy;

			if (!BuildingCatalogGrouping.IsGrouped(dimension))
			{
				return page;
			}

			return page with
			{
				Items = page.Items.Select(entry =>
				{
					var labels = BuildingCatalogGrouping.Labels(entry, dimension, _milestoneNames, _schoolTierNames);
					return entry with { GroupPath = labels.Path, GroupLabelId = labels.LabelId };
				}).ToArray(),
			};
		}

		public BuildingCatalogMetricRangeState MetricBounds => _bounds ??= BuildingCatalogAdapter.MetricBoundsOf(ViewSet);

		// Packs alone are counted before the pack filter runs, because that
		// filter is upstream of InScope and InScope cannot undo it. Without a
		// pack selected the pack scope IS the view set.
		public BuildingCatalogFacetState FacetState => _facets ??= BuildingCatalogAdapter.BuildFacetState(
			ViewSet,
			_query,
			_packScope is null ? ViewSet : BuildingCatalogQueryEngine.InScope(_packScope(), _query),
			_vanillaSelected);

		/// <summary>
		/// One count per tab the row draws, in the menu's order: a tab draws while the menu holds rows
		/// for it before the filters and the search, and counts what it lists after them, zero included.
		/// </summary>
		/// <remarks>
		/// The category's own pick is ignored, so choosing one tab does not read every other as
		/// empty. Each entry counts under the tab it answers to IN THIS MENU, so Roads' gathered
		/// networks count under their extra tab; the tabs add up to All when every row answers to one.
		/// </remarks>
		public IReadOnlyList<MenuCategoryCount> MenuCategoryCounts => _counts ??= ComputeMenuCategoryCounts();

		private IReadOnlyList<MenuCategoryCount> ComputeMenuCategoryCounts()
		{
			var present = new HashSet<string>(PresentSet.Select(TabOf), StringComparer.Ordinal);
			var listed = FilteredMenuSet
				.GroupBy(TabOf, StringComparer.Ordinal)
				.ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal);
			var order = _menuCategories ?? present.OrderBy(id => id, StringComparer.Ordinal).ToArray();

			return order
				.Distinct(StringComparer.Ordinal)
				.Where(id => id.Length > 0 && present.Contains(id))
				.Select(id => new MenuCategoryCount(id, listed.TryGetValue(id, out var count) ? count : 0))
				.ToArray();
		}

		/// <summary>The tab an entry answers to in this menu, empty for none.</summary>
		private string TabOf(BuildingCatalogEntry entry) =>
			NetworkMenuExtension.EffectiveCategory(entry, _query.UiMenu) ?? string.Empty;

		public string ExpandedCategoryId => _expandedId ??= ComputeExpandedCategoryId();

		private string ComputeExpandedCategoryId()
		{
			// Roads keeps one chip per category with the game's own icon: a split one
			// draws as its branches' generic glyphs.
			if (MenuCategoryCounts.Count(category => category.Id.Length > 0) < 2 || VanillaMenus.IsRoads(_query.UiMenu))
			{
				return string.Empty;
			}

			return PresentSet
				.GroupBy(TabOf)
				.Where(group => group.Key.Length > 0)
				.Select(group => new { Tab = group.Key, Size = group.Count(), Branches = group.Where(entry => !string.IsNullOrEmpty(entry.DevTreeBranch)).GroupBy(entry => entry.DevTreeBranch!, StringComparer.Ordinal).ToArray() })
				.Where(candidate => candidate.Branches.Length > 1)
				.OrderByDescending(candidate => candidate.Size)
				.ThenBy(candidate => candidate.Tab, StringComparer.Ordinal)
				// Last, as it walks the whole present set: only the candidates down to the winner pay.
				.FirstOrDefault(candidate => OwnsItsBranches(candidate.Size, candidate.Branches))
				?.Tab ?? string.Empty;
		}

		/// <summary>Whether a click on each of a tab's branches lists that tab's rows and no other's, and the branches list all of them.</summary>
		/// <remarks>
		/// A branch another tab's rows share (Train's station on the subway's node) would draw a second
		/// tab of that tab's name, counting a slice of it; a row on no branch would land in no cell.
		/// Either way the tab stays whole, as the game draws it. See docs/design-notes.md, "Tab counts".
		/// </remarks>
		private bool OwnsItsBranches(int tabSize, IGrouping<string, BuildingCatalogEntry>[] branches)
		{
			if (branches.Sum(branch => branch.Count()) != tabSize)
			{
				return false;
			}

			var menuWide = BuildingCatalogQueryEngine.StripCounts(PresentSet, branches.Select(branch => branch.Key).ToArray());

			return branches.Select((branch, at) => menuWide[at] == branch.Count()).All(own => own);
		}

		public IReadOnlyList<MenuBranchCount> ExpandedCategoryTabs => _expandedTabs ??= ComputeExpandedCategoryTabs();

		private IReadOnlyList<MenuBranchCount> ComputeExpandedCategoryTabs()
		{
			var category = ExpandedCategoryId;

			if (category.Length == 0)
			{
				return Array.Empty<MenuBranchCount>();
			}

			// The present set narrowed to that category, tier kept, tabs cleared.
			var tabs = BuildingCatalogQueryEngine
				.InScope(PresentSet, Unsearched with { UiCategory = category, StripTabs = null })
				.GroupBy(entry => entry.DevTreeBranch ?? string.Empty)
				.Where(group => group.Key.Length > 0)
				.OrderBy(group => group.Min(entry => entry.DevTreeBranchDepth))
				.ThenBy(group => group.Key, StringComparer.Ordinal)
				.Select(group => new MenuBranchCount(
					group.Key,
					group.Count(),
					BranchIcon(category, group.Key) ?? BuildingCatalogAdapter.TabIcon(group, authored: true)))
				.ToArray();

			// These tabs share one category by construction, so the category glyph would
			// otherwise repeat across all of them.
			return Disambiguate(tabs, tab => BranchIcon(category, tab.Id, allowCategoryGlyph: false));
		}

		/// <summary>The tabs drawn in a category's place, zones' densities or a service's branches, each counting what it lists.</summary>
		/// <remarks>None without a menu, where the row draws no tab to hold them.</remarks>
		public IReadOnlyList<MenuCategoryTabs> ExpandedCategories => _expanded ??= Scoped
			? ComputeExpandedCategories().Select(category => category with { Tabs = Drawn(category.Tabs, FilteredMenuSet) }).ToArray()
			: Array.Empty<MenuCategoryTabs>();

		private IReadOnlyList<MenuCategoryTabs> ComputeExpandedCategories()
		{
			var density = BuildingCatalogAdapter.BuildDensityTabs(PresentSet, _query.UiMenu);

			if (density.Count > 0)
			{
				return density;
			}

			var branchCategory = ExpandedCategoryId;

			return branchCategory.Length == 0
				? Array.Empty<MenuCategoryTabs>()
				: new[] { new MenuCategoryTabs(branchCategory, ExpandedCategoryTabs.ToArray()) };
		}

		/// <summary>
		/// Which axis the strip's tabs cut this menu along, or empty for none.
		/// </summary>
		/// <remarks>
		/// A menu split into categories uses the development tree when one of its
		/// categories expands. A menu vanilla never split takes the axis that cuts most
		/// evenly — smallest largest bucket — among a short hand-picked list of cuts the
		/// game itself authored; an axis yielding fewer than two groups is not a choice.
		/// Judged on the buckets' sizes alone, so choosing an axis looks up no tab's picture.
		/// </remarks>
		public string StripAxis => _axis ??= ComputeStripAxis();

		private string ComputeStripAxis()
		{
			if (MenuCategoryCounts.Count(category => category.Id.Length > 0) > 1)
			{
				return ExpandedCategoryId.Length > 0 ? StripAxes.Development : string.Empty;
			}

			var best = string.Empty;
			var bestLargest = int.MaxValue;

			foreach (var axis in new[] { StripAxes.Development, StripAxes.AssetType })
			{
				var sizes = StripBuckets(TabSet, axis).Select(bucket => bucket.Count()).ToArray();

				if (sizes.Length < 2)
				{
					continue;
				}

				var largest = sizes.Max();

				if (largest < bestLargest)
				{
					best = axis;
					bestLargest = largest;
				}
			}

			return best;
		}

		/// <summary>The strip's tabs, on the axis the present set gives, each counting what it lists.</summary>
		/// <remarks>None without a menu, where the row draws All alone.</remarks>
		public IReadOnlyList<MenuBranchCount> StripTabs => _stripTabs ??= Scoped
			? Drawn(ComputeStripTabs(), FilteredTabSet)
			: Array.Empty<MenuBranchCount>();

		private IReadOnlyList<MenuBranchCount> ComputeStripTabs()
		{
			var axis = StripAxis;

			if (axis.Length == 0)
			{
				return Array.Empty<MenuBranchCount>();
			}

			var tabs = StripTabsFor(TabSet, axis);

			if (axis != StripAxes.AssetType)
			{
				return tabs;
			}

			// The tab set narrowed to the entries answering to the Buildings tab.
			var buildingNodes = StripTabsFor(
				TabSet.Where(entry => BuildingCatalogQueryEngine.StripMatches(entry, StripAxes.BuildingValue)).ToArray(),
				StripAxes.Development);

			if (buildingNodes.Count < 2)
			{
				return tabs;
			}

			return buildingNodes
				.Concat(tabs.Where(tab => tab.Id != StripAxes.BuildingValue))
				.ToArray();
		}

		/// <summary>The set cut along an axis, one bucket per value, entries with none left out.</summary>
		private static IEnumerable<IGrouping<string, BuildingCatalogEntry>> StripBuckets(IEnumerable<BuildingCatalogEntry> set, string axis) =>
			set
				.GroupBy(entry => BuildingCatalogQueryEngine.StripValue(entry, axis))
				.Where(group => group.Key.Length > 0);

		private IReadOnlyList<MenuBranchCount> StripTabsFor(IEnumerable<BuildingCatalogEntry> set, string axis)
		{
			var tabs = StripBuckets(set, axis)
				.Select(group => new
				{
					Tab = new MenuBranchCount(
						group.Key,
						group.Count(),
						StripIcon(axis, group.Key) ?? BuildingCatalogAdapter.TabIcon(group, axis == StripAxes.Development)),
					Depth = group.Min(entry => entry.DevTreeBranchDepth),
				})
				.OrderBy(x => axis == StripAxes.Development ? x.Depth : 0)
				.ThenByDescending(x => axis == StripAxes.Development ? 0 : x.Tab.Count)
				.ThenBy(x => x.Tab.Id, StringComparer.Ordinal)
				.Select(x => x.Tab)
				.ToArray();

			return Disambiguate(tabs, tab => StripIcon(axis, tab.Id, allowCategoryGlyph: false));
		}

		/// <summary>
		/// Gives a tab its own picture when the one it chose is already on a
		/// sibling.
		/// </summary>
		/// <remarks>
		/// The category-glyph fallback keeps a photograph out of a row of flat glyphs, but a menu
		/// whose tabs all sit in one category then draws one picture N times. Repeated is worse than
		/// off-idiom, and an authored icon is never displaced.
		/// </remarks>
		private static MenuBranchCount[] Disambiguate(
			MenuBranchCount[] tabs,
			Func<MenuBranchCount, string?> distinctIcon)
		{
			var shared = new HashSet<string>(
				tabs
					.Where(tab => tab.Icon.Length > 0)
					.GroupBy(tab => tab.Icon, StringComparer.Ordinal)
					.Where(group => group.Skip(1).Any())
					.Select(group => group.Key),
				StringComparer.Ordinal);

			if (shared.Count == 0)
			{
				return tabs;
			}

			return tabs
				.Select(tab =>
				{
					if (!shared.Contains(tab.Icon))
					{
						return tab;
					}

					var replacement = distinctIcon(tab);

					return replacement is { Length: > 0 } ? tab with { Icon = replacement } : tab;
				})
				.ToArray();
		}

		/// <summary>
		/// Tabs as the row draws them: in their place, each counting what a click on it lists, zero
		/// included, with a picture the row can show.
		/// </summary>
		/// <remarks>Matched as a click matches, whichever axis a tab is on: a branch, an asset type or a density.</remarks>
		private MenuBranchCount[] Drawn(IEnumerable<MenuBranchCount> tabs, IReadOnlyList<BuildingCatalogEntry> listed)
		{
			var drawn = tabs.ToArray();
			var counts = BuildingCatalogQueryEngine.StripCounts(listed, drawn.Select(tab => tab.Id).ToArray());

			return drawn
				.Select((tab, at) => tab with { Count = counts[at], Icon = CategoryIcon.Chain(tab.Icon, _menuIcon) })
				.ToArray();
		}

		/// <summary>
		/// The menu whatever the player has narrowed: no category, tab, tier, search, facets or
		/// ranges, and the pack-ignored projection where the toolbar's packs narrowed it. What a
		/// tab's icon is chosen from, so it names the same thing in every state.
		/// </summary>
		private BuildingCatalogEntry[] WholeMenu => _wholeMenu ??= _packScope is null
			? PresentSet
			// Only a pack selection makes a second projection worth reading.
			: BuildingCatalogQueryEngine.InScope(_packScope(), PresentQuery).ToArray();

		/// <summary>
		/// A development branch's tab icon, chosen from the whole category rather
		/// than from what a filter left of it.
		/// </summary>
		/// <remarks>
		/// Taken from the whole category rather than from what a filter left of it, so a facet that
		/// removes the representative asset cannot relabel the tab under the player.
		/// </remarks>
		private string? BranchIcon(string category, string branch, bool allowCategoryGlyph = true)
		{
			var whole = BuildingCatalogQueryEngine
				.InScope(WholeMenu, _query with { UiCategory = category, StripTabs = null, SchoolTier = -1, SearchText = string.Empty })
				.Where(entry => string.Equals(entry.DevTreeBranch, branch, StringComparison.Ordinal))
				.ToArray();

			return whole.Length == 0 ? null : BuildingCatalogAdapter.TabIcon(whole, authored: true, allowCategoryGlyph);
		}

		/// <summary>
		/// A strip tab's icon from the whole menu, so it does not change when a filter changes which
		/// assets are left in the tab.
		/// </summary>
		private string? StripIcon(string axis, string key, bool allowCategoryGlyph = true)
		{
			var whole = WholeMenu
				.Where(entry => string.Equals(BuildingCatalogQueryEngine.StripValue(entry, axis), key, StringComparison.Ordinal))
				.ToArray();

			return whole.Length == 0
				? null
				: BuildingCatalogAdapter.TabIcon(whole, axis == StripAxes.Development, allowCategoryGlyph);
		}

		/// <summary>Education's levels beside the tab that holds its schools; empty outside Education.</summary>
		/// <remarks>
		/// The tab and its levels come from the present set, so neither a filter nor the search moves
		/// them; each level counts what a click lists, the tab's own schools at that level.
		/// </remarks>
		public TierBracket TierBracket => _bracket ??= ComputeTierBracket();

		private TierBracket ComputeTierBracket()
		{
			IGrouping<string, BuildingCatalogEntry>? parent = _educationMenu
				? PresentSet
					.Where(entry => entry.EducationLevel is >= 1 and <= 4)
					.GroupBy(TabOf, StringComparer.Ordinal)
					.Where(group => group.Key.Length > 0)
					.OrderByDescending(group => group.Count())
					.ThenBy(group => group.Key, StringComparer.Ordinal)
					.FirstOrDefault()
				: null;

			if (parent is null)
			{
				return TierBracket.Empty;
			}

			var listed = FilteredMenuSet.Where(entry => string.Equals(TabOf(entry), parent.Key, StringComparison.Ordinal)).ToArray();
			var tiers = parent
				.Select(entry => entry.EducationLevel.GetValueOrDefault())
				.Distinct()
				.OrderBy(level => level)
				.Select(level => new MenuBranchCount(
					level.ToString(System.Globalization.CultureInfo.InvariantCulture),
					listed.Count(entry => entry.EducationLevel == level),
					BuildingCatalogAdapter.SchoolTierIcon,
					BuildingCatalogGrouping.SchoolTierLabel(level, _schoolTierNames) ?? string.Empty))
				.ToArray();

			return new TierBracket(parent.Key, listed.Length, tiers);
		}
	}
}
