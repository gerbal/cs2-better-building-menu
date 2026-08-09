using Unity.Entities;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// Where the vanilla build menu puts one asset.
	/// </summary>
	/// <remarks>
	/// The game's own answer to "can the player reach this, and where", read off
	/// the UIGroupElement tree rather than reconstructed from our categories.
	/// <see cref="Menu"/> and <see cref="Category"/> are prefab names, the same
	/// strings <c>PrefabIndex.UiMenuName</c> and <c>UiCategoryName</c> carry, so
	/// the two can be compared without translating either.
	/// </remarks>
	public readonly record struct VanillaMenuPlacement(Entity Entity, string Menu, string Category);
}
