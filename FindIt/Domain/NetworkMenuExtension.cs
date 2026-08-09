using System;


using FindItBuildingMenu.Domain.Enums;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Makes the Roads menu the menu for every network, not just the ones the
	/// game files under Roads.
	/// </summary>
	/// <remarks>
	/// Vanilla scatters its networks by what they carry rather than by what they
	/// are. Roads holds roads, highways, intersections and road services;
	/// pedestrian paths, tram and train track, seaways, power lines and pipes
	/// each live in the menu of the service they belong to, so building a
	/// network means knowing which service owns it before you can find it.
	///
	/// This is the one place the lens deliberately shows more than vanilla does.
	/// Everything else about menu scope is a faithful reproduction of the game's
	/// own tree — see BuildingCatalogQueryEngine and IndexVanillaMenuPlacements —
	/// and this rule sits beside that on purpose: it is a stated addition rather
	/// than a drift, and it is confined to one menu.
	///
	/// Roads stays first. The extras are ranked past every vanilla category by a
	/// base far above any priority the game assigns, so the menu opens on Small
	/// Roads exactly as it did and the exotic networks follow in a stable order.
	///
	/// The extras are NOT removed from the menus that already hold them. A player
	/// who reaches for tram track under Transportation still finds it there; this
	/// adds a second way in, it does not move anything.
	/// </remarks>
	public static class NetworkMenuExtension
	{
		/// <summary>The menu that carries every network.</summary>
		public const string RoadsMenu = "Roads";

		/// <summary>The value <c>BuildingCatalogEntry.Category</c> holds for a network.</summary>
		private const string NetworksCategory = nameof(PrefabCategory.Networks);

		/// <summary>The prefix every network subcategory's name carries.</summary>
		private const string SubCategoryPrefix = nameof(PrefabCategory.Networks) + "_";

		/// <summary>
		/// Where the extra groups start, above anything the game will assign.
		/// </summary>
		/// <remarks>
		/// Vanilla category priorities are small integers — the Roads menu's nine
		/// run in the tens — so a million is not a tuned number, it is a number
		/// nothing can reach. MenuCategoryRank widens to long before padding, so
		/// the size costs nothing.
		/// </remarks>
		public const int ExtraGroupPriorityBase = 1_000_000;

		/// <summary>Whether this menu is the one that gathers every network.</summary>
		public static bool IsExtended(string? menu) =>
			string.Equals(menu?.Trim(), RoadsMenu, StringComparison.OrdinalIgnoreCase);

		/// <summary>
		/// Whether this entry reaches the menu through the extension rather than
		/// through the game's own tree.
		/// </summary>
		public static bool IsExtraNetwork(string? entryCategory, string? entryMenu, string? menu) =>
			IsExtended(menu)
			&& string.Equals(entryCategory?.Trim(), NetworksCategory, StringComparison.OrdinalIgnoreCase)
			&& !string.Equals(entryMenu?.Trim(), RoadsMenu, StringComparison.OrdinalIgnoreCase);

		/// <summary>
		/// The heading an extra network sits under: its subcategory, without the
		/// prefix that every one of them repeats.
		/// </summary>
		/// <remarks>
		/// "Networks_Waterways" becomes "Waterways", which the UI's own
		/// menuCategoryLabel then splits into words — so "Networks_PowerLines"
		/// reads "Power Lines" without a table mapping one to the other.
		///
		/// Deliberately not the entry's real UiCategory. A seaway's is
		/// "TransportationShip": right about where the game keeps it, and useless
		/// as a heading in a menu about networks, where it would also carry the
		/// Transportation menu's ordering into the middle of Roads.
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
			IsExtraNetwork(entry.Category, entry.UiMenu, menu)
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
			if (!IsExtraNetwork(entry.Category, entry.UiMenu, menu))
			{
				return entry;
			}

			return entry with
			{
				UiMenu = RoadsMenu,
				UiCategory = GroupId(entry.SubCategory),
				UiCategoryPriority = GroupPriority(entry.SubCategory),
			};
		}
	}
}
