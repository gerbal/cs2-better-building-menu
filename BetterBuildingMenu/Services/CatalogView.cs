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
	/// The snapshot is scoped to the menu ONCE (<see cref="MenuSet"/>); every other answer is a
	/// pass over that much smaller array, computed once and kept, so a refresh does not re-derive
	/// the same scope for each question it asks.
	/// </remarks>
	public sealed class CatalogView
	{
		private readonly IReadOnlyList<BuildingCatalogEntry> _snapshot;
		private readonly BuildingCatalogQuery _query;
		private readonly Func<IReadOnlyList<BuildingCatalogEntry>>? _packScope;
		private readonly Func<CatalogView, string>? _groupByResolver;
		private readonly IReadOnlyList<string>? _milestoneNames;
		private readonly bool _educationMenu;
		private readonly bool _vanillaSelected;
		private string? _effectiveGroupBy;
		private string[]? _dimensions;

		private BuildingCatalogEntry[]? _menuSet, _viewSet, _tabSet, _tierSet, _wholeMenu;
		private BuildingCatalogPage? _page;
		private BuildingCatalogMetricRangeState? _bounds;
		private BuildingCatalogFacetState? _facets;
		private IReadOnlyList<MenuCategoryCount>? _counts;
		private string? _expandedId, _axis;
		private IReadOnlyList<MenuBranchCount>? _expandedTabs, _stripTabs, _tiers;
		private IReadOnlyList<MenuCategoryTabs>? _expanded;

		public CatalogView(
			IReadOnlyList<BuildingCatalogEntry> snapshot,
			BuildingCatalogQuery query,
			Func<IReadOnlyList<BuildingCatalogEntry>>? packScope = null,
			Func<CatalogView, string>? groupByResolver = null,
			IReadOnlyList<string>? milestoneNames = null,
			bool educationMenu = false,
			bool vanillaSelected = false)
		{
			_snapshot = snapshot ?? throw new ArgumentNullException(nameof(snapshot));
			_query = query ?? throw new ArgumentNullException(nameof(query));
			_packScope = packScope;
			_groupByResolver = groupByResolver;
			_milestoneNames = milestoneNames;
			_educationMenu = educationMenu;
			_vanillaSelected = vanillaSelected;
		}

		/// <summary>The dimension ids the picker should offer for this menu set.</summary>
		public string[] GroupDimensions => _dimensions ??= BuildingCatalogGrouping.OfferedDimensions(MenuSet, _educationMenu);

		/// <summary>The grouping the page is ordered by: the player's choice, or the menu's default.</summary>
		/// <remarks>
		/// Resolved here rather than by the UI. The resolver may read this view's own strip axis;
		/// nothing it reads depends on Page, so there is no cycle.
		/// </remarks>
		public string EffectiveGroupBy => _effectiveGroupBy ??= _groupByResolver?.Invoke(this) ?? _query.GroupBy;

		/// <summary>The menu, with category, strip tab and school tier cleared. The one pass over the snapshot.</summary>
		public BuildingCatalogEntry[] MenuSet => _menuSet ??=
			BuildingCatalogQueryEngine.InScope(_snapshot, _query with { UiCategory = string.Empty, StripTabs = null, SchoolTier = -1 }).ToArray();

		/// <summary>What the page is drawn from: menu, category, tab and tier, facets cleared.</summary>
		public BuildingCatalogEntry[] ViewSet => _viewSet ??= BuildingCatalogQueryEngine.InScope(MenuSet, _query).ToArray();

		/// <summary>Menu, category and tier, but no strip tab — what the strip counts.</summary>
		public BuildingCatalogEntry[] TabSet => _tabSet ??= BuildingCatalogQueryEngine.InScope(MenuSet, _query with { StripTabs = null }).ToArray();

		/// <summary>Menu and strip tab, no category or tier — what the school tiers count.</summary>
		public BuildingCatalogEntry[] TierSet => _tierSet ??= BuildingCatalogQueryEngine.InScope(MenuSet, _query with { SchoolTier = -1, UiCategory = string.Empty }).ToArray();

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
					var labels = BuildingCatalogGrouping.Labels(entry, dimension, _milestoneNames);
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
		/// How many assets each of the menu's category tabs holds.
		/// </summary>
		/// <remarks>
		/// The category's own axis is excluded, so choosing one tab does not read every
		/// other as empty; search and facets do count. Counted against the category the
		/// entry answers to IN THIS MENU rather than its own UiCategory.
		/// </remarks>
		public IReadOnlyList<MenuCategoryCount> MenuCategoryCounts => _counts ??= MenuSet
			.GroupBy(entry => NetworkMenuExtension.EffectiveCategory(entry, _query.UiMenu) ?? string.Empty)
			.Select(group => new MenuCategoryCount(group.Key, group.Count()))
			.OrderBy(count => count.Id, StringComparer.Ordinal)
			.ToArray();

		public string ExpandedCategoryId => _expandedId ??= ComputeExpandedCategoryId();

		private string ComputeExpandedCategoryId()
		{
			if (MenuCategoryCounts.Count(category => category.Id.Length > 0) < 2)
			{
				return string.Empty;
			}

			return MenuSet
				.Where(entry => !string.IsNullOrEmpty(entry.DevTreeBranch))
				.GroupBy(entry => NetworkMenuExtension.EffectiveCategory(entry, _query.UiMenu) ?? string.Empty)
				.Where(group => group.Key.Length > 0
					&& group.Select(entry => entry.DevTreeBranch).Distinct(StringComparer.Ordinal).Count() > 1)
				.OrderByDescending(group => group.Count())
				.ThenBy(group => group.Key, StringComparer.Ordinal)
				.Select(group => group.Key)
				.FirstOrDefault() ?? string.Empty;
		}

		public IReadOnlyList<MenuBranchCount> ExpandedCategoryTabs => _expandedTabs ??= ComputeExpandedCategoryTabs();

		private IReadOnlyList<MenuBranchCount> ComputeExpandedCategoryTabs()
		{
			var category = ExpandedCategoryId;

			if (category.Length == 0)
			{
				return Array.Empty<MenuBranchCount>();
			}

			// The menu set narrowed to that category, tier kept, tabs cleared.
			var tabs = BuildingCatalogQueryEngine
				.InScope(MenuSet, _query with { UiCategory = category, StripTabs = null })
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

		public IReadOnlyList<MenuCategoryTabs> ExpandedCategories => _expanded ??= ComputeExpandedCategories();

		private IReadOnlyList<MenuCategoryTabs> ComputeExpandedCategories()
		{
			var density = BuildingCatalogAdapter.BuildDensityTabs(MenuSet, _query.UiMenu);

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
		/// Which axis the fallback strip should use for this menu, and its tabs.
		/// </summary>
		/// <remarks>
		/// Only for the menus vanilla never split. The axis that cuts most evenly wins —
		/// smallest largest bucket — among a short hand-picked list of cuts the game
		/// itself authored; an axis yielding fewer than two groups is not a choice.
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
				var tabs = StripTabsFor(TabSet, axis);

				if (tabs.Count < 2)
				{
					continue;
				}

				var largest = tabs.Max(tab => tab.Count);

				if (largest < bestLargest)
				{
					best = axis;
					bestLargest = largest;
				}
			}

			return best;
		}

		public IReadOnlyList<MenuBranchCount> StripTabs => _stripTabs ??= ComputeStripTabs();

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

		private IReadOnlyList<MenuBranchCount> StripTabsFor(IEnumerable<BuildingCatalogEntry> set, string axis)
		{
			var tabs = set
				.GroupBy(entry => BuildingCatalogQueryEngine.StripValue(entry, axis))
				.Where(group => group.Key.Length > 0)
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
		/// The menu whatever the player has narrowed: no category, tab, tier, search or facets, and
		/// the pack-ignored projection where the toolbar's packs narrowed it. What a tab's icon is
		/// chosen from, so it names the same thing in every state.
		/// </summary>
		private BuildingCatalogEntry[] WholeMenu => _wholeMenu ??= BuildingCatalogQueryEngine
			.InScope(
				// The menu set is the one walk over the snapshot; only a pack
				// selection makes a second projection worth reading.
				_packScope?.Invoke() ?? MenuSet,
				_query with { UiCategory = string.Empty, StripTabs = null, SchoolTier = -1, SearchText = string.Empty })
			.ToArray();

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

		public IReadOnlyList<MenuBranchCount> SchoolTierCounts => _tiers ??= TierSet
			.Where(entry => entry.EducationLevel is >= 1 and <= 4)
			.GroupBy(entry => entry.EducationLevel.GetValueOrDefault())
			.Select(group => new MenuBranchCount(
				group.Key.ToString(System.Globalization.CultureInfo.InvariantCulture),
				group.Count(),
				BuildingCatalogAdapter.SchoolTierIcon))
			.OrderBy(count => count.Id, StringComparer.Ordinal)
			.ToArray();
	}
}
