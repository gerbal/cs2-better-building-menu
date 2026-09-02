using System;
using System.Collections.Generic;
using System.Linq;
using FindItBuildingMenu.Domain;

namespace FindItBuildingMenu.Services
{
	/// <summary>
	/// Every answer one refresh needs, from one pass over the snapshot.
	/// </summary>
	/// <remarks>
	/// The adapter used to answer eight questions per refresh and start each
	/// from the projected snapshot with a full InScope pass — fifteen to
	/// twenty passes, and GetStripAxis alone reached GetMenuCategoryCounts
	/// through three chains. Here the snapshot is scoped to the menu ONCE
	/// (<see cref="MenuSet"/>); everything else is a pass over that much
	/// smaller array, and every property is computed once and kept.
	///
	/// The derivations are the adapter's old bodies, verbatim except for the
	/// set they read; CatalogViewTests holds each against the static helper
	/// it replaces.
	/// </remarks>
	public sealed class CatalogView
	{
		private readonly IReadOnlyList<BuildingCatalogEntry> _snapshot;
		private readonly BuildingCatalogQuery _query;
		private readonly Func<IReadOnlyList<BuildingCatalogEntry>>? _packScope;
		private readonly Func<CatalogView, string>? _groupByResolver;
		private readonly IReadOnlyList<string>? _milestoneNames;
		private readonly bool _educationMenu;
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
			bool educationMenu = false)
		{
			_snapshot = snapshot ?? throw new ArgumentNullException(nameof(snapshot));
			_query = query ?? throw new ArgumentNullException(nameof(query));
			_packScope = packScope;
			_groupByResolver = groupByResolver;
			_milestoneNames = milestoneNames;
			_educationMenu = educationMenu;
		}

		/// <summary>The dimension ids the picker should offer for this menu set.</summary>
		public string[] GroupDimensions => _dimensions ??= BuildingCatalogGrouping.OfferedDimensions(MenuSet, _educationMenu);

		/// <summary>The grouping the page is ordered by: the player's choice, or the menu's default.</summary>
		/// <remarks>
		/// Resolved here rather than by the UI, which used to derive it from
		/// three bindings and push it back — a second refresh on every first
		/// open. The resolver may read this view's own strip axis; nothing it
		/// reads depends on Page, so there is no cycle.
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
			_packScope is null ? ViewSet : BuildingCatalogQueryEngine.InScope(_packScope(), _query));

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

			// The menu set narrowed to that category, tier kept, tabs cleared —
			// what `query with { UiCategory = category, StripTabs = null }` read.
			return BuildingCatalogQueryEngine
				.InScope(MenuSet, _query with { UiCategory = category, StripTabs = null })
				.Where(entry => !string.IsNullOrEmpty(entry.DevTreeBranch))
				.GroupBy(entry => entry.DevTreeBranch!)
				.OrderBy(group => group.Min(entry => entry.DevTreeBranchDepth))
				.ThenBy(group => group.Key, StringComparer.Ordinal)
				.Select(group => new MenuBranchCount(
					group.Key,
					group.Count(),
					BranchIcon(category, group.Key) ?? BuildingCatalogAdapter.TabIcon(group, authored: true)))
				.ToArray();
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

			// The adapter re-queried with StripTabs = [Buildings]; that is the
			// tab set narrowed to the entries answering to the Buildings tab.
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

		private IReadOnlyList<MenuBranchCount> StripTabsFor(IEnumerable<BuildingCatalogEntry> set, string axis) =>
			set
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

		/// <summary>
		/// The menu as it is whatever the player has narrowed: no category, tab or
		/// tier, no search, no facets, and — where the toolbar's pack selection
		/// narrowed the projection itself — the pack-ignored projection. What a
		/// tab's icon is chosen from, so it names the same thing in every state.
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
		/// cm-2xvs.17: the icon used to come from the filtered group, so a facet
		/// that removed the representative asset relabelled the tab under the
		/// player — Transportation's first tab went from Road to Bus when a
		/// content pack was chosen. The whole category (menu set: no tier, no
		/// facets, no search) is the same set in every state.
		/// </remarks>
		private string? BranchIcon(string category, string branch)
		{
			var whole = BuildingCatalogQueryEngine
				.InScope(WholeMenu, _query with { UiCategory = category, StripTabs = null, SchoolTier = -1, SearchText = string.Empty })
				.Where(entry => string.Equals(entry.DevTreeBranch, branch, StringComparison.Ordinal))
				.ToArray();

			return whole.Length == 0 ? null : BuildingCatalogAdapter.TabIcon(whole, authored: true);
		}

		/// <summary>
		/// A strip tab's icon from the whole menu, so it does not change when a
		/// filter changes which assets are left in the tab (cm-2xvs.17).
		/// </summary>
		private string? StripIcon(string axis, string key)
		{
			var whole = WholeMenu
				.Where(entry => string.Equals(BuildingCatalogQueryEngine.StripValue(entry, axis), key, StringComparison.Ordinal))
				.ToArray();

			return whole.Length == 0 ? null : BuildingCatalogAdapter.TabIcon(whole, axis == StripAxes.Development);
		}

		public IReadOnlyList<MenuBranchCount> SchoolTierCounts => _tiers ??= TierSet
			.Where(entry => entry.EducationLevel is >= 1 and <= 4)
			.GroupBy(entry => entry.EducationLevel!.Value)
			.Select(group => new MenuBranchCount(
				group.Key.ToString(System.Globalization.CultureInfo.InvariantCulture),
				group.Count(),
				BuildingCatalogAdapter.SchoolTierIcon))
			.OrderBy(count => count.Id, StringComparer.Ordinal)
			.ToArray();
	}
}
