using System;
using System.Collections.Generic;


using BetterBuildingMenu.Domain.Enums;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Makes the Roads menu the menu for every network, not just the ones the
	/// game files under Roads.
	/// </summary>
	/// <remarks>
	/// Vanilla scatters networks by the service that owns them, so building one means knowing
	/// which service that is. This is the one place the asset menu deliberately shows more than the
	/// game: the extras rank behind every vanilla category, and none is removed from its own menu.
	/// </remarks>
	public static class NetworkMenuExtension
	{
		/// <summary>The menu that carries every network.</summary>
		public const string RoadsMenu = VanillaMenus.Roads;

		/// <summary>The value <c>BuildingCatalogEntry.Category</c> holds for a network.</summary>
		private const string NetworksCategory = nameof(PrefabCategory.Networks);

		/// <summary>The prefix every network subcategory's name carries.</summary>
		private const string SubCategoryPrefix = nameof(PrefabCategory.Networks) + "_";

		/// <summary>
		/// Where the extra groups start, above anything the game will assign.
		/// </summary>
		/// <remarks>
		/// Vanilla category priorities are small integers, so this is not a tuned number but one
		/// nothing can reach. MenuCategoryRank widens to long before padding, so the size is free.
		/// </remarks>
		public const int ExtraGroupPriorityBase = 1_000_000;

		/// <summary>Whether this menu is the one that gathers every network.</summary>
		public static bool IsExtended(string? menu) => VanillaMenus.IsRoads(menu);

		/// <summary>
		/// Network subcategories the extension does not gather.
		/// </summary>
		/// <remarks>
		/// Stops and routes are transit OPERATION rather than track you lay, and power lines, pipes
		/// and waterways answer to the utility that owns them. Excluded from the GATHERING only:
		/// each still appears in the menu the game files it under.
		/// </remarks>
		private static readonly HashSet<string> NotGathered = new(StringComparer.OrdinalIgnoreCase)
		{
			nameof(PrefabSubCategory.Networks_Stops),
			nameof(PrefabSubCategory.Networks_Routes),
			nameof(PrefabSubCategory.Networks_Waterways),
			nameof(PrefabSubCategory.Networks_PowerLines),
			nameof(PrefabSubCategory.Networks_Pipes),
		};

		/// <summary>Whether the extension gathers this subcategory at all.</summary>
		public static bool IsGathered(string? subCategory) =>
			!NotGathered.Contains(subCategory?.Trim() ?? string.Empty);

		/// <summary>
		/// Whether this entry reaches the menu through the extension rather than
		/// through the game's own tree.
		/// </summary>
		public static bool IsExtraNetwork(string? entryCategory, string? entryMenu, string? menu, string? entrySubCategory = null) =>
			IsExtended(menu)
			&& string.Equals(entryCategory?.Trim(), NetworksCategory, StringComparison.OrdinalIgnoreCase)
			&& !VanillaMenus.IsRoads(entryMenu)
			&& !KeptByTheirMenu.Contains(entryMenu?.Trim() ?? string.Empty)
			// A bridge-type net no menu offers is part of a building or a bridge (Fishing Pier,
			// "LiftBridge03 Train Track"): the game never offers it alone, so Roads does not.
			&& !(string.IsNullOrWhiteSpace(entryMenu) && BridgeNets.IsBridgeType(entrySubCategory))
			&& IsGathered(entrySubCategory);

		/// <summary>
		/// Menus whose networks stay where the game files them, whatever their subcategory.
		/// </summary>
		/// <remarks>
		/// The hydroelectric dam is a bridge-type net placed from Electricity: it answers to the
		/// utility that owns it, as power lines and pipes do.
		/// </remarks>
		private static readonly HashSet<string> KeptByTheirMenu = new(StringComparer.OrdinalIgnoreCase)
		{
			"Electricity",
			"Water & Sewage",
		};

		/// <summary>
		/// The heading an extra network sits under: its subcategory, without the
		/// prefix that every one of them repeats.
		/// </summary>
		/// <remarks>
		/// "Networks_Waterways" becomes "Waterways", which the UI's own menuCategoryLabel splits
		/// into words. Deliberately not the entry's real UiCategory, which names where the game
		/// keeps it and would carry that menu's ordering into the middle of Roads.
		/// </remarks>
		public static string GroupId(string? subCategory)
		{
			var name = TabOf(subCategory);

			return name.StartsWith(SubCategoryPrefix, StringComparison.OrdinalIgnoreCase)
				? name.Substring(SubCategoryPrefix.Length)
				: name;
		}

		/// <summary>The subcategory whose tab a gathered network shares: its own, except a pier (a
		/// walkway on stilts), a bike or pedestrian bridge and a quay that is a path, which file with
		/// the paths. Each keeps its own subcategory, so a Type grouping still tells them apart there.</summary>
		public static string TabOf(string? subCategory)
		{
			var name = subCategory?.Trim() ?? string.Empty;

			return PathsTab.Contains(name) ? nameof(PrefabSubCategory.Networks_Paths) : name;
		}

		private static readonly HashSet<string> PathsTab = new(StringComparer.OrdinalIgnoreCase)
		{
			nameof(PrefabSubCategory.Networks_Piers),
			nameof(PrefabSubCategory.Networks_PathBridges),
			nameof(PrefabSubCategory.Networks_PathQuays),
		};

		/// <summary>
		/// The rank that keeps the extras in a stable order behind the roads.
		/// </summary>
		/// <remarks>
		/// Enum order, so the groups arrive in the sequence the subcategories are
		/// declared in rather than alphabetically — tracks and paths before power
		/// lines and pipes, which is roughly how often they are reached for.
		/// </remarks>
		public static int GroupPriority(string? subCategory) =>
			Enum.TryParse<PrefabSubCategory>(TabOf(subCategory), out var parsed)
				? ExtraGroupPriorityBase + (int)parsed
				: ExtraGroupPriorityBase;

		/// <summary>
		/// The category this entry answers to in this menu, which is its own
		/// except where the extension has given it another.
		/// </summary>
		/// <remarks>
		/// One function for two callers that must agree: the filter comparing a
		/// picked tab against an entry, and the projection that rewrites the
		/// entry for display. Two implementations would let a tab light up over a
		/// list it does not select.
		/// </remarks>
		public static string? EffectiveCategory(BuildingCatalogEntry entry, string? menu) =>
			IsExtraNetwork(entry.Category, entry.UiMenu, menu, entry.SubCategory)
				? TabIdOf(entry.SubCategory, entry.UiCategory)
				: entry.UiCategory;

		/// <summary>The Roads tab Transportation's Ship networks share: port roads and the port quay.</summary>
		public const string Ports = "Ports";

		/// <summary>The Roads tab for the bus category's roads: its public transport lanes.</summary>
		public const string TransitLanes = "TransitLanes";

		/// <summary>
		/// The tab a gathered network files under: Ports for what the game files under Transportation's
		/// Ship (port roads, the port quay), Transit lanes for the bus category's roads, else its
		/// subcategory's tab (<see cref="GroupId"/>).
		/// </summary>
		/// <remarks>By the game's own category, so the split follows where the game puts them: read in
		/// game, 2026-10-22, the port roads and the port quay sit in Transportation's Ship tab.</remarks>
		public static string TabIdOf(string? subCategory, string? uiCategory)
		{
			var category = uiCategory?.Trim() ?? string.Empty;

			if (string.Equals(category, ShipCategory, StringComparison.Ordinal))
			{
				return Ports;
			}

			if (string.Equals(category, BusCategory, StringComparison.Ordinal)
				&& string.Equals(subCategory?.Trim(), nameof(PrefabSubCategory.Networks_Roads), StringComparison.OrdinalIgnoreCase))
			{
				return TransitLanes;
			}

			return GroupId(subCategory);
		}

		/// <summary>The rank of a gathered network's tab: Ports with the quays, Transit lanes with the lanes.</summary>
		public static int TabPriorityOf(string? subCategory, string? uiCategory) =>
			TabIdOf(subCategory, uiCategory) switch
			{
				Ports => GroupPriority(nameof(PrefabSubCategory.Networks_Quays)),
				TransitLanes => GroupPriority(nameof(PrefabSubCategory.Networks_Lanes)),
				_ => GroupPriority(subCategory),
			};

		/// <summary>The icon of a gathered network's tab.</summary>
		public static string TabIconOf(string? subCategory, string? uiCategory) =>
			TabIdOf(subCategory, uiCategory) switch
			{
				Ports => "Media/Game/Icons/HarborRoad01.svg",
				TransitLanes => "Media/Game/Icons/DoublePublicTransportLane.svg",
				_ => Enum.TryParse<PrefabSubCategory>(TabOf(subCategory), out var owner)
					? CategoryIconAttribute.GetAttribute(owner).Icon ?? string.Empty
					: string.Empty,
			};

		private const string ShipCategory = "TransportationShip";
		private const string BusCategory = "TransportationRoad";

		/// <summary>
		/// The entry as this menu should show it.
		/// </summary>
		/// <remarks>
		/// Applied before ordering, not after paging, because the rewritten
		/// priority is what puts the extras behind the roads — reframing a page
		/// that had already been sorted would leave them interleaved with the
		/// vanilla categories and only relabelled.
		/// </remarks>
		public static BuildingCatalogEntry Reframe(BuildingCatalogEntry entry, string? menu)
		{
			if (!IsExtraNetwork(entry.Category, entry.UiMenu, menu, entry.SubCategory))
			{
				return entry;
			}

			return entry with
			{
				UiMenu = RoadsMenu,
				UiCategory = TabIdOf(entry.SubCategory, entry.UiCategory),
				UiCategoryPriority = TabPriorityOf(entry.SubCategory, entry.UiCategory),
				// Its tab is one of ours, ordered by the priority above; the position
				// it had in its own menu's strip means nothing here.
				UiCategoryTab = int.MaxValue,
			};
		}
	}
}
