using Colossal.PSI.Common;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
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
		/// Projects the indexed prefab records into the building lens. Deliberately not an
		/// ECS query: PrefabIndexingSystem stays the single source of truth for discovery,
		/// categorisation, thumbnails and placement identity.
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

		private readonly Func<string, string?> _silhouetteUrl;

		/// <param name="silhouetteUrl">
		/// The blackened copy of a vector icon, or null when it has none. Passed in rather
		/// than read from Mod, whose type initializer needs the running game, so a test can
		/// project an entry. Defaults to no silhouettes.
		/// </param>
		public BuildingCatalogAdapter(Func<string, string?>? silhouetteUrl = null)
		{
			_silhouetteUrl = silhouetteUrl ?? (_ => null);
		}

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
		/// Content is one axis over three pieces of state, so its options combine as OR.
		/// The toolbar selection ORs its two arms itself; DlcIds is applied HERE so it
		/// unions with them rather than intersecting them in the query engine.
		/// </remarks>
		private static bool ContentVisible(
			PrefabIndex prefab,
			VanillaToolbarSelection selection,
			IReadOnlyList<string>? dlcIds)
		{
			// Themes are a DIFFERENT facet and must narrow on their own terms, so they
			// are split out and ANDed before anything else: VanillaToolbarSelection.IsEmpty
			// counts themes too, and a city always has one selected.
			if (!VanillaToolbarFilter.IsVisible(prefab.VanillaFacts, ThemesOnly(selection)))
			{
				return false;
			}

			var content = ContentOnly(selection);
			bool packsChosen = !content.IsEmpty;

			if (dlcIds is not { Count: > 0 })
			{
				return !packsChosen || VanillaToolbarFilter.IsVisible(prefab.VanillaFacts, content);
			}

			bool matchesDlc = prefab.DlcId.id != GameDlcIds.Invalid
				&& dlcIds.Any(id => string.Equals(
					id,
					prefab.DlcId.id.ToString(CultureInfo.InvariantCulture),
					StringComparison.Ordinal));

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
		/// Every category whose density tiers should be drawn in its place.
		/// </summary>
		/// <remarks>
		/// Sub-tabs stand in for a category only when they PARTITION it, so a category
		/// with fewer than two tiers, or holding any untiered entry, keeps a plain tab
		/// rather than a tab row that hides part of its own category.
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
						// Vanilla's own zoning icon for this family AND tier, falling
						// back to the category's icon in the strip when the game ships
						// none rather than deriving a mark it never authored.
							ZoneDensityIcons.For(category.Key, tier.Key),
							BuildingCatalogLabels.DensityTier(tier.Key)))
						.ToArray()))
				.ToArray();
		}

		/// <summary>
		/// The glyph every school-level tab is built on.
		/// </summary>
		/// <remarks>
		/// A school's level is the attainment it grants, so one mortarboard carries every
		/// level with the rank drawn over it as a roman numeral: the row says what kind of
		/// thing a tab is before it says how much, and four glyphs read as four subjects.
		/// </remarks>
		internal const string SchoolTierIcon = "Media/Game/Icons/Education.svg";

		/// <summary>
		/// The glyph a tab draws.
		/// </summary>
		/// <remarks>
		/// An AUTHORED icon first where the axis has one, since that is the art the player
		/// already associates with the unlock; otherwise a representative asset's thumbnail,
		/// picked by menu priority then name so the glyph survives a re-sort.
		/// </remarks>
		/// <param name="allowCategoryGlyph">
		/// False when a sibling tab already draws this category's glyph, which drops this
		/// tab to the representative asset instead. Only the caller can tell: whether a
		/// glyph repeats is a fact about the row, not about one group.
		/// </param>
		internal static string TabIcon(IEnumerable<BuildingCatalogEntry> group, bool authored, bool allowCategoryGlyph = true)
		{
			var entries = group.ToArray();

			if (authored)
			{
				// The branch's authored icon, unless the indexer filled it with the
				// asset's own render for a node the tree gives none. That is a
				// photograph in a row of glyphs, so it counts as no icon.
				var icon = entries
					.Select(entry => entry.DevTreeBranchIcon)
					.FirstOrDefault(value => value is { Length: > 0 } && !IsPhotograph(value));

				if (icon is { Length: > 0 })
				{
					return icon;
				}
			}

			var ordered = entries
				.OrderBy(entry => entry.UiCategoryPriority)
				.ThenBy(entry => entry.Name, StringComparer.Ordinal)
				.ToArray();

			// The fallback thumbnail keeps a photograph out of a row of flat glyphs,
			// but the glyph belongs to the CATEGORY, so CatalogView.Disambiguate turns
			// it off for the tabs whose glyph repeats: legible beats tidy.
			if (authored && allowCategoryGlyph)
			{
				var glyph = ordered
					.Select(entry => entry.FallbackThumbnail)
					.FirstOrDefault(value => value is { Length: > 0 });

				if (glyph is { Length: > 0 })
				{
					return glyph;
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
		/// Deciding WHICH entries are in view belongs to the running game; only the min
		/// and max of them belong here, which is what makes the rule directly testable.
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
		/// The entries the PACK group is counted over, when that differs from the rest.
		/// Defaults to <paramref name="entries"/>; the adapter passes a pack-unfiltered set
		/// so the group can offer a pack other than the one already chosen.
		/// </param>
		/// <param name="vanillaSelected">
		/// Whether the game's own row has its base-game option ticked, which the Content
		/// group's matching option mirrors.
		/// </param>
		public static BuildingCatalogFacetState BuildFacetState(
			IEnumerable<BuildingCatalogEntry> entries,
			BuildingCatalogQuery query,
			IEnumerable<BuildingCatalogEntry>? packScope = null,
			bool vanillaSelected = false)
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

			AddValueGroup(groups, FacetIds.BuildingType, "Role", source.Select(entry => entry.BuildingType), query.BuildingTypes, WordFormat.SplitIdentifier);
			AddValueGroup(groups, FacetIds.Provenance, "Source", source.Select(entry => entry.Provenance), query.Provenance, FormatProvenanceLabel);
			// Progression, which the vanilla menu shows only by greying an asset out.
			AddAvailabilityGroup(groups, source, query.Availability);
			// Where it came from, next to who made it: one axis, one place.
			// See AddContentGroup.
			AddContentGroup(groups, packScope is null ? source : packScope.ToArray(), query, vanillaSelected);
			AddValueGroup(groups, FacetIds.Theme, "Theme", source.Select(entry => entry.Theme), query.Themes, WordFormat.SplitIdentifier);
			// Neither unlock modality is a facet. Development restates the strip's own
			// axis and collides with Role, and "can I build this now" is the question
			// Availability answers; both stay reachable as a Group by dimension.
			AddArrayGroup(groups, FacetIds.Placement, "Placement", source.Select(entry => entry.PlacementFlags), query.PlacementFlags, FormatFlagLabel);
			// Upgrades are not a facet: most belong to a single building, so a filter by
			// upgrade narrows to that building, which its hover card and the extension
			// picker already show. Density is not a facet either: every type+density tier is a category with
			// its own tab and icon in the top bar, so the rail would be a dropdown of the
			// tabs above it. It stays reachable as a Group by dimension and as a sort.

			bool hasSelection = HasValues(query.Availability)
				|| HasValues(query.BuildingTypes)
				|| HasValues(query.Provenance)
				|| HasValues(query.DlcIds)
				|| HasValues(query.Themes)
				|| HasValues(query.PlacementFlags);

			return new BuildingCatalogFacetState(groups.ToArray(), hasSelection);
		}

		/// <summary>One view per refresh: every per-query answer comes from it.</summary>
		/// <remarks>
		/// BuildingMenuUISystem calls this once per refresh and reads the view's properties,
		/// and once more for the matches-elsewhere count when a search finds nothing.
		/// </remarks>
		/// <param name="source">
		/// What this refresh reads from the indexer, taken once so every answer in it
		/// agrees; see PrefabIndexingSystem.Source.
		/// </param>
		/// <param name="selection">
		/// The game's own toolbar filter row, which BuildingMenuUISystem holds;
		/// <see cref="VanillaToolbarSelection.None"/> filters nothing.
		/// </param>
		public CatalogView Build(
			CatalogSource source,
			BuildingCatalogQuery query,
			VanillaToolbarSelection selection,
			Func<CatalogView, string>? groupByResolver = null)
		{
			if (query is null)
			{
				throw new ArgumentNullException(nameof(query));
			}

			var snapshot = ProjectForMenu(source, query.UiMenu, selection, query.DlcIds);

			// Packs alone are counted before the pack filter runs, because that
			// filter is upstream of InScope and InScope cannot undo it. Only a
			// second snapshot when a pack IS selected.
			return new CatalogView(
				snapshot,
				query,
				selection.SelectedPacks.Count > 0
					? () => ProjectForMenu(source, query.UiMenu, selection, query.DlcIds, ignorePacks: true)
					: null,
				groupByResolver,
				PrefabIndexingSystem.GetMilestoneNames(),
				VanillaMenus.IsEducation(query.UiMenu),
				selection.VanillaSelected);
		}

		/// <summary>
		/// What the lens catalogues.
		/// </summary>
		/// <remarks>
		/// Networks belong beside buildings because the lens can name and group what the
		/// vanilla Roads grid leaves unlabelled; placement still hands off to the native
		/// net tool. This is the floor only — BelongsInCatalog decides per scope.
		/// </remarks>
		private static bool IsBuilding(PrefabIndex prefab)
		{
			return prefab.Category is PrefabCategory.Buildings
				or PrefabCategory.ServiceBuildings
				or PrefabCategory.Networks;
		}

		/// <summary>Whether an asset belongs in the catalogue at this scope.</summary>
		/// <remarks>
		/// Split out from GetIndexedBuildings so the rule that must hold between the two
		/// scopes — removing the menu scope widens the result, never narrows it — can be
		/// asserted without a live index. Both placement facts are false when unscoped.
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

		/// <summary>Whether the index holds anything the given menu places.</summary>
		/// <param name="selection">
		/// The game's own toolbar filter row. Its themes and Vanilla/Mods toggles can empty a
		/// menu, which then goes back to vanilla; its pack selection is ignored here.
		/// </param>
		public static bool MenuHasAssets(string menu, VanillaToolbarSelection selection) =>
			GetIndexedBuildings(menu, selection, ignorePackSelection: true).Any();

		/// <summary>
		/// The candidate set, widened to whatever menu the player has open.
		/// </summary>
		/// <remarks>
		/// Once the player has opened a vanilla menu, that menu is the authority on its own
		/// contents and our taxonomy has no standing to overrule it, so a scoped view admits
		/// that menu's members whatever they are. Unscoped views are untouched.
		/// </remarks>
		/// <param name="ignorePackSelection">
		/// Applies the toolbar's themes and Vanilla/Mods toggles but NOT its packs. Only the
		/// pack facet wants this, for the same reason InScope drops a facet's own selection
		/// before counting it: a dimension computed from the set it narrowed offers only itself.
		/// </param>
		private static IEnumerable<PrefabIndex> GetIndexedBuildings(
			string? uiMenu,
			VanillaToolbarSelection selection,
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
				// Sub-buildings are not list entries, which is the test vanilla runs
				// too: an upgrade is placed from its parent building's row. They stay
				// INDEXED, so search and the extension picker still see them.
				.Where(prefab => !prefab.IsServiceUpgrade)
				// The game's own toolbar row — the theme toggle, the asset packs and
				// Vanilla/Mods — transcribed rather than reimplemented, so a difference
				// is a bug. IsVisible early-outs on an empty selection.
				.Where(prefab => ContentVisible(
					prefab,
					ignorePackSelection ? WithoutPacks(selection) : selection,
					unionDlcIds))
				// Membership comes from the game's own tree, walked DOWN from
				// UIAssetMenuData the way ToolbarUISystem does: a scoped view shows that
				// menu's members, an unscoped one the same tree unioned over every menu.
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
		/// Trams, paths, bike trails, seaways, rail, power lines and pipes are all networks,
		/// so the Roads menu gathers them without taking them out of the menus that hold them.
		/// IsExtended is asked HERE so the argument enum ToString runs only for that menu.
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
		/// Keyed by scope and kept until the source's generation changes, so they DO
		/// survive from one refresh to the next; see SnapshotCache.
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
			CatalogSource source,
			string? menu,
			VanillaToolbarSelection selection,
			IReadOnlyList<string>? contentDlcs = null,
			bool ignorePacks = false)
		{
			var key = SnapshotKey.For(menu, contentDlcs, ignorePacks, selection);

			if (_snapshots.TryGet(key, source.Generation, out var cached))
			{
				return cached;
			}

			var timer = System.Diagnostics.Stopwatch.StartNew();
			var built = ProjectForMenuUncached(source.Placed, menu, selection, contentDlcs, ignorePacks).ToArray();
			_snapshots.Put(key, source.Generation, built);
			LastProjectionMs += (int)timer.ElapsedMilliseconds;
			LastProjectionWasHit = false;

			return built;
		}

		private IEnumerable<BuildingCatalogEntry> ProjectForMenuUncached(
			PlacedUniques placed,
			string? menu,
			VanillaToolbarSelection selection,
			IReadOnlyList<string>? contentDlcs,
			bool ignorePacks)
		{
			var entries = GetIndexedBuildings(menu, selection, ignorePackSelection: ignorePacks, unionDlcIds: contentDlcs)
				.Select(prefab => Project(prefab, placed))
				.ToArray();
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

				// PER CATEGORY, not one bucket for the whole menu: the tab drawn for a
				// bucket is scoped to a single category, so a menu-wide name would say
				// something the tab's contents do not bear out.
				var category = NetworkMenuExtension.EffectiveCategory(entry, menu) ?? string.Empty;
				var label = VanillaServiceLabel(category.Length > 0 ? category : menu ?? string.Empty);

				return label.Length == 0 ? entry : entry with { DevTreeBranch = label };
			});
		}

		/// <summary>
		/// The game's own word for a service or one of its categories.
		/// </summary>
		/// <remarks>
		/// The same chain the category tabs resolve through, because the game ships a
		/// localized string under exactly these ids. Falls back to the id, which is at
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
		/// For the extension picker, whose rows vanilla names by prefab. It deliberately
		/// applies none of the menu's own filters: vanilla has already decided what is
		/// listed, and the question here is only how to draw a row that is.
		/// </remarks>
		public BuildingCatalogEntry? EntryForPrefabName(CatalogSource source, string prefabName)
		{
			if (string.IsNullOrEmpty(prefabName) || !BuildingMenuUtil.IsReady)
			{
				return null;
			}

			if (_byNameGeneration != source.Generation)
			{
				_byName.Clear();

				if (BuildingMenuUtil.CategorizedPrefabs.TryGetValue(PrefabCategory.Any, out var categories)
					&& categories.TryGetValue(PrefabSubCategory.Any, out var prefabs))
				{
					foreach (var prefab in prefabs)
					{
						if (prefab.PrefabName is { Length: > 0 } name)
						{
							_byName[name] = prefab;
						}
					}
				}

				_byNameGeneration = source.Generation;
			}

			return _byName.TryGetValue(prefabName, out var found) ? Project(found, source.Placed) : null;
		}

		private readonly Dictionary<string, PrefabIndex> _byName = new(StringComparer.Ordinal);
		private int _byNameGeneration = -1;

		private BuildingCatalogEntry Project(PrefabIndex prefab, PlacedUniques placed)
		{
			return new BuildingCatalogEntry(
				Id: prefab.Id,
				PrefabName: prefab.PrefabName ?? string.Empty,
				Name: prefab.Name ?? prefab.PrefabName ?? string.Empty,
				Category: prefab.Category.ToString(),
				SubCategory: prefab.SubCategory.ToString(),
				CategoryLabel: BuildingCatalogLabels.ForCategory(prefab.Category, prefab.Category.ToString()),
				SubCategoryLabel: BuildingCatalogLabels.ForSubCategory(prefab.SubCategory, prefab.SubCategory.ToString()),
				// Both, not one coalesced into the other: the thumbnail camera returns
				// a URL for every prefab but renders only the ones vanilla shows, so a
				// ?? here cannot see the blank that the renderer can.
				Thumbnail: IconPath.Normalize(prefab.Thumbnail ?? prefab.FallbackThumbnail ?? string.Empty),
				FallbackThumbnail: IconPath.Normalize(
					prefab.FallbackThumbnail ?? prefab.CategoryThumbnail ?? string.Empty),
				// Generated on first sight and cached on disk: one file read per distinct
				// vector icon for the life of the install, not one per projection.
				SilhouetteThumbnail: _silhouetteUrl(
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
				DlcId: prefab.DlcId.id == GameDlcIds.Invalid ? null : prefab.DlcId.id.ToString(),
				Theme: prefab.Theme?.name,
				AssetPacks: prefab.AssetPacks?.Where(pack => pack is not null).Select(pack => pack.name).Where(name => !string.IsNullOrWhiteSpace(name)).ToArray() ?? Array.Empty<string>(),
				AssetPackIndices: prefab.VanillaFacts.AssetPacks?.ToArray() ?? Array.Empty<int>(),
				// Per query, not per index: the city gains and loses these as
				// the player builds and bulldozes. See PlacedUniques.
				IsUnique: prefab.IsUnique,
				IsAlreadyBuilt: placed.IsAlreadyBuilt(prefab.Id),
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
		/// The dimension is exhaustive, so it is offered even where only one value is present
		/// — a founding city where everything is locked is exactly when the filter should say
		/// so — and an empty stored selection reads as both, which is what it means.
		/// </remarks>
		/// </remarks>
		private static void AddAvailabilityGroup(
			ICollection<BuildingCatalogFacetGroup> groups,
			IReadOnlyCollection<BuildingCatalogEntry> source,
			IReadOnlyList<string>? selected)
		{
			// Resting state shows NOTHING selected, matching the vanilla pack row
			// directly above: an exhaustive set where nothing picked means everything
			// shows. Pairs with ToggleExhaustive, where a click narrows to what was clicked.
			BuildingCatalogFacetOption[] options = BuildingCatalogFacetSelection.Availability.All
				.Select(value => new BuildingCatalogFacetOption(
					value,
					WordFormat.SplitIdentifier(value),
					selected is not null
						&& selected.Any(option => string.Equals(option, value, StringComparison.OrdinalIgnoreCase))))
				.ToArray();

			groups.Add(new BuildingCatalogFacetGroup(
				FacetIds.Availability,
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
		/// One distinct value is not a filter: every entry in view already has it, so the
		/// control is a no-op that still costs a slot. A selection keeps the group alive
		/// whatever its size, or the filter would be applied with nothing on screen to undo it.
		/// </remarks>
		private static bool IsWorthOffering(string[] distinctValues, IReadOnlyList<string>? selected)
		{
			return distinctValues.Length > 1 || (selected is not null && selected.Count > 0);
		}

		/// <summary>
		/// The content a menu's assets require that the game's own row cannot reach.
		/// </summary>
		/// <remarks>
		/// Packs belong to vanilla's tool-options panel, which is on screen while the lens is
		/// open. What is left is the part that panel cannot express: a DLC shipping no creator
		/// pack. The packedDlcs test below skips any DLC the game's own row already carries.
		/// </remarks>
		private static void AddContentGroup(
			ICollection<BuildingCatalogFacetGroup> groups,
			IReadOnlyList<BuildingCatalogEntry> source,
			BuildingCatalogQuery query,
			bool vanillaSelected)
		{
			var options = new List<BuildingCatalogFacetOption>();

			// Base game leads, the way it leads the game's own row.
			if (source.Any(IsBaseGameContent))
			{
				options.Add(new BuildingCatalogFacetOption(
					ContentOption.Vanilla,
					FormatDlcLabel(GameDlcIds.BaseGame.ToString(CultureInfo.InvariantCulture)),
					vanillaSelected));
			}

			// The tail: DLC no pack speaks for.
			var packedDlcs = new HashSet<string>(
				source
					.Where(entry => (entry.AssetPackIndices?.Length ?? 0) > 0)
					.Select(entry => entry.DlcId ?? string.Empty),
				StringComparer.Ordinal);

			options.AddRange(source
				.Where(entry => !IsBaseGameContent(entry) && (entry.AssetPackIndices?.Length ?? 0) == 0)
				.Select(entry => entry.DlcId ?? string.Empty)
				.Where(dlc => dlc.Length > 0 && !packedDlcs.Contains(dlc))
				.Distinct(StringComparer.Ordinal)
				// Invariant rather than current: Mono's current culture is the OS's, not the
				// game's language, so the same DLC list would sort differently per machine.
				.OrderBy(FormatDlcLabel, StringComparer.InvariantCultureIgnoreCase)
				.Select(dlc => new BuildingCatalogFacetOption(
					ContentOption.Dlc + dlc,
					FormatDlcLabel(dlc),
					query.DlcIds is not null
					&& query.DlcIds.Any(selected => string.Equals(selected, dlc, StringComparison.Ordinal)))));

			// Same rule as every other dimension: one value splits nothing, and
			// a selection holds the group open so it can still be cleared.
			if (options.Count > 1 || options.Any(option => option.Selected))
			{
				groups.Add(new BuildingCatalogFacetGroup(FacetIds.Content, "Content", options.ToArray()));
			}
		}

		/// <summary>Shipped by the studio, gated behind no DLC.</summary>
		private static bool IsBaseGameContent(BuildingCatalogEntry entry) =>
			string.Equals(
				entry.DlcId,
				GameDlcIds.BaseGame.ToString(CultureInfo.InvariantCulture),
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
		/// A selection has to stay visible even when nothing in view carries it, or it becomes
		/// a filter with no control attached: the group would publish zero options — dropped by
		/// the rail and the chip row alike — while the query went on filtering on it.
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
				.Select(value => value?.Trim() ?? string.Empty)
				.Where(value => value.Length > 0)
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

			if (numericId == GameDlcIds.BaseGame)
			{
					// Deliberately not "Base game": the Source facet already uses that
					// label for content shipped by the studio rather than by a mod, and two
					// identically-named options in adjacent groups read as a duplicate.
				return "No DLC required";
			}

			// The toolbar's own DLC option already resolves a numeric DlcId to the
			// game's internal name and localized title, so reuse that metadata; the
			// explicit ID fallback beats exposing a bare numeric token.
			try
			{
				string internalName = PlatformManager.instance.GetDlcName(new DlcId(numericId));
				if (!string.IsNullOrWhiteSpace(internalName))
				{
					return LocaleHelper.Translate(
						$"Common.DLC_TITLE[{internalName}]",
						LocaleHelper.Translate($"Assets.NAME[{internalName}]", WordFormat.SplitIdentifier(internalName)));
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

			return WordFormat.SplitIdentifier(value);
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
