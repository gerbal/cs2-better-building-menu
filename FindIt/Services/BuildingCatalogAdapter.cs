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
			AddValueGroup(
				groups,
				"availability",
				"Availability",
				source.Select(entry => entry.IsLocked ? "Locked" : "Unlocked"),
				query.Availability,
				FormatFacetWords);
			AddValueGroup(groups, "dlc", "DLC", source.Select(entry => entry.DlcId), query.DlcIds, FormatDlcLabel);
			AddValueGroup(groups, "theme", "Theme", source.Select(entry => entry.Theme), query.Themes, FormatFacetWords);
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
					: PrefabIndexingSystem.IsPlacedInMenu(prefab.Id, menu))
				.Where(prefab => filters.All(filter => filter(prefab)));
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

		private static void AddValueGroup(
			ICollection<BuildingCatalogFacetGroup> groups,
			string id,
			string label,
			IEnumerable<string?> values,
			IReadOnlyList<string>? selected,
			Func<string, string>? formatLabel = null)
		{
			string[] distinctValues = DistinctValues(values);
			if (!IsWorthOffering(distinctValues, selected))
			{
				return;
			}

			groups.Add(new BuildingCatalogFacetGroup(
				id,
				label,
				CreateOptions(distinctValues, selected, formatLabel)));
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
