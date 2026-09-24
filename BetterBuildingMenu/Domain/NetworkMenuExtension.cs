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
	/// which service that is. This is the one place the lens deliberately shows more than the
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
		public static bool IsExtended(string? menu) =>
			string.Equals(menu?.Trim(), RoadsMenu, StringComparison.OrdinalIgnoreCase);

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
			&& !string.Equals(entryMenu?.Trim(), RoadsMenu, StringComparison.OrdinalIgnoreCase)
			&& IsGathered(entrySubCategory);

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
			var name = subCategory?.Trim() ?? string.Empty;

			return name.StartsWith(SubCategoryPrefix, StringComparison.OrdinalIgnoreCase)
				? name.Substring(SubCategoryPrefix.Length)
				: name;
		}

		/// <summary>
		/// The rank that keeps the extras in a stable order behind the roads.
		/// </summary>
		/// <remarks>
		/// Enum order, so the groups arrive in the sequence the subcategories are
		/// declared in rather than alphabetically — tracks and paths before power
		/// lines and pipes, which is roughly how often they are reached for.
		/// </remarks>
		public static int GroupPriority(string? subCategory) =>
			Enum.TryParse<PrefabSubCategory>(subCategory?.Trim(), out var parsed)
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
				? GroupId(entry.SubCategory)
				: entry.UiCategory;

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
				UiCategory = GroupId(entry.SubCategory),
				UiCategoryPriority = GroupPriority(entry.SubCategory),
				// Its tab is one of ours, ordered by the priority above; the position
				// it had in its own menu's strip means nothing here.
				UiCategoryTab = int.MaxValue,
			};
		}
	}
}
