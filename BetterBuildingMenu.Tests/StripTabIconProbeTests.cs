using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class StripTabIconProbeTests
	{
		private static BuildingCatalogEntry E(int id, string name, string category, string uiCategory, string branch, int depth, string? thumb, string? fallback, int priority = 0) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: name, Name: name, Category: category, SubCategory: category + "_Roads",
				Thumbnail: thumb ?? "", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsUniqueMesh: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = "Roads", UiCategory = uiCategory, DevTreeBranch = branch, DevTreeBranchDepth = depth, FallbackThumbnail = fallback, UiCategoryPriority = priority };

		[Fact]
		public void RoadsShapedMenuGivesAParkingBranchItsGlyph()
		{
			// Roads: several categories, one of them (Parking) with two branches,
			// so the strip axis is the development tree via the expanded category.
			var fixture = new[]
			{
				E(1, "Alley", "Networks", "RoadsSmallRoads", "Basic", 0, null, "Media/Game/Icons/Roads.svg"),
				E(2, "Highway", "Networks", "RoadsHighways", "Highways", 1, null, "Media/Game/Icons/Roads.svg"),
				E(3, "Parking Hall", "ServiceBuildings", "RoadsParking", "Underground Parking", 2, "thumbnail://ParkingHall02?width=128", "Media/Game/Icons/Parking.svg"),
				E(4, "Parking Lot", "ServiceBuildings", "RoadsParking", "Parking Lots", 1, "thumbnail://ParkingLot01?width=128", "Media/Game/Icons/Parking.svg"),
			};
			var view = new CatalogView(fixture, new BuildingCatalogQuery(UiMenu: "Roads"));

			Assert.Equal("development", view.StripAxis);
			var tab = view.StripTabs.Single(t => t.Id == "Underground Parking");
			Assert.Equal("Media/Game/Icons/Parking.svg", tab.Icon);
			var expanded = view.ExpandedCategories.Single(c => c.CategoryId == "RoadsParking");
			Assert.Equal("Media/Game/Icons/Parking.svg", expanded.Tabs.Single(t => t.Id == "Underground Parking").Icon);
		}
	}
}
