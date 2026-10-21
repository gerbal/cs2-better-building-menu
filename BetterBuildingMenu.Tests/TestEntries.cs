using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Catalog entries for tests, built the way the indexer builds them.</summary>
	internal static class TestEntries
	{
		/// <summary>
		/// An entry through the record's constructor, so its search folds run; set anything else with
		/// <c>with</c>. The prefab name defaults to the display name.
		/// </summary>
		public static BuildingCatalogEntry Make(
			int id = 1,
			string name = "Building",
			string? prefabName = null,
			string category = "ServiceBuildings",
			string subCategory = "Any",
			int lotWidth = 1,
			int lotDepth = 1,
			int buildingLevel = 1,
			ZoneTypeFilter zoneType = ZoneTypeFilter.Any,
			bool hasParking = false,
			string thumbnail = "",
			string pdxModsId = "") =>
			new(
				Id: id,
				PrefabName: prefabName ?? name,
				Name: name,
				Category: category,
				SubCategory: subCategory,
				Thumbnail: thumbnail,
				LotWidth: lotWidth,
				LotDepth: lotDepth,
				BuildingLevel: buildingLevel,
				ZoneType: zoneType,
				HasParking: hasParking,
				IsVanilla: true,
				PdxModsId: pdxModsId);
	}
}
