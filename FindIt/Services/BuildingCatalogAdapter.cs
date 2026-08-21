using Colossal.PSI.Common;

using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Systems;
using FindItBuildingMenu.Utilities;

using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace FindItBuildingMenu.Services
{
	/// <summary>
	/// Projects FindIt's indexed prefab records into the successor's building
	/// lens. This is deliberately not an ECS query: PrefabIndexingSystem remains
	/// the single source of truth for discovery, categorisation, thumbnails, and
	/// placement identity.
	/// </summary>
	public sealed class BuildingCatalogAdapter
	{
		private static readonly (BuildingFlags Flag, string Name)[] PlacementFlagDescriptors =
		{
			(BuildingFlags.RequireRoad, nameof(BuildingFlags.RequireRoad)),
			(BuildingFlags.NoRoadConnection, nameof(BuildingFlags.NoRoadConnection)),
			(BuildingFlags.LeftAccess, nameof(BuildingFlags.LeftAccess)),
			(BuildingFlags.RightAccess, nameof(BuildingFlags.RightAccess)),
			(BuildingFlags.BackAccess, nameof(BuildingFlags.BackAccess)),
			(BuildingFlags.RestrictedPedestrian, nameof(BuildingFlags.RestrictedPedestrian)),
			(BuildingFlags.RestrictedCar, nameof(BuildingFlags.RestrictedCar)),
			(BuildingFlags.ColorizeLot, nameof(BuildingFlags.ColorizeLot)),
			(BuildingFlags.HasLowVoltageNode, nameof(BuildingFlags.HasLowVoltageNode)),
			(BuildingFlags.HasWaterNode, nameof(BuildingFlags.HasWaterNode)),
			(BuildingFlags.HasSewageNode, nameof(BuildingFlags.HasSewageNode)),
			(BuildingFlags.HasInsideRoom, nameof(BuildingFlags.HasInsideRoom)),
			(BuildingFlags.RestrictedParking, nameof(BuildingFlags.RestrictedParking)),
			(BuildingFlags.RestrictedTrack, nameof(BuildingFlags.RestrictedTrack)),
			(BuildingFlags.CanBeOnRoad, nameof(BuildingFlags.CanBeOnRoad)),
			(BuildingFlags.CanBeOnRoadArea, nameof(BuildingFlags.CanBeOnRoadArea)),
			(BuildingFlags.RequireAccess, nameof(BuildingFlags.RequireAccess)),
			(BuildingFlags.CanBeRoadSide, nameof(BuildingFlags.CanBeRoadSide)),
			(BuildingFlags.HasResourceNode, nameof(BuildingFlags.HasResourceNode)),
		};

		/// <summary>
		/// The state of the game's own toolbar filter row.
		/// </summary>
		/// <remarks>
		/// Static because everything that reads it here is, and because there is
		/// exactly one toolbar. Written by FindItUISystem when the UI reports a
		/// change; <see cref="VanillaToolbarSelection.None"/> until then, which
		/// filters nothing.
		/// </remarks>
		public static VanillaToolbarSelection ToolbarSelection { get; set; } = VanillaToolbarSelection.None;

		public static string[] GetPlacementFlagNames(BuildingFlags? flags)
		{
			if (!flags.HasValue)
			{
				return Array.Empty<string>();
			}

			return PlacementFlagDescriptors
				.Where(descriptor => flags.Value.HasFlag(descriptor.Flag))
				.Select(descriptor => descriptor.Name)
				.ToArray();
		}

		public BuildingCatalogFacetState GetFacetState(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			// Scoped to the view, not to the whole index — see InScope.
			return BuildFacetState(
				BuildingCatalogQueryEngine.InScope(GetIndexedBuildings(query.UiMenu).Select(Project), query),
				query);
		}

		/// <summary>
		/// How many assets each of the menu's category tabs holds.
		/// </summary>
		/// <remarks>
		/// The category's OWN axis is excluded, which is the same rule the facet
		/// groups follow and for the same reason: counted with it in, choosing
		/// Vegetation would make every other tab read 0, so the control that
		/// would widen the result again tells you there is nothing to widen to.
		/// The search and the facets DO count, because a tab claiming 22 when
		/// the active search leaves 3 behind it is worse than no number.
		///
		/// Keyed by the same Id the tabs carry, and counted against the category
		/// the entry answers to IN THIS MENU rather than its own UiCategory.
		/// Those differ for the extra networks the Roads menu adopts — a
		/// seaway's own category is TransportationShip, and the tab it sits
		/// under is a Roads one — which is the same distinction
		/// MatchesVanillaMenuTree makes when it decides what a tab SELECTS.
		///
		/// Counting on the raw value made the two disagree: ten Roads tabs
		/// reported 0 while selecting one of them showed assets, so a tab that
		/// worked read as an empty one. It went unnoticed while a missing count
		/// rendered blank; it became visible the moment absent-but-known
		/// started rendering as 0.
		/// </remarks>
		public IReadOnlyList<MenuCategoryCount> GetMenuCategoryCounts(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			// The school levels are drawn in the Education category's own place,
			// so for counting purposes they are the SAME axis as the categories
			// and both come off. Dropping only UiCategory made picking a level
			// count Research against that level — zero — and visibleCategories
			// then removed the Research tab entirely, so choosing a school tier
			// made the other half of the menu unreachable.
			var acrossCategories = query with { UiCategory = string.Empty, SchoolTier = -1, StripTab = string.Empty };

			return BuildingCatalogQueryEngine
				.InScope(GetIndexedBuildings(query.UiMenu).Select(Project), acrossCategories)
				.GroupBy(entry => NetworkMenuExtension.EffectiveCategory(entry, query.UiMenu) ?? string.Empty)
				.Where(group => group.Key.Length > 0)
				.Select(group => new MenuCategoryCount(group.Key, group.Count()))
				.OrderBy(count => count.Id, StringComparer.Ordinal)
				.ToArray();
		}

		/// <summary>
		/// How many assets each of the menu's progression tabs holds.
		/// </summary>
		/// <remarks>
		/// Same axis rule as the categories: the milestone's own filter is
		/// dropped so the tiers keep counting each other, everything else —
		/// including the SELECTED CATEGORY — stays on. That is what makes the
		/// tiers a subset of the category rather than a second, independent
		/// menu: pick Vegetation and the tier tabs count Vegetation only.
		///
		/// Ordered by index, because the index is the progression. The
		/// categories sort by id for stability alone; here the order is the
		/// meaning, and a tier strip running out of order would misstate it.
		/// </remarks>
		/// <summary>
		/// Which axis the fallback strip should use for this menu, and its tabs.
		/// </summary>
		/// <remarks>
		/// Vanilla's categories are the reference and are handled elsewhere;
		/// this is only for the menus vanilla never split, where there is no
		/// authored answer and we have to pick one.
		///
		/// CHOSEN BY FIT, not by a fixed order. The strip exists to cut a large
		/// set down, so the axis that cuts most evenly is the one worth drawing
		/// — measured as the smallest largest-bucket. A fixed chain gets this
		/// wrong in both directions on real data: the development tree splits
		/// Electricity 8/4/3 and Garbage 2/2/1, but Water only 9/2, where
		/// buildings-against-pipes is 8/3.
		///
		/// Balance is the TIEBREAK, not the criterion. Both candidates are
		/// meaningful cuts the game itself authored; a merely even split of
		/// something meaningless would be worse than a lopsided honest one,
		/// which is why the candidate list is short and hand-picked rather than
		/// every field that happens to vary.
		///
		/// An axis that yields fewer than two groups is not a choice and is
		/// dropped, which is also what leaves a single-tree menu with no strip
		/// rather than one tab.
		/// </remarks>
		/// <summary>
		/// The category the strip draws as its development branches instead of
		/// as one tab, or empty.
		/// </summary>
		/// <remarks>
		/// The same move the education menu makes with school levels, on the
		/// menus that have no level to make it with. Police and Fire each hold
		/// one category that is the service proper and one that is a sideline —
		/// Police against Administration, Fire &amp; Rescue against
		/// DisasterControl — and the service half is where the assets are and
		/// where a single tab is least useful.
		///
		/// Chosen by evidence rather than named: the category whose assets span
		/// two or more development branches, largest first when several do.
		/// That is the category with a sub-axis to draw, by construction, and
		/// it needs no table of menu names to maintain.
		///
		/// Empty when the menu has fewer than two categories, because then the
		/// strip has no category row to expand INTO — that is the fallback
		/// case, and GetStripAxis handles it.
		/// </remarks>
		public string GetExpandedCategoryId(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			var categories = GetMenuCategoryCounts(query);

			if (categories.Count < 2)
			{
				return string.Empty;
			}

			var unscoped = query with
			{
				UiCategory = string.Empty,
				StripTab = string.Empty,
				SchoolTier = -1,
			};

			return BuildingCatalogQueryEngine
				.InScope(GetIndexedBuildings(query.UiMenu).Select(Project), unscoped)
				.Where(entry => !string.IsNullOrEmpty(entry.DevTreeBranch))
				.GroupBy(entry => NetworkMenuExtension.EffectiveCategory(entry, query.UiMenu) ?? string.Empty)
				.Where(group => group.Key.Length > 0
					&& group.Select(entry => entry.DevTreeBranch).Distinct(StringComparer.Ordinal).Count() > 1)
				.OrderByDescending(group => group.Count())
				.ThenBy(group => group.Key, StringComparer.Ordinal)
				.Select(group => group.Key)
				.FirstOrDefault() ?? string.Empty;
		}

		/// <summary>The branch tabs that stand in for the expanded category.</summary>
		/// <remarks>
		/// Ordered by the branch's column in the tree, so the rank drawn over
		/// them follows the game's own progression: the basic stations before
		/// the headquarters they lead to, whatever the alphabet says.
		/// </remarks>
		public IReadOnlyList<MenuBranchCount> GetExpandedCategoryTabs(BuildingCatalogQuery query)
		{
			var category = GetExpandedCategoryId(query);

			if (category.Length == 0)
			{
				return Array.Empty<MenuBranchCount>();
			}

			// Scoped to the expanded category and counted across the tabs' own
			// axis, which is the rule every counter here follows.
			var withinCategory = query with { UiCategory = category, StripTab = string.Empty };

			return BuildingCatalogQueryEngine
				.InScope(GetIndexedBuildings(query.UiMenu).Select(Project), withinCategory)
				.Where(entry => !string.IsNullOrEmpty(entry.DevTreeBranch))
				.GroupBy(entry => entry.DevTreeBranch!)
				.OrderBy(group => group.Min(entry => entry.DevTreeBranchDepth))
				.ThenBy(group => group.Key, StringComparer.Ordinal)
				.Select(group => new MenuBranchCount(
					group.Key,
					group.Count(),
					TabIcon(group, authored: true)))
				.ToArray();
		}

		public string GetStripAxis(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			// Nothing to choose when vanilla already split the menu: its
			// categories are the strip, and the fallback is not drawn. Reported
			// as empty rather than "the axis we would have picked", because the
			// UI reads this to decide what the menu is organised BY — and on
			// Education, which has categories, a would-be answer put the Group
			// by picker on Development while the strip showed Education and
			// Research.
			if (GetMenuCategoryCounts(query).Count > 1)
			{
				// A category menu still uses the development axis when one of
				// its categories is drawn as branches — the tabs and the
				// predicate have to agree on that, or clicking one matches
				// nothing.
				return GetExpandedCategoryId(query).Length > 0
					? StripAxes.Development
					: string.Empty;
			}

			var best = string.Empty;
			var bestLargest = int.MaxValue;

			foreach (var axis in new[] { StripAxes.Development, StripAxes.AssetType })
			{
				var tabs = StripTabsFor(query, axis);

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

		/// <summary>The fallback strip's tabs, on whichever axis it chose.</summary>
		/// <remarks>
		/// On the ASSET TYPE axis the buildings half is drawn as its development
		/// nodes where it has more than one, so Water reads as its pumping and
		/// treatment unlocks beside a single Networks tab for the pipes —
		/// rather than one undifferentiated "Buildings 8". The row mixes axes
		/// deliberately; see BuildingCatalogQueryEngine.StripMatches.
		///
		/// Only the buildings half expands. Networks are a handful of tools the
		/// tree rarely gates, and splitting them would trade one honest tab for
		/// several near-empty ones.
		/// </remarks>
		public IReadOnlyList<MenuBranchCount> GetStripTabs(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			var axis = GetStripAxis(query);

			if (axis.Length == 0)
			{
				return Array.Empty<MenuBranchCount>();
			}

			var tabs = StripTabsFor(query, axis);

			if (axis != StripAxes.AssetType)
			{
				return tabs;
			}

			var buildingNodes = StripTabsFor(
				query with { StripTab = StripAxes.BuildingValue },
				StripAxes.Development);

			if (buildingNodes.Count < 2)
			{
				return tabs;
			}

			return buildingNodes
				.Concat(tabs.Where(tab => tab.Id != StripAxes.BuildingValue))
				.ToArray();
		}

		/// <summary>
		/// The tabs one axis would draw, counted with its own filter dropped.
		/// </summary>
		/// <remarks>
		/// Same axis rule as every other counter here: the tab's own narrowing
		/// comes off so the tabs keep counting each other, and everything else
		/// — the search, the facets, the selected category — stays on.
		/// </remarks>
		private IReadOnlyList<MenuBranchCount> StripTabsFor(BuildingCatalogQuery query, string axis)
		{
			var acrossTabs = query with { StripTab = string.Empty };

			return BuildingCatalogQueryEngine
				.InScope(GetIndexedBuildings(query.UiMenu).Select(Project), acrossTabs)
				.GroupBy(entry => BuildingCatalogQueryEngine.StripValue(entry, axis))
				.Where(group => group.Key.Length > 0)
				// Development tabs run in UNLOCK order — the root, then each node
				// by its column in the tree — because that is the order the
				// player meets them in and the only order the tabs have a claim
				// to. Sorted by size they ran Nuclear before Solar, which is
				// backwards in the one sense the axis is about.
				//
				// Everything else has no inherent order, so the biggest bucket
				// leads: it is the most useful stable arrangement when the tabs
				// are merely different rather than sequential.
				.Select(group => new
				{
					Tab = new MenuBranchCount(
						group.Key,
						group.Count(),
						TabIcon(group, axis == StripAxes.Development)),
					Depth = group.Min(entry => entry.DevTreeBranchDepth),
				})
				.OrderBy(x => axis == StripAxes.Development ? x.Depth : 0)
				.ThenByDescending(x => axis == StripAxes.Development ? 0 : x.Tab.Count)
				.ThenBy(x => x.Tab.Id, StringComparer.Ordinal)
				.Select(x => x.Tab)
				.ToArray();
		}

		/// <summary>
		/// <summary>
		/// The glyph every school-level tab is built on.
		/// </summary>
		/// <remarks>
		/// The citizen attainment ladder — Uneducated, Poorly Educated,
		/// Educated, Well Educated, Highly Educated — is five flat, ordinal
		/// glyphs, and a school's level IS the attainment it grants:
		/// GraduationSystem reads SchoolData.m_EducationLevel and passes it
		/// straight to Citizen.SetEducationLevel, read off the game's IL rather
		/// than assumed. So level N draws the badge a graduate of that school
		/// wears.
		///
		/// One mortarboard for all four, with the rank drawn over it as a roman
		/// numeral. The four attainment glyphs were tried as the base and read
		/// as four different subjects rather than four rungs of one — which
		/// matters more now that the levels sit in the SAME row as the Research
		/// category, where the row's job is to say what kind of thing each tab
		/// is before it says how much of it there is.
		///
		/// A representative school's THUMBNAIL was the first attempt and does
		/// not work at all: vanilla's tab glyphs are flat two-colour symbols
		/// drawn for 24rem, and a building render at that size is a dark
		/// smudge, four of which look alike.
		/// </remarks>
		private const string SchoolTierIcon = "Media/Game/Icons/Education.svg";

		/// <summary>The progression screen's badge for a milestone, if any.</summary>
		private static string MilestoneIcon(int milestone)
		{
			var icons = PrefabIndexingSystem.GetMilestoneIcons();

			return milestone >= 0 && milestone < icons.Length ? icons[milestone] ?? string.Empty : string.Empty;
		}

		/// <summary>
		/// The glyph a tab draws.
		/// </summary>
		/// <remarks>
		/// An AUTHORED icon first, where the axis has one: the development tree
		/// ships an icon per node and that is the art the player already
		/// associates with the unlock.
		///
		/// Otherwise a REPRESENTATIVE asset's thumbnail. "Buildings",
		/// "Networks" and the four school levels are ours or the simulation's
		/// words, and the game ships no glyph for any of them — but a tab
		/// showing a bare count is a tab with nothing on it, and words on this
		/// row were reported as disruptive the first time. A water pipe is a
		/// serviceable picture of "Networks"; an elementary school is a
		/// serviceable picture of Elementary.
		///
		/// Deterministic: the menu's own priority, then name, so the glyph does
		/// not change when the player re-sorts. Falls back to the fallback
		/// thumbnail, which is what the grid draws for the same asset.
		/// </remarks>
		private static string TabIcon(IEnumerable<BuildingCatalogEntry> group, bool authored)
		{
			var entries = group.ToArray();

			if (authored)
			{
				var icon = entries
					.Select(entry => entry.DevTreeBranchIcon)
					.FirstOrDefault(value => !string.IsNullOrEmpty(value));

				if (!string.IsNullOrEmpty(icon))
				{
					return icon!;
				}
			}

			return entries
				.OrderBy(entry => entry.UiCategoryPriority)
				.ThenBy(entry => entry.Name, StringComparer.Ordinal)
				.Select(entry => !string.IsNullOrEmpty(entry.Thumbnail) ? entry.Thumbnail : entry.FallbackThumbnail)
				.FirstOrDefault(value => !string.IsNullOrEmpty(value)) ?? string.Empty;
		}

		/// <summary>
		/// How many assets each of the education menu's tier tabs holds.
		/// </summary>
		/// <remarks>
		/// The tier axis for the one menu where the progression is not what the
		/// player is navigating by. With several region packs installed there
		/// are dozens of schools per level, and "which level" is the question —
		/// the milestone they unlocked at is not.
		///
		/// Keyed by the raw level rather than a name, so the four labels stay in
		/// the UI's SCHOOL_TIERS table instead of being duplicated across the
		/// binding. Levels 0 and 5 are dropped: 0 is a capacity upgrade with no
		/// tier and 5 is the outside connection, and neither is a tab.
		/// </remarks>
		public IReadOnlyList<MenuBranchCount> GetMenuSchoolTierCounts(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			// The other half of the same rule: a category picked in that row
			// must not collapse the level counts beside it.
			var acrossTiers = query with { SchoolTier = -1, UiCategory = string.Empty };

			return BuildingCatalogQueryEngine
				.InScope(GetIndexedBuildings(query.UiMenu).Select(Project), acrossTiers)
				.Where(entry => entry.EducationLevel is >= 1 and <= 4)
				.GroupBy(entry => entry.EducationLevel!.Value)
				.Select(group => new MenuBranchCount(
					group.Key.ToString(System.Globalization.CultureInfo.InvariantCulture),
					group.Count(),
					SchoolTierIcon))
				.OrderBy(count => count.Id, StringComparer.Ordinal)
				.ToArray();
		}

		public IReadOnlyList<MenuBranchCount> GetMenuMilestoneCounts(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			var acrossMilestones = query with { UnlockMilestone = BuildingCatalogQuery.AnyMilestone };

			return BuildingCatalogQueryEngine
				.InScope(GetIndexedBuildings(query.UiMenu).Select(Project), acrossMilestones)
				.GroupBy(entry => entry.UnlockMilestone)
				.Where(group => group.Key >= 0)
				.Select(group => new MenuBranchCount(
					group.Key.ToString(System.Globalization.CultureInfo.InvariantCulture),
					group.Count(),
					// The milestone's own badge where the game has one. It has
					// none for index 0, which is the ungated bucket rather than
					// a milestone, so that tab falls back to a representative
					// asset like every other iconless tab here.
					MilestoneIcon(group.Key) is { Length: > 0 } badge
						? badge
						: TabIcon(group, authored: false)))
				.OrderBy(count => int.Parse(count.Id, System.Globalization.CultureInfo.InvariantCulture))
				.ToArray();
		}

		/// <summary>
		/// The spread each metric actually has in the current view.
		/// </summary>
		/// <remarks>
		/// So the range fields can open at the real minimum and maximum instead
		/// of blank. Blank asks the player to guess the scale before they can
		/// narrow it — nothing said a Police menu runs from 30,000 to 650,000 —
		/// and a bound typed outside the real range silently empties the list.
		///
		/// Computed from InScope, exactly like the facet options, and for the
		/// same reason turned up a level: InScope clears the facet AND metric
		/// selections, so the bounds describe the menu rather than the filtered
		/// result. Seeded from the filtered result they would ratchet inward on
		/// every narrowing and could never widen again — type 200,000 as a
		/// maximum and 200,000 becomes the new ceiling.
		///
		/// Reuses the range-state shape rather than inventing a bounds type: the
		/// twelve numbers are the same twelve, and the UI already reads them.
		/// Its HasSelection is meaningless here and nothing asks.
		/// </remarks>
		public BuildingCatalogMetricRangeState GetMetricBounds(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			return MetricBoundsOf(
				BuildingCatalogQueryEngine.InScope(GetIndexedBuildings(query.UiMenu).Select(Project), query));
		}

		/// <summary>
		/// The same arithmetic over a set of entries, without a World.
		/// </summary>
		/// <remarks>
		/// Split out so the rule can be tested directly, the way BuildFacetState
		/// is. What belongs to the running game is deciding WHICH entries are in
		/// view; what belongs here is only the min and max of them.
		/// </remarks>
		public static BuildingCatalogMetricRangeState MetricBoundsOf(IEnumerable<BuildingCatalogEntry> entries)
		{
			if (entries is null)
			{
				throw new ArgumentNullException(nameof(entries));
			}

			BuildingCatalogEntry[] inScope = entries.ToArray();

			return new BuildingCatalogMetricRangeState(
				Min(inScope, entry => entry.ConstructionCost), Max(inScope, entry => entry.ConstructionCost),
				Min(inScope, entry => entry.Upkeep), Max(inScope, entry => entry.Upkeep),
				Min(inScope, entry => entry.Workers), Max(inScope, entry => entry.Workers),
				Min(inScope, entry => entry.Capacity), Max(inScope, entry => entry.Capacity),
				Min(inScope, entry => entry.LotWidth), Max(inScope, entry => entry.LotWidth),
				Min(inScope, entry => entry.LotDepth), Max(inScope, entry => entry.LotDepth));
		}

		/// <summary>
		/// The smallest value present, or null when no entry carries the metric.
		/// </summary>
		/// <remarks>
		/// Null rather than zero. Most assets carry no worker count, and a floor
		/// of 0 on a menu where nothing employs anyone would state a range that
		/// does not exist.
		/// </remarks>
		private static double? Min(
			IReadOnlyCollection<BuildingCatalogEntry> entries,
			Func<BuildingCatalogEntry, double?> metric)
		{
			double? lowest = null;

			foreach (BuildingCatalogEntry entry in entries)
			{
				double? value = metric(entry);
				if (value.HasValue && (!lowest.HasValue || value.Value < lowest.Value))
				{
					lowest = value;
				}
			}

			return lowest;
		}

		private static double? Max(
			IReadOnlyCollection<BuildingCatalogEntry> entries,
			Func<BuildingCatalogEntry, double?> metric)
		{
			double? highest = null;

			foreach (BuildingCatalogEntry entry in entries)
			{
				double? value = metric(entry);
				if (value.HasValue && (!highest.HasValue || value.Value > highest.Value))
				{
					highest = value;
				}
			}

			return highest;
		}

		public static BuildingCatalogFacetState BuildFacetState(
			IEnumerable<BuildingCatalogEntry> entries,
			BuildingCatalogQuery query)
		{
			if (entries is null)
			{
				throw new ArgumentNullException(nameof(entries));
			}

			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			BuildingCatalogEntry[] source = entries.ToArray();
			var groups = new List<BuildingCatalogFacetGroup>();

			AddValueGroup(groups, "buildingType", "Role", source.Select(entry => entry.BuildingType), query.BuildingTypes, FormatFacetWords);
			AddValueGroup(groups, "provenance", "Source", source.Select(entry => entry.Provenance), query.Provenance, FormatProvenanceLabel);
			// Progression, which the vanilla menu shows by greying an asset out
			// and the lens had no way to ask about at all.
			AddAvailabilityGroup(groups, source, query.Availability);
			AddValueGroup(groups, "dlc", "DLC", source.Select(entry => entry.DlcId), query.DlcIds, FormatDlcLabel);
			AddValueGroup(groups, "theme", "Theme", source.Select(entry => entry.Theme), query.Themes, FormatFacetWords);
			// Progression, as a FILTER rather than a row of tabs. It was a second
			// segment in the top bar, where it was disruptive on the menus with
			// many categories — Roads carried nineteen tabs and then four more —
			// and where it could only ever be single-select. Here it composes
			// with the rest of the rail and takes several tiers at once.
			//
			// AddValueGroup drops a dimension with one distinct value, so this
			// disappears by itself on the menus that sit in a single milestone
			// — which is most of them.
			AddValueGroup(
				groups,
				"milestone",
				"Progression",
				source.Select(BuildingCatalogQueryEngine.MilestoneNameOf),
				query.Milestones);
			AddArrayGroup(groups, "assetPack", "Asset packs", source.Select(entry => entry.AssetPacks), query.AssetPacks, FormatAssetPackLabel);
			AddArrayGroup(groups, "placement", "Placement", source.Select(entry => entry.PlacementFlags), query.PlacementFlags, FormatFlagLabel);
			AddArrayGroup(groups, "extension", "Extensions", source.Select(entry => entry.Extensions), query.Extensions, FormatFacetWords);
			// Density is what the vanilla Zones menu is organised around, so it
			// belongs beside the other dimensions rather than only in the sort.
			AddValueGroup(
				groups,
				"zone",
				"Density",
				source.Select(entry => entry.ZoneType == ZoneTypeFilter.Any ? null : entry.ZoneType.ToString()),
				query.ZoneTypes,
				FormatFacetWords);

			bool hasSelection = HasValues(query.Availability)
				|| HasValues(query.ZoneTypes)
				|| HasValues(query.BuildingTypes)
				|| HasValues(query.Provenance)
				|| HasValues(query.DlcIds)
				|| HasValues(query.Themes)
				|| HasValues(query.AssetPacks)
				|| HasValues(query.PlacementFlags)
				|| HasValues(query.Extensions);

			return new BuildingCatalogFacetState(groups.ToArray(), hasSelection);
		}

		public BuildingCatalogPage Query(BuildingCatalogQuery query)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			return BuildingCatalogQueryEngine.Query(GetIndexedBuildings(query.UiMenu).Select(Project), query);
		}

		public bool TryGet(int id, out BuildingCatalogEntry? entry)
		{
			entry = null;

			if (!FindItUtil.CategorizedPrefabs.TryGetValue(PrefabCategory.Any, out var allCategories)
				|| !allCategories.TryGetValue(PrefabSubCategory.Any, out var allPrefabs)
				|| !allPrefabs.TryGetValue(id, out var prefab)
				|| !IsBuilding(prefab))
			{
				return false;
			}

			entry = Project(prefab);
			return true;
		}

		/// <summary>
		/// What the lens catalogues.
		/// </summary>
		/// <remarks>
		/// Networks joined buildings here because the vanilla Roads menu is a
		/// grid of unlabelled icons, and the lens can name and group them. Net
		/// lanes are the sharpest case — that menu has no entry for them at all
		/// — though they are conditional on Extra Detailing Tools, so the case
		/// rests on the other eight subcategories rather than on lanes alone.
		/// The lens browses; placement still hands off to the native net tool,
		/// which owns elevation, snapping and parallel mode.
		///
		/// Trees, props and vehicles stay out of the UNSCOPED catalog — an "all
		/// buildings" view that includes 317 chairs and barrels is not a
		/// building list. But this is no longer the last word on membership: see
		/// GetIndexedBuildings, where a vanilla menu speaks for its own contents.
		/// </remarks>
		private static bool IsBuilding(PrefabIndex prefab)
		{
			return prefab.Category is PrefabCategory.Buildings
				or PrefabCategory.ServiceBuildings
				or PrefabCategory.Networks;
		}

		/// <summary>
		/// The candidate set, widened to whatever menu the player has open.
		/// </summary>
		/// <remarks>
		/// IsBuilding decides what belongs in an unscoped catalog. It is the
		/// wrong question once the player has opened a specific vanilla menu:
		/// there, the menu is the authority on its own contents, and our
		/// taxonomy has no standing to overrule it.
		///
		/// Landscaping is why. It holds 362 assets across 13 categories, of
		/// which IsBuilding admitted 20 — the bike paths, pathways and quays —
		/// and dropped 317 props and 25 vegetation. Twenty rows is worse than
		/// zero: an empty panel reads as "nothing here", while twenty reads as
		/// "here is the menu" and is wrong. Areas was the same failure at the
		/// other extreme, both of its members being area prefabs.
		///
		/// Scoping to a menu therefore admits that menu's members whatever they
		/// are, and unscoped views are untouched.
		/// </remarks>
		private static IEnumerable<PrefabIndex> GetIndexedBuildings(string? uiMenu = null)
		{
			if (!FindItUtil.IsReady
				|| !FindItUtil.CategorizedPrefabs.TryGetValue(PrefabCategory.Any, out var allCategories)
				|| !allCategories.TryGetValue(PrefabSubCategory.Any, out var allPrefabs))
			{
				return Array.Empty<PrefabIndex>();
			}

			string menu = uiMenu?.Trim() ?? string.Empty;
			var filters = FindItUtil.Filters.GetFilterList(includeSearch: false).ToArray();

			return allPrefabs
				// Sub-buildings are not list entries. Vanilla runs the same test
				// (FilterOutUpgrades, on ServiceUpgradeData) before drawing any
				// menu, because an upgrade is placed from its parent building's
				// row and has no standalone placement to offer. The menu audit
				// found six of them in our list that vanilla keeps out of its
				// grid: Maintenance Halls, Storage Warehouses, Warehouses and a
				// Hearse Garage.
				//
				// They stay INDEXED — the parent row still names them through
				// Extensions, search still finds them, and the facets still count
				// them. This is about what the list offers as a thing to place.
				.Where(prefab => !prefab.IsServiceUpgrade)
				// The game's own toolbar row: the EU/NA theme toggle, the asset
				// packs, and Vanilla/Mods. It filtered the vanilla grid and did
				// nothing to ours, which is the report in cm-2xvs.3 — the lens
				// replaced the menu and did not replace the filter above it.
				//
				// Transcribed rather than reimplemented, so a difference is a
				// bug rather than a design choice. Costs nothing when the
				// toolbar is untouched: IsVisible early-outs on an empty
				// selection, which is also what stops the lens opening blank.
				.Where(prefab => VanillaToolbarFilter.IsVisible(prefab.VanillaFacts, ToolbarSelection))
				// Phase 3: membership comes from the game's own tree.
				//
				// This used to read `IsBuilding(prefab) || prefab.UiMenuName ==
				// menu`, and UiMenuName is the asset's own UIObject.m_Group.m_Menu
				// — the tree read UPWARD. That view can only describe assets some
				// processor already indexed, so a menu looks complete while being
				// short. It is the shape behind every membership bug this project
				// has had: the terrain brushes, the seaway tools, the Zones
				// "Extractors" tab, and four unbuildable Area Hubs.
				//
				// Walking down from UIAssetMenuData is what ToolbarUISystem does,
				// so scoped to a menu we now show that menu's members and nothing
				// else, by construction rather than by agreement.
				//
				// Unscoped is still IsBuilding's question to answer: with no menu
				// open there is no tree to read, and "everything the game places
				// anywhere" would put 317 props and 25 vegetation in a building
				// list.
				.Where(prefab => string.IsNullOrEmpty(menu)
					? IsBuilding(prefab)
					: PrefabIndexingSystem.IsPlacedInMenu(prefab.Id, menu)
						|| IsGatheredNetwork(prefab, menu))
				.Where(prefab => filters.All(filter => filter(prefab)));
		}

		/// <summary>
		/// Whether the Roads menu adopts this network from another menu.
		/// </summary>
		/// <remarks>
		/// The membership half of NetworkMenuExtension, which the phase 3 switch
		/// to IsPlacedInMenu silently turned off: the tabs for the adopted
		/// groups kept being drawn while no asset could reach them, so Roads
		/// showed ten tabs that counted 0 and answered a click with "No
		/// buildings in this category".
		///
		/// Trams, pedestrian paths, bike trails, seaways, rail, power lines and
		/// pipes are all NETWORKS, and a player drawing one is doing the same
		/// job whichever service owns it. Vanilla scatters them across the
		/// service menus; gathering them where the roads are is the extension.
		///
		/// Guarded on IsPlacedInAnyMenu so this admits what vanilla places
		/// somewhere, not every network prefab in the index. Nothing is taken
		/// OUT of the menus that already hold them — Transportation keeps its
		/// tram tracks — so this only ever adds a second way to reach one.
		/// </remarks>
		private static bool IsGatheredNetwork(PrefabIndex prefab, string menu) =>
			NetworkMenuExtension.IsExtraNetwork(
				prefab.Category.ToString(),
				prefab.UiMenuName,
				menu)
			&& PrefabIndexingSystem.IsPlacedInAnyMenu(prefab.Id);

		/// <summary>The milestone's word, or the ungated bucket's.</summary>
		private static string MilestoneNameFor(int milestone)
		{
			if (milestone <= 0)
			{
				return BuildingCatalogQueryEngine.UngatedMilestone;
			}

			var names = PrefabIndexingSystem.GetMilestoneNames();

			return milestone < names.Length && !string.IsNullOrEmpty(names[milestone])
				? names[milestone]
				: $"Milestone {milestone}";
		}

		private static BuildingCatalogEntry Project(PrefabIndex prefab)
		{
			VanillaBuildMenuTag? vanillaTag = VanillaBuildMenuTaxonomy.Resolve(prefab.Category, prefab.SubCategory, prefab.ZoneType);

			return new BuildingCatalogEntry(
				Id: prefab.Id,
				PrefabName: prefab.PrefabName ?? string.Empty,
				Name: prefab.Name ?? prefab.PrefabName ?? string.Empty,
				Category: prefab.Category.ToString(),
				SubCategory: prefab.SubCategory.ToString(),
				CategoryLabel: BuildingCatalogLabels.ForCategory(prefab.Category, prefab.Category.ToString()),
				SubCategoryLabel: BuildingCatalogLabels.ForSubCategory(prefab.SubCategory, prefab.SubCategory.ToString()),
				VanillaSection: vanillaTag?.Section,
				VanillaSubCategory: vanillaTag?.SubCategory,
				// Both, not one coalesced into the other: the thumbnail camera
				// returns a URL for every prefab but only renders the ones
				// vanilla shows in a menu, so a spawnable zone building has a
				// non-null Thumbnail that draws nothing. A ?? here cannot see
				// that; the renderer can, and falls back on the image error.
				Thumbnail: IconPath.Normalize(prefab.Thumbnail ?? prefab.FallbackThumbnail ?? string.Empty),
				FallbackThumbnail: IconPath.Normalize(
					prefab.FallbackThumbnail ?? prefab.CategoryThumbnail ?? string.Empty),
				UiMenu: prefab.UiMenuName,
				UiCategory: prefab.UiCategoryName,
				UiCategoryPriority: prefab.UiCategoryPriority,
				LotWidth: prefab.LotSize.x,
				LotDepth: prefab.LotSize.y,
				BuildingLevel: prefab.BuildingLevel,
				BuildingType: prefab.BuildingTypeName,
				EducationLevel: prefab.EducationLevel,
				Provenance: prefab.IsVanilla ? "Vanilla" : "Custom",
				ZoneType: prefab.ZoneType,
				HasParking: prefab.HasParking,
				IsUniqueMesh: prefab.IsUniqueMesh,
				IsVanilla: prefab.IsVanilla,
				IsLocked: prefab.IsLocked,
				UnlockMilestone: prefab.UnlockMilestone,
				MilestoneName: MilestoneNameFor(prefab.UnlockMilestone),
				DevTreeBranch: prefab.DevTreeBranch,
				DevTreeBranchIcon: prefab.DevTreeBranchIcon,
				DevTreeBranchDepth: prefab.DevTreeBranchDepth,
				UnlockRequirements: prefab.UnlockRequirements,
				Bonuses: prefab.Bonuses,
				CostIsPerDistance: prefab.CostIsPerDistance,
				ParkingSlots: prefab.ParkingSlots,
				IsFavorited: prefab.IsFavorited,
				PdxModsId: prefab.PdxModsId ?? string.Empty,
				DlcId: prefab.DlcId == DlcId.Invalid ? null : prefab.DlcId.id.ToString(),
				Theme: prefab.Theme?.name,
				AssetPacks: prefab.AssetPacks?.Where(pack => pack is not null).Select(pack => pack.name).Where(name => !string.IsNullOrWhiteSpace(name)).ToArray() ?? Array.Empty<string>(),
				PlacementFlags: GetPlacementFlagNames(prefab.BuildingFlagsValue),
				Extensions: prefab.ExtensionIds ?? Array.Empty<string>(),
				ConstructionCost: prefab.ConstructionCost,
				Upkeep: prefab.Upkeep,
				Workers: prefab.Workers,
				Capacity: prefab.Capacity,
				ElectricityConsumption: prefab.ElectricityConsumption,
				WaterConsumption: prefab.WaterConsumption,
				GarbageAccumulation: prefab.GarbageAccumulation,
				WaterCapacity: prefab.WaterCapacity,
				SewageCapacity: prefab.SewageCapacity,
				GroundPollution: prefab.GroundPollution,
				AirPollution: prefab.AirPollution,
				NoisePollution: prefab.NoisePollution);
		}

		/// <summary>
		/// Locked and Unlocked, always both, and both ticked when nothing is
		/// stored.
		/// </summary>
		/// <remarks>
		/// Two departures from AddValueGroup, and the same reason underneath: this
		/// dimension is exhaustive, so its resting state is a fact about the view
		/// rather than an absence of input.
		///
		/// It is offered even when only one value is present. IsWorthOffering
		/// drops a single-valued dimension as a no-op, which is right for Role or
		/// Source — but in a founding city every asset in a menu is locked, and
		/// that is exactly when a player wants to see the filter saying so. A
		/// dimension that disappears when the answer is interesting is worse than
		/// one that costs a slot.
		///
		/// Both options read as selected when the stored selection is empty,
		/// because empty MEANS both here. Drawn as two unticked boxes it read as
		/// "no filter applied", which is a different claim from "showing locked
		/// and unlocked". ToggleExhaustive makes the arithmetic agree.
		/// </remarks>
		private static void AddAvailabilityGroup(
			ICollection<BuildingCatalogFacetGroup> groups,
			IReadOnlyCollection<BuildingCatalogEntry> source,
			IReadOnlyList<string>? selected)
		{
			bool restingState = selected is null || selected.Count == 0;

			BuildingCatalogFacetOption[] options = BuildingCatalogFacetSelection.Availability.All
				.Select(value => new BuildingCatalogFacetOption(
					value,
					FormatFacetWords(value),
					restingState || selected!.Any(option => string.Equals(option, value, StringComparison.OrdinalIgnoreCase))))
				.ToArray();

			groups.Add(new BuildingCatalogFacetGroup(
				"availability",
				"Availability",
				options,
				// Exhaustive, so "both" admits everything however it was reached
				// — whether nothing is stored or the player selected both back.
				Narrowing: options.Any(option => !option.Selected)));
		}

		private static void AddValueGroup(
			ICollection<BuildingCatalogFacetGroup> groups,
			string id,
			string label,
			IEnumerable<string?> values,
			IReadOnlyList<string>? selected,
			Func<string, string>? formatLabel = null)
		{
			string[] distinctValues = WithSelected(DistinctValues(values), selected);
			if (!IsWorthOffering(distinctValues, selected))
			{
				return;
			}

			BuildingCatalogFacetOption[] options = CreateOptions(distinctValues, selected, formatLabel);

			groups.Add(new BuildingCatalogFacetGroup(
				id,
				label,
				options,
				// Excludes something iff at least one option is selected and at
				// least one is not. All-selected and none-selected both admit
				// everything; only a partial selection narrows.
				Narrowing: options.Any(option => option.Selected) && options.Any(option => !option.Selected)));
		}

		/// <summary>
		/// Whether a dimension can actually narrow anything in the current view.
		/// </summary>
		/// <remarks>
		/// One distinct value is not a filter. Every entry in view already has
		/// it, so selecting it changes nothing and the control is a no-op that
		/// still costs a slot in the rail and a decision from the reader.
		/// Measured inside Roads and Networks: Source offered "Base game" and
		/// DLC offered "No DLC required", each the only value present.
		///
		/// A selection keeps the group alive whatever its size. Dropping a
		/// dimension the player has already filtered on would strand that
		/// filter — applied, shrinking the results, and with nothing on screen
		/// to say so or undo it.
		/// </remarks>
		private static bool IsWorthOffering(string[] distinctValues, IReadOnlyList<string>? selected)
		{
			return distinctValues.Length > 1 || (selected is not null && selected.Count > 0);
		}

		private static void AddArrayGroup(
			ICollection<BuildingCatalogFacetGroup> groups,
			string id,
			string label,
			IEnumerable<string[]?> values,
			IReadOnlyList<string>? selected,
			Func<string, string>? formatLabel = null)
		{
			AddValueGroup(groups, id, label, values.SelectMany(value => value ?? Array.Empty<string>()), selected, formatLabel);
		}

		private static BuildingCatalogFacetOption[] CreateOptions(
			IEnumerable<string> values,
			IReadOnlyList<string>? selected,
			Func<string, string>? formatLabel)
		{
			return values
				.Select(value => new BuildingCatalogFacetOption(
					value,
					formatLabel?.Invoke(value) ?? value,
					selected is not null && selected.Any(option => string.Equals(option, value, StringComparison.OrdinalIgnoreCase))))
				.ToArray();
		}

		/// <summary>
		/// The values present, plus any the player has already chosen.
		/// </summary>
		/// <remarks>
		/// A selection has to stay visible even when nothing in view carries it,
		/// or it becomes a filter with no control attached.
		///
		/// That is not hypothetical. Choose "Require road" in Electricity and
		/// switch to Landscaping: nothing there has BuildingFlags, so the
		/// dimension had no values, the group was published with ZERO options,
		/// and both the rail (which drops empty groups) and the chip row (which
		/// iterates options) showed nothing — while the query still filtered on
		/// it. The menu read "No buildings match" with no filter on screen and no
		/// way to clear it.
		///
		/// Keeping the selected value as an option makes it chippable and
		/// removable, which is better than dropping the selection silently: the
		/// player's choice survives, and it survives VISIBLY.
		///
		/// Reachable only since the rail started delivering clicks at all — see
		/// FilterRail's onChange. Before that no facet could be set, so nothing
		/// could be carried anywhere.
		/// </remarks>
		private static string[] WithSelected(string[] present, IReadOnlyList<string>? selected)
		{
			if (selected is null || selected.Count == 0)
			{
				return present;
			}

			var missing = selected
				.Where(value => !string.IsNullOrWhiteSpace(value))
				.Where(value => !present.Any(candidate => string.Equals(candidate, value, StringComparison.OrdinalIgnoreCase)))
				.ToArray();

			if (missing.Length == 0)
			{
				return present;
			}

			return present
				.Concat(missing)
				.OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
				.ToArray();
		}

		private static string[] DistinctValues(IEnumerable<string?> values)
		{
			return values
				.Where(value => !string.IsNullOrWhiteSpace(value))
				.Select(value => value!.Trim())
				.GroupBy(value => value, StringComparer.OrdinalIgnoreCase)
				.Select(group => group.First())
				.OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
				.ToArray();
		}

		private static bool HasValues(IReadOnlyList<string>? values)
		{
			return values is not null && values.Count > 0;
		}

		private static string FormatDlcLabel(string id)
		{
			if (!int.TryParse(id, out int numericId))
			{
				return id;
			}

			if (numericId == DlcId.BaseGame.id)
			{
				// Deliberately not "Base game": the Source facet already uses
				// that label for content shipped by the studio rather than by a
				// mod. Two identically-named options in adjacent facet groups
				// read as a duplicate rather than as two different questions.
				// This one answers "which DLC does this need?" — the answer
				// being none.
				return "No DLC required";
			}

			// DlcId is persisted as a stable numeric value in the catalog query,
			// but the toolbar's existing DLC option already knows how to resolve
			// that value to the game's internal name and localized title. Reuse
			// that metadata when it is available; the explicit ID fallback makes
			// unavailable metadata understandable instead of exposing a bare
			// numeric token such as "DLC 123".
			try
			{
				string internalName = PlatformManager.instance.GetDlcName(new DlcId(numericId));
				if (!string.IsNullOrWhiteSpace(internalName))
				{
					return LocaleHelper.Translate(
						$"Common.DLC_TITLE[{internalName}]",
						LocaleHelper.Translate($"Assets.NAME[{internalName}]", FormatFacetWords(internalName)));
				}
			}
			catch
			{
				// The pure catalog/test host has no initialized platform or
				// localization service. Keep the deterministic fallback below.
			}

			return $"Unresolved DLC content (ID {numericId})";
		}

		private static string FormatProvenanceLabel(string value)
		{
			if (string.Equals(value, "Vanilla", StringComparison.OrdinalIgnoreCase))
			{
				return "Base game";
			}

			if (string.Equals(value, "Custom", StringComparison.OrdinalIgnoreCase))
			{
				return "Custom content";
			}

			return FormatFacetWords(value);
		}

		private static string FormatAssetPackLabel(string value)
		{
			if (string.Equals(value, "FindIt_NoPack", StringComparison.OrdinalIgnoreCase))
			{
				return "No asset pack";
			}

			return FormatFacetWords(value);
		}

		private static string FormatFacetWords(string value)
		{
			if (string.IsNullOrWhiteSpace(value))
			{
				return value;
			}

			var label = new StringBuilder(value.Length + 8);
			for (int index = 0; index < value.Length; index++)
			{
				char current = value[index];
				if (current == '_' || current == '-')
				{
					if (label.Length > 0 && label[label.Length - 1] != ' ')
					{
						label.Append(' ');
					}

					continue;
				}

				char previous = index > 0 ? value[index - 1] : '\0';
				bool startsNewWord = index > 0
					&& ((char.IsUpper(current)
						&& (char.IsLower(previous)
							|| char.IsDigit(previous)
							|| (index + 1 < value.Length && char.IsUpper(previous) && char.IsLower(value[index + 1]))))
						|| (char.IsDigit(current) && !char.IsDigit(previous))
						|| (char.IsLetter(current) && char.IsDigit(previous)));
				if (startsNewWord && label.Length > 0 && label[label.Length - 1] != ' ')
				{
					label.Append(' ');
				}

				label.Append(current);
			}

			return label.ToString().Trim();
		}

		private static string FormatFlagLabel(string value)
		{
			if (string.IsNullOrEmpty(value))
			{
				return value;
			}

			var label = new System.Text.StringBuilder(value.Length + 8);
			for (var index = 0; index < value.Length; index++)
			{
				if (index > 0 && char.IsUpper(value[index]))
				{
					label.Append(' ');
				}

				label.Append(index == 0 ? value[index] : char.ToLowerInvariant(value[index]));
			}

			return label.ToString();
		}
	}
}
