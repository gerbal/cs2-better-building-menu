using Unity.Entities;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// Where the vanilla build menu puts one asset.
	/// </summary>
	/// <remarks>
	/// The game's own answer to "can the player reach this, and where", read off the
	/// UIGroupElement tree. <see cref="Menu"/> and <see cref="Category"/> are prefab
	/// names, the strings <c>PrefabIndex.UiMenuName</c> and <c>UiCategoryName</c> carry.
	/// <see cref="CategoryPriority"/> is the category's <c>UIObjectData.m_Priority</c>, the number
	/// the strip ranks its tab by, so an asset a mod moved here can rank with the tab's own assets
	/// rather than with the group it came from.
	/// </remarks>
	public readonly record struct VanillaMenuPlacement(Entity Entity, string Menu, string Category, int CategoryPriority);
}
