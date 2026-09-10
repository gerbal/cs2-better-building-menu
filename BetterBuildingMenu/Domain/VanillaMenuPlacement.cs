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
	/// </remarks>
	public readonly record struct VanillaMenuPlacement(Entity Entity, string Menu, string Category);
}
