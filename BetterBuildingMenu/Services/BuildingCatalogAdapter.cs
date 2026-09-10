using Colossal.PSI.Common;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Systems;
using BetterBuildingMenu.Utilities;

using Game.Prefabs;

using Game.SceneFlow;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace BetterBuildingMenu.Services
{
	/// <summary>
	/// Projects the indexed prefab records into the building lens. This is deliberately not an ECS query: PrefabIndexingSystem remains
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
		/// exactly one toolbar. Written by BuildingMenuUISystem when the UI reports a
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

		/// <summary>
		/// Whether the Content facet would show this asset.
		/// </summary>
		/// <remarks>
		/// Content is one axis over three pieces of state, so its options have
		/// to combine the way one axis does — as OR. Two of them live in the
		/// game's toolbar selection, which ORs them itself; the third is our
		/// DlcIds, which is applied HERE rather than in the query engine so it
		/// unions with the other two instead of intersecting them.
		///
		/// That was a real defect before the merge, not a risk introduced by it:
		/// packs filtered upstream and DLC filtered in the engine, so ticking
		/// Bridges &amp; Ports in one group and San Francisco in the other left
		/// nothing at all — an asset cannot be both.
		/// </remarks>
		private static bool ContentVisible(
			PrefabIndex prefab,
			VanillaToolbarSelection selection,
			IReadOnlyList<string>? dlcIds)
		{
			// Themes are a DIFFERENT facet and must narrow on their own terms,
			// so they are split out and ANDed before anything else. Bundling
			// them in was the bug: VanillaToolbarSelection.IsEmpty counts themes
			// too, a city always has one selected, so "the toolbar has no
			// selection" was never true and the DLC half was permanently ORed
			// against a filter that passed nearly everything. Measured as
			// dlcIds=[1] toolbarEmpty=False with the result unchanged.
			if (!VanillaToolbarFilter.IsVisible(prefab.VanillaFacts, ThemesOnly(selection)))
			{
				return false;
			}

			var content = ContentOnly(selection);
			bool packsChosen = !content.IsEmpty;
			bool dlcChosen = dlcIds is { Count: > 0 };

			if (!packsChosen && !dlcChosen)
			{
				return true;
			}

			bool matchesDlc = dlcChosen
				&& prefab.DlcId != DlcId.Invalid
				&& dlcIds!.Any(id => string.Equals(
					id,
					prefab.DlcId.id.ToString(CultureInfo.InvariantCulture),
					StringComparison.Ordinal));

			if (!dlcChosen)
			{
				return VanillaToolbarFilter.IsVisible(prefab.VanillaFacts, content);
			}

			// Content is ONE axis, so its options combine as OR. Two of them
			// live in the game's selection, which ORs them itself; the third is
			// ours, and it joins them here rather than intersecting downstream.
			return packsChosen
				? VanillaToolbarFilter.IsVisible(prefab.VanillaFacts, content) || matchesDlc
				: matchesDlc;
		}

		/// <summary>Just the theme arm, which narrows on its own.</summary>
		private static VanillaToolbarSelection ThemesOnly(VanillaToolbarSelection selection) =>
			new(selection.SelectedThemes, null, false, false);

		/// <summary>Just the arms the Content facet speaks for.</summary>
		private static VanillaToolbarSelection ContentOnly(VanillaToolbarSelection selection) =>
			new(null, selection.SelectedPacks, selection.VanillaSelected, selection.ModsSelected);

		/// <summary>The same toolbar selection with its packs dropped.</summary>
		private static VanillaToolbarSelection WithoutPacks(VanillaToolbarSelection selection) =>
			new(selection.SelectedThemes, null, selection.VanillaSelected, selection.ModsSelected);

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
		public IReadOnlyList<MenuCategoryCount> GetMenuCategoryCounts(BuildingCatalogQuery query) => Build(query).MenuCategoryCounts;

		/// <summary>
		/// Every category whose density tiers should be drawn in its place.
		/// </summary>
		/// <remarks>
		/// Static and over entries, like BuildFacetState, so the rule can be
		/// tested without standing up an adapter.
		///
		/// The condition is the school levels': sub-tabs stand in for a category
		/// only when they PARTITION it, so a category with fewer than two tiers
		/// is left alone. That is what keeps Industrial — one untiered zone —
		/// and the extractor areas as plain tabs, with no separate suppression
		/// rule needed anywhere.
		///
		/// Untiered entries inside a tiered category would have nowhere to go,
		/// so a category holding any is not expanded either: a tab row that
		/// silently hides part of its own category is worse than no tabs.
		/// </remarks>
		public static IReadOnlyList<MenuCategoryTabs> BuildDensityTabs(
			IEnumerable<BuildingCatalogEntry> entries,
			string uiMenu)
		{
			return (entries ?? Array.Empty<BuildingCatalogEntry>())
				.GroupBy(entry => NetworkMenuExtension.EffectiveCategory(entry, uiMenu) ?? string.Empty)
				.Where(category => category.Key.Length > 0
					&& category.All(entry => entry.ZoneType != ZoneTypeFilter.Any)
					&& category.Select(entry => entry.ZoneType).Distinct().Count() > 1)
				.OrderBy(category => category.Key, StringComparer.Ordinal)
				.Select(category => new MenuCategoryTabs(
					category.Key,
					category
						.GroupBy(entry => entry.ZoneType)
						.OrderBy(tier => Array.IndexOf(BuildingCatalogGrouping.DensityOrder, tier.Key))
						.Select(tier => new MenuBranchCount(
							StripAxes.DensityTab.Format(
								category.Key,
								BuildingCatalogLabels.DensityTier(tier.Key)),
							tier.Count(),
							// Vanilla's own zoning icon for this family AND tier —
							// the same mark the zoning map paints. Falls back to
							// the category's icon in the strip when the game ships
							// none, which is truthful where a derived-but-missing
							// path would be a silent hole.
							ZoneDensityIcons.For(category.Key, tier.Key),
							BuildingCatalogLabels.DensityTier(tier.Key)))
						.ToArray()))
				.ToArray();
		}

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
		public string GetStripAxis(BuildingCatalogQuery query) => Build(query).StripAxis;

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
		internal const string SchoolTierIcon = "Media/Game/Icons/Education.svg";

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
		/// <param name="allowCategoryGlyph">
		/// False when the caller has already seen this tab's glyph on a sibling.
		/// The category glyph belongs to the CATEGORY, so every tab that shares
		/// one draws the same picture — four identical Healthcare marks across
		/// Healthcare's strip, reported from play. Turning it off here drops the
		/// tab to the representative asset below, which at least differs per
		/// tab. Only the caller can tell: whether a glyph repeats is a fact
		/// about the row, not about one group.
		/// </param>
		internal static string TabIcon(IEnumerable<BuildingCatalogEntry> group, bool authored, bool allowCategoryGlyph = true)
		{
			var entries = group.ToArray();

			if (authored)
			{
				// The branch's authored icon — unless the indexer filled it with
				// the asset's own render because the tree node had none. That is
				// a photograph in a row of glyphs (cm-2xvs.17, measured live:
				// ParkingHall02's branch icon WAS its thumbnail), so it is
				// treated as no icon and the glyph fallback below decides.
				var icon = entries
					.Select(entry => entry.DevTreeBranchIcon)
					.FirstOrDefault(value => !string.IsNullOrEmpty(value) && !IsPhotograph(value!));

				if (!string.IsNullOrEmpty(icon))
				{
					return icon!;
				}
			}

			var ordered = entries
				.OrderBy(entry => entry.UiCategoryPriority)
				.ThenBy(entry => entry.Name, StringComparer.Ordinal)
				.ToArray();

			// An authored row is a row of flat glyphs. A branch the game gave no
			// icon used to fall to the representative asset's THUMBNAIL — a
			// photographic building render beside the glyphs, read as a broken
			// icon (cm-2xvs.17: Roads' two single-asset parking categories). The
			// category glyph the fallback thumbnail carries belongs in that row;
			// the photograph does not.
			//
			// Conditional since cm-0g1m. The glyph is the CATEGORY's, so tabs
			// that share a category all draw one picture — Healthcare's strip
			// rendered Healthcare.svg four times, a row that cannot be read.
			// CatalogView.Disambiguate calls back with allowCategoryGlyph false
			// for exactly the tabs whose glyph repeats, which drops those to the
			// photograph below. Tidy loses to legible where the two conflict.
			if (authored && allowCategoryGlyph)
			{
				var glyph = ordered
					.Select(entry => entry.FallbackThumbnail)
					.FirstOrDefault(value => !string.IsNullOrEmpty(value));

				if (!string.IsNullOrEmpty(glyph))
				{
					return glyph!;
				}
			}

			return ordered
				.Select(entry => !string.IsNullOrEmpty(entry.Thumbnail) ? entry.Thumbnail : entry.FallbackThumbnail)
				.FirstOrDefault(value => !string.IsNullOrEmpty(value)) ?? string.Empty;
		}

		/// <summary>A rendered asset picture, as opposed to an authored glyph.</summary>
		internal static bool IsPhotograph(string icon) =>
			icon.StartsWith("thumbnail://", StringComparison.OrdinalIgnoreCase);

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

		/// <param name="packScope">
		/// The entries the PACK group is counted over, when that differs from
		/// the rest. Defaults to <paramref name="entries"/>; the adapter passes
		/// a pack-unfiltered set so the group can offer a pack other than the
		/// one already chosen. See GetIndexedBuildings(ignorePackSelection).
		/// </param>
		public static BuildingCatalogFacetState BuildFacetState(
			IEnumerable<BuildingCatalogEntry> entries,
			BuildingCatalogQuery query,
			IEnumerable<BuildingCatalogEntry>? packScope = null)
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
			// Where it came from, next to who made it. It replaces the DLC group
			// that used to sit here and the Asset packs group that sat lower —
			// one axis, one place. See AddContentGroup.
			AddContentGroup(groups, packScope is null ? source : packScope.ToArray(), query);
			AddValueGroup(groups, "theme", "Theme", source.Select(entry => entry.Theme), query.Themes, FormatFacetWords);
			// Neither unlock modality is a filter here, and both used to be.
			//
			// Development was the top bar's own axis offered a second time, on the
			// principle that anything the strip narrows by should be reachable from
			// the rail. In the game that read as duplication rather than reach: on
			// Roads it drew a 23-item dropdown of Small Roads, Medium Roads,
			// Highways, Intersections — the strip's own tabs, restated, in the menu
			// where the strip is already the primary navigation. It also collided
			// with Role, which is a different question in the same words: under
			// Healthcare both offered "Hospital", one meaning what the building IS
			// and the other which node UNLOCKED it.
			//
			// Progression asked a question players do not ask. "Show me only Grand
			// Village buildings" is not a build-menu action; "can I build this now"
			// is, and Availability above already answers it. It also vanished on
			// most menus, since AddValueGroup drops a single-valued dimension.
			//
			// Both rendered as an ICONLESS chip in the same slot, so which
			// dimension a blank chip meant changed per menu — Development on
			// Healthcare, Progression on Signature Buildings, and both at once on
			// Roads, side by side and indistinguishable.
			//
			// Development stays reachable as a Group by dimension, and so does
			// Progression; grouping is where "when does this unlock" belongs,
			// because it orders the set instead of hiding most of it.
			AddArrayGroup(groups, "placement", "Placement", source.Select(entry => entry.PlacementFlags), query.PlacementFlags, FormatFlagLabel);
			AddArrayGroup(groups, "extension", "Extensions", source.Select(entry => entry.Extensions), query.Extensions, FormatFacetWords);
			// Density is NOT a facet, for the reason Development and Progression
			// are not: it is the strip's own axis offered a second time. Since
			// cm-2xvs.16 every type+density tier IS a category with its own tab
			// and icon in the top bar — Residential Low, Row, Medium, Mixed, Low
			// Rent, High, and low/high for Commercial and Office — so the rail
			// was drawing a six-option dropdown of exactly the tabs sitting above
			// it. Measured live in the Zones menu: "High, Low, Low Rent, Medium,
			// Mixed, Row", the same six.
			//
			// Density stays reachable as a Group by dimension and as a sort,
			// which is where an axis belongs once the strip navigates it: both
			// order the set instead of hiding most of it.
			//
			// It only ever appeared in zoning menus anyway. Everything else is
			// ZoneTypeFilter.Any, which maps to null, and signatures are all
			// Signature — one value, which AddValueGroup drops.

			bool hasSelection = HasValues(query.Availability)
				|| HasValues(query.BuildingTypes)
				|| HasValues(query.Provenance)
				|| HasValues(query.DlcIds)
				|| HasValues(query.Themes)
				|| HasValues(query.PlacementFlags)
				|| HasValues(query.Extensions);

			return new BuildingCatalogFacetState(groups.ToArray(), hasSelection);
		}

		/// <summary>One page of the catalog for this query.</summary>
		public BuildingCatalogPage Query(BuildingCatalogQuery query) => Build(query).Page;

		/// <summary>One view per refresh: every per-query answer above comes from it.</summary>
		/// <remarks>
		/// The public methods stayed as one-line delegations so their callers and
		/// tests read unchanged; BuildingMenuUISystem calls this once and reads the
		/// view's properties, which is where the fifteen passes went.
		/// </remarks>
		public CatalogView Build(BuildingCatalogQuery query, Func<CatalogView, string>? groupByResolver = null)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			var snapshot = ProjectForMenu(query.UiMenu, query.DlcIds);

			// Packs alone are counted before the pack filter runs, because that
			// filter is upstream of InScope and InScope cannot undo it. Only a
			// second snapshot when a pack IS selected.
			return new CatalogView(
				snapshot,
				query,
				ToolbarSelection.SelectedPacks.Count > 0
					? () => ProjectForMenu(query.UiMenu, query.DlcIds, ignorePacks: true)
					: null,
				groupByResolver,
				PrefabIndexingSystem.GetMilestoneNames(),
				VanillaMenus.IsEducation(query.UiMenu));
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
		/// This is no longer the last word on membership at EITHER scope. A
		/// vanilla menu speaks for its own contents when one is open, and the
		/// union of every menu speaks for the unscoped view — see
		/// BelongsInCatalog. What survives here is the floor: an asset our
		/// taxonomy calls a building stays in the catalogue even if vanilla
		/// places it in no menu at all.
		/// </remarks>
		private static bool IsBuilding(PrefabIndex prefab)
		{
			return prefab.Category is PrefabCategory.Buildings
				or PrefabCategory.ServiceBuildings
				or PrefabCategory.Networks;
		}

		/// <summary>Whether an asset belongs in the catalogue at this scope.</summary>
		/// <remarks>
		/// Split out from GetIndexedBuildings so the one rule that MUST hold
		/// between the two scopes can be asserted without a live index: removing
		/// the menu scope has to widen the result, never narrow it. That failed
		/// for a year because the two arms asked different questions — the
		/// scoped arm read the game's menu tree, the unscoped arm read our own
		/// taxonomy — and nothing compared them.
		///
		/// The parameters are booleans rather than a PrefabIndex because both
		/// placement lookups need the live index, and the invariant does not:
		/// it is a statement about how the four facts combine.
		///
		/// Callers must pass placedInThisMenu and gatheredNetwork as false when
		/// unscoped; both are meaningless without a menu, and the invariant
		/// test relies on placedInAnyMenu being the only placement fact that
		/// survives into the unscoped arm.
		///
		/// There is deliberately no arm for our OWN generated props. The
		/// inherited quantity and vehicle generators emitted 314 prefabs with
		/// UIObject.m_Group = null, so vanilla placed them in no menu and they
		/// were not buildings — they failed both arms at both scopes, and
		/// stayed out. That is the decision (cm-wdap, user, 2026-08-27), not an
		/// oversight: they are FindIt's, which answers "where is any asset",
		/// and the lens answers "what should I build here, and what does it
		/// cost me". The generators and their marker component are gone now, so
		/// nothing reaches this arm to begin with; re-adding either would
		/// reverse the decision, and would admit the group-less population
		/// cm-2xvs.13 warns about.
		/// </remarks>
		public static bool BelongsInCatalog(
			bool menuScoped,
			bool isBuilding,
			bool placedInThisMenu,
			bool placedInAnyMenu,
			bool gatheredNetwork) =>
			menuScoped
				? placedInThisMenu || gatheredNetwork
				: isBuilding || placedInAnyMenu;

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
		/// <param name="ignorePackSelection">
		/// Applies the toolbar's themes and Vanilla/Mods toggles but NOT its
		/// packs. Only the pack facet wants this, and it wants it for the same
		/// reason InScope drops a facet's own selection before counting it: a
		/// dimension computed from the set it has already narrowed can only ever
		/// offer what is still showing. Measured — pick Bridges &amp; Ports and
		/// the pack list collapsed to Bridges &amp; Ports, so the rail could
		/// clear a pack but never switch to another one.
		/// </param>
		private static IEnumerable<PrefabIndex> GetIndexedBuildings(
			string? uiMenu = null,
			bool ignorePackSelection = false,
			IReadOnlyList<string>? unionDlcIds = null)
		{
			if (!BuildingMenuUtil.IsReady
				|| !BuildingMenuUtil.CategorizedPrefabs.TryGetValue(PrefabCategory.Any, out var allCategories)
				|| !allCategories.TryGetValue(PrefabSubCategory.Any, out var allPrefabs))
			{
				return Array.Empty<PrefabIndex>();
			}

			string menu = uiMenu?.Trim() ?? string.Empty;
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
				.Where(prefab => ContentVisible(
					prefab,
					ignorePackSelection ? WithoutPacks(ToolbarSelection) : ToolbarSelection,
					unionDlcIds))
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
				// Unscoped reads the SAME tree, unioned over every menu. It used
				// to ask IsBuilding instead, on the theory that with no menu
				// open there is no tree to read — but IsPlacedInAnyMenu is
				// exactly that tree, and it already guards the Roads gathering
				// two methods down.
				//
				// The asymmetry cost half the catalogue. Measured with 105 asset
				// packs loaded: Landscaping scoped showed 514 and Roads 403,
				// while clearing the scope showed 715 — fewer than those two
				// menus together, because unscoped dropped every prop, surface
				// and plant the menus themselves carry. Clearing a scope has to
				// widen the view.
				//
				// The old worry — "317 props in a building list" — was written
				// when unscoped WAS the default view. It is now reached by
				// removing a scope chip, and the result is drawn under category
				// headings, so props arrive under Props rather than mixed into
				// the buildings.
				//
				// IsBuilding stays in the union rather than being replaced by
				// it: dropping it could only ever REMOVE something already
				// showing, and this change is meant to be monotone.
				.Where(prefab => BelongsInCatalog(
					menuScoped: !string.IsNullOrEmpty(menu),
					isBuilding: IsBuilding(prefab),
					placedInThisMenu: !string.IsNullOrEmpty(menu)
						&& PrefabIndexingSystem.IsPlacedInMenu(prefab.Id, menu),
					placedInAnyMenu: PrefabIndexingSystem.IsPlacedInAnyMenu(prefab.Id),
					gatheredNetwork: !string.IsNullOrEmpty(menu) && IsGatheredNetwork(prefab, menu)));
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
		/// <remarks>
		/// IsExtended is asked HERE, before the call, and that is the whole point
		/// of the shape. IsExtraNetwork checks it too — but C# evaluates
		/// arguments first, so `prefab.Category.ToString()` ran for every one of
		/// ~24,700 indexed prefabs on EVERY menu-scoped projection, when only the
		/// Roads menu can ever answer true. An enum ToString is reflection-backed
		/// on this framework.
		///
		/// Measured: a warm projection of Landscaping went 25.1ms to 10.5ms and
		/// Transportation 21.3ms to 11.4ms. It does NOT touch the ~190ms a menu's
		/// FIRST projection costs — see cm-2xvs.25, that one is still open.
		/// </remarks>
		private static bool IsGatheredNetwork(PrefabIndex prefab, string menu) =>
			NetworkMenuExtension.IsExtended(menu)
			&& NetworkMenuExtension.IsExtraNetwork(
				prefab.Category.ToString(),
				prefab.UiMenuName,
				menu,
				prefab.SubCategory.ToString())
			&& PrefabIndexingSystem.IsPlacedInAnyMenu(prefab.Id);

		/// <summary>The projections this adapter reuses across refreshes.</summary>
		/// <remarks>
		/// One refresh asks the same projection question several times over, and
		/// each pass used to scan the whole index — ~24,900 prefabs with 105 asset
		/// packs installed — and rebuild an entry for every survivor, so opening a
		/// menu cost the same whether it held 110 assets or 514.
		///
		/// Snapshots are keyed by scope and kept until PrefabIndexingSystem's
		/// IndexGeneration changes, so they DO survive from one refresh to the
		/// next; see SnapshotCache.
		/// </remarks>
		private readonly SnapshotCache _snapshots = new();

		/// <summary>How long the last <see cref="ProjectForMenu"/> took, and whether it was served from cache.</summary>
		/// <remarks>Read by BuildingMenuUISystem for the [LENS-REFRESH] breakdown. Reset by <see cref="BeginRefresh"/>.</remarks>
		public int LastProjectionMs { get; private set; }
		public bool LastProjectionWasHit { get; private set; } = true;

		/// <summary>Resets the projection timing counters. Call before publishing.</summary>
		public void BeginRefresh()
		{
			LastProjectionMs = 0;
			LastProjectionWasHit = true;
		}

		private BuildingCatalogEntry[] ProjectForMenu(
			string? menu,
			IReadOnlyList<string>? contentDlcs = null,
			bool ignorePacks = false)
		{
			var key = SnapshotKey.For(menu, contentDlcs, ignorePacks, ToolbarSelection);

			if (_snapshots.TryGet(key, PrefabIndexingSystem.IndexGeneration, out var cached))
			{
				return cached;
			}

			var timer = System.Diagnostics.Stopwatch.StartNew();
			var built = ProjectForMenuUncached(menu, contentDlcs, ignorePacks).ToArray();
			_snapshots.Put(key, PrefabIndexingSystem.IndexGeneration, built);
			LastProjectionMs += (int)timer.ElapsedMilliseconds;
			LastProjectionWasHit = false;

			return built;
		}

		private IEnumerable<BuildingCatalogEntry> ProjectForMenuUncached(
			string? menu,
			IReadOnlyList<string>? contentDlcs,
			bool ignorePacks)
		{
			var entries = GetIndexedBuildings(menu, ignorePackSelection: ignorePacks, unionDlcIds: contentDlcs).Select(Project).ToArray();
			var root = PrefabIndexingSystem.GetDevTreeRootLabel(menu);

			if (string.IsNullOrEmpty(root))
			{
				return entries;
			}

			return entries.Select(entry =>
			{
				if (!string.Equals(entry.DevTreeBranch, root, StringComparison.Ordinal))
				{
					return entry;
				}

				// PER CATEGORY, not one bucket for the whole menu. Health &
				// Deathcare is the case that settles it: its ungated assets sit
				// in both categories, so a single bucket had to be called after
				// the menu — and the tab drawn for it is scoped to Healthcare
				// and holds only clinics, so the name said deathcare about a
				// tab with none in it.
				//
				// Split this way each bucket is named for the category it is
				// actually in, and the menu name is left for the assets that
				// have no category to be named after.
				var category = NetworkMenuExtension.EffectiveCategory(entry, menu) ?? string.Empty;
				var label = VanillaServiceLabel(category.Length > 0 ? category : menu ?? string.Empty);

				return label.Length == 0 ? entry : entry with { DevTreeBranch = label };
			});
		}

		/// <summary>
		/// The game's own word for a service or one of its categories.
		/// </summary>
		/// <remarks>
		/// The same chain the category tabs resolve through, and for the same
		/// reason: the game ships a localized string under exactly these ids —
		/// SubServices.NAME[TransportationRoad] is "Road", Services.NAME[Roads]
		/// is "Roads", and both translate. Falls back to the id, which is at
		/// least a name rather than a blank.
		/// </remarks>
		private static string VanillaServiceLabel(string id)
		{
			if (string.IsNullOrEmpty(id))
			{
				return string.Empty;
			}

			var dictionary = GameManager.instance.localizationManager.activeDictionary;

			foreach (var key in new[] { $"SubServices.NAME[{id}]", $"Services.NAME[{id}]" })
			{
				if (dictionary.TryGetValue(key, out var name) && !string.IsNullOrWhiteSpace(name))
				{
					return name;
				}
			}

			return id;
		}

		/// <summary>
		/// The catalog entry for a prefab name, or null when the index has no
		/// such prefab — including while the index is still cold.
		/// </summary>
		/// <remarks>
		/// For the extension picker, whose rows vanilla names by prefab. This
		/// does NOT apply the menu's own filters — the upgrade exclusion at
		/// GetIndexedBuildings, the toolbar's theme/pack row — because vanilla
		/// has already decided what is listed; the question here is only how to
		/// draw a row that is. The name map is rebuilt per index generation and
		/// is empty until the first full index completes.
		/// </remarks>
		public BuildingCatalogEntry? EntryForPrefabName(string prefabName)
		{
			if (string.IsNullOrEmpty(prefabName) || !BuildingMenuUtil.IsReady)
			{
				return null;
			}

			if (_byNameGeneration != PrefabIndexingSystem.IndexGeneration)
			{
				_byName.Clear();

				if (BuildingMenuUtil.CategorizedPrefabs.TryGetValue(PrefabCategory.Any, out var categories)
					&& categories.TryGetValue(PrefabSubCategory.Any, out var prefabs))
				{
					foreach (var prefab in prefabs)
					{
						if (!string.IsNullOrEmpty(prefab.PrefabName))
						{
							_byName[prefab.PrefabName!] = prefab;
						}
					}
				}

				_byNameGeneration = PrefabIndexingSystem.IndexGeneration;
			}

			return _byName.TryGetValue(prefabName, out var found) ? Project(found) : null;
		}

		private readonly Dictionary<string, PrefabIndex> _byName = new(StringComparer.Ordinal);
		private int _byNameGeneration = -1;

		private static BuildingCatalogEntry Project(PrefabIndex prefab)
		{
			return new BuildingCatalogEntry(
				Id: prefab.Id,
				PrefabName: prefab.PrefabName ?? string.Empty,
				Name: prefab.Name ?? prefab.PrefabName ?? string.Empty,
				Category: prefab.Category.ToString(),
				SubCategory: prefab.SubCategory.ToString(),
				CategoryLabel: BuildingCatalogLabels.ForCategory(prefab.Category, prefab.Category.ToString()),
				SubCategoryLabel: BuildingCatalogLabels.ForSubCategory(prefab.SubCategory, prefab.SubCategory.ToString()),
				// Both, not one coalesced into the other: the thumbnail camera
				// returns a URL for every prefab but only renders the ones
				// vanilla shows in a menu, so a spawnable zone building has a
				// non-null Thumbnail that draws nothing. A ?? here cannot see
				// that; the renderer can, and falls back on the image error.
				Thumbnail: IconPath.Normalize(prefab.Thumbnail ?? prefab.FallbackThumbnail ?? string.Empty),
				FallbackThumbnail: IconPath.Normalize(
					prefab.FallbackThumbnail ?? prefab.CategoryThumbnail ?? string.Empty),
				// Generated on first sight and cached on disk, so this costs one
				// file read per distinct vector icon for the life of the install
				// — not per projection, and not per entry.
				SilhouetteThumbnail: Mod.Silhouettes?.UrlFor(
					IconPath.Normalize(prefab.Thumbnail ?? prefab.FallbackThumbnail ?? string.Empty)),
				UiMenu: prefab.UiMenuName,
				UiCategory: prefab.UiCategoryName,
				ServiceRange: prefab.ServiceRange,
				ServiceFacts: prefab.ServiceFacts.Count > 0 ? prefab.ServiceFacts.ToArray() : null,
				ServiceTextFacts: prefab.ServiceTextFacts.Count > 0 ? prefab.ServiceTextFacts.ToArray() : null,
				Footprints: prefab.Footprints,
				FootprintOverflow: prefab.FootprintOverflow,
				SpeedLimit: prefab.SpeedLimit,
				NetworkWidth: prefab.NetworkWidth,
				LeisureType: prefab.LeisureType ?? string.Empty,
				LeisureEfficiency: prefab.LeisureEfficiency,
				UiCategoryPriority: prefab.UiCategoryPriority,
				// int.MaxValue means the prefab had no UIObject at all; vanilla
				// reads that as 0. See BuildingCatalogEntry.UIOrder.
				UIOrder: prefab.UIOrder == int.MaxValue ? 0 : prefab.UIOrder,
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
				DevTreeBranch: prefab.DevTreeBranch,
				DevTreeBranchIcon: prefab.DevTreeBranchIcon,
				DevTreeBranchDepth: prefab.DevTreeBranchDepth,
				UnlockRequirements: prefab.UnlockRequirements,
				Bonuses: prefab.Bonuses,
				CostIsPerDistance: prefab.CostIsPerDistance,
				ParkingSlots: prefab.ParkingSlots,
				PdxModsId: prefab.PdxModsId ?? string.Empty,
				DlcId: prefab.DlcId == DlcId.Invalid ? null : prefab.DlcId.id.ToString(),
				Theme: prefab.Theme?.name,
				AssetPacks: prefab.AssetPacks?.Where(pack => pack is not null).Select(pack => pack.name).Where(name => !string.IsNullOrWhiteSpace(name)).ToArray() ?? Array.Empty<string>(),
				AssetPackIndices: prefab.VanillaFacts.AssetPacks?.ToArray() ?? Array.Empty<int>(),
				// Per query, not per index: the city gains and loses these as
				// the player builds and bulldozes. See PlacedUniqueRegistry.
				IsUnique: prefab.IsUnique,
				IsAlreadyBuilt: PlacedUniqueRegistry.IsAlreadyBuilt(prefab.Id),
				PlacementFlags: GetPlacementFlagNames(prefab.BuildingFlagsValue),
				Extensions: prefab.ExtensionIds ?? Array.Empty<string>(),
				SupportedUpgrades: prefab.SupportedUpgradeIds ?? Array.Empty<string>(),
				ConstructionCost: prefab.ConstructionCost,
				Upkeep: prefab.Upkeep,
				Workers: prefab.Workers,
				Households: prefab.Households,
				Capacity: prefab.Capacity,
				ElectricityConsumption: prefab.ElectricityConsumption,
				WaterConsumption: prefab.WaterConsumption,
				GarbageAccumulation: prefab.GarbageAccumulation,
				TelecomNeed: prefab.TelecomNeed,
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
			// Resting state shows NOTHING selected, which is what the vanilla
			// PACK row directly above this control does — measured in the live
			// panel rather than argued:
			//
			//     Theme         ON  off              (a theme really is chosen)
			//     Pack          off off off off …    (and every pack is showing)
			//     Availability  …                    (ours, beside them)
			//
			// Pack is the exact analogue: an exhaustive set where nothing picked
			// means everything shows, drawn as all dark. Lighting all three said
			// "everything is showing" in a panel whose own control says that with
			// silence, and the two disagreed a row apart.
			//
			// Pairs with ToggleExhaustive: from here a click NARROWS to what was
			// clicked, which is also what Pack does. All dark, click one, see
			// only that one.
			BuildingCatalogFacetOption[] options = BuildingCatalogFacetSelection.Availability.All
				.Select(value => new BuildingCatalogFacetOption(
					value,
					FormatFacetWords(value),
					selected is not null
						&& selected.Any(option => string.Equals(option, value, StringComparison.OrdinalIgnoreCase))))
				.ToArray();

			groups.Add(new BuildingCatalogFacetGroup(
				"availability",
				"Availability",
				options,
				// Exhaustive, so a selection narrows only while it is partial.
				// Nothing selected and everything selected both admit everything,
				// and the toggle collapses both to the same stored null.
				Narrowing: options.Any(option => option.Selected)));
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

		/// <summary>
		/// The content a menu's assets require that the game's own row cannot reach.
		/// </summary>
		/// <remarks>
		/// This offered packs too, and no longer does. Vanilla's tool-options panel
		/// is on screen WHILE THE LENS IS OPEN and already holds Theme and Pack —
		/// measured live at 720p in the Zones menu, its Pack row carried 12 controls
		/// against the 10 options this group was drawing. So the pack half was not a
		/// wider reach, it was a second control for state the game owns, sitting a
		/// few hundred pixels from the first. Direction from the user: "Pack control
		/// is exposed in the vanilla tooling, we don't need a pack filter in the
		/// filter rail."
		///
		/// An earlier comment here claimed the opposite — that our pack list beat
		/// the game's four to two in Parks &amp; Recreation. That was measured against
		/// BindPacks, which builds its row from the selected CATEGORY; the panel row
		/// above is not so scoped, and it wins.
		///
		/// What is left is the part vanilla genuinely cannot express: a DLC that
		/// ships NO creator pack. San Francisco Set and Landmark Buildings are 163
		/// assets between them, and nothing in the game's Pack row speaks for either,
		/// because neither has a pack to speak with. DlcIds is the only mechanism
		/// that reaches them.
		///
		/// So the packedDlcs test below now does the whole job of avoiding
		/// duplication: a DLC with a pack is skipped here because the game's own row
		/// already carries that pack. Bridges &amp; Ports has one, so it appears there
		/// and not here.
		///
		/// Base game leads, as it does in the game's row, because "show me only what
		/// needs no DLC" is the same question the rest of this group answers.
		/// </remarks>
		private static void AddContentGroup(
			ICollection<BuildingCatalogFacetGroup> groups,
			IReadOnlyList<BuildingCatalogEntry> source,
			BuildingCatalogQuery query)
		{
			var options = new List<BuildingCatalogFacetOption>();

			// Base game leads, the way it leads the game's own row.
			if (source.Any(IsBaseGameContent))
			{
				options.Add(new BuildingCatalogFacetOption(
					ContentOption.Vanilla,
					FormatDlcLabel(DlcId.BaseGame.id.ToString(CultureInfo.InvariantCulture)),
					ToolbarSelection.VanillaSelected));
			}

			// The tail: DLC no pack speaks for.
			var packedDlcs = new HashSet<string>(
				source
					.Where(entry => (entry.AssetPackIndices?.Length ?? 0) > 0)
					.Select(entry => entry.DlcId ?? string.Empty),
				StringComparer.Ordinal);

			options.AddRange(source
				.Where(entry => !IsBaseGameContent(entry)
					&& (entry.AssetPackIndices?.Length ?? 0) == 0
					&& !string.IsNullOrEmpty(entry.DlcId))
				.Select(entry => entry.DlcId!)
				.Where(dlc => !packedDlcs.Contains(dlc))
				.Distinct(StringComparer.Ordinal)
				.OrderBy(FormatDlcLabel, StringComparer.CurrentCultureIgnoreCase)
				.Select(dlc => new BuildingCatalogFacetOption(
					ContentOption.Dlc + dlc,
					FormatDlcLabel(dlc),
					query.DlcIds is not null
					&& query.DlcIds.Any(selected => string.Equals(selected, dlc, StringComparison.Ordinal)))));

			// Same rule as every other dimension: one value splits nothing, and
			// a selection holds the group open so it can still be cleared.
			if (options.Count > 1 || options.Any(option => option.Selected))
			{
				groups.Add(new BuildingCatalogFacetGroup("content", "Content", options.ToArray()));
			}
		}

		/// <summary>Shipped by the studio, gated behind no DLC.</summary>
		private static bool IsBaseGameContent(BuildingCatalogEntry entry) =>
			string.Equals(
				entry.DlcId,
				DlcId.BaseGame.id.ToString(CultureInfo.InvariantCulture),
				StringComparison.Ordinal);

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
