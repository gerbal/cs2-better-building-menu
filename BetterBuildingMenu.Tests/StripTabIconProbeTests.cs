using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class StripTabIconProbeTests
	{
		// Any menu but Roads, which draws no branch chips at all.
		private const string Menu = "Services";

		private static BuildingCatalogEntry E(int id, string name, string category, string uiCategory, string branch, int depth, string? thumb, string? fallback, int priority = 0) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: name, Name: name, Category: category, SubCategory: category + "_Roads",
				Thumbnail: thumb ?? "", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = Menu, UiCategory = uiCategory, DevTreeBranch = branch, DevTreeBranchDepth = depth, FallbackThumbnail = fallback, UiCategoryPriority = priority };

		[Fact]
		public void TabsSharingOneCategoryDoNotAllDrawItsGlyph()
		{
			// Healthcare's shape: several dev-tree branches in one category, none with
			// an authored icon, so every tab's fallback is the SAME category glyph.
			// Deathcare is a second category whose lone tab keeps its own glyph.
			var fixture = new[]
			{
				E(1, "Medical Clinic", "ServiceBuildings", "HealthcareHealthcare", "Basic Healthcare", 0, "thumbnail://MedicalClinic01?width=128", "Media/Game/Icons/Healthcare.svg"),
				E(2, "Hospital", "ServiceBuildings", "HealthcareHealthcare", "Hospitals", 1, "thumbnail://Hospital01?width=128", "Media/Game/Icons/Healthcare.svg"),
				E(3, "Clinic Wing", "ServiceBuildings", "HealthcareHealthcare", "Treatment", 2, "thumbnail://ClinicWing01?width=128", "Media/Game/Icons/Healthcare.svg"),
				E(4, "Ambulance Depot", "ServiceBuildings", "HealthcareHealthcare", "Emergency", 3, "thumbnail://AmbulanceDepot01?width=128", "Media/Game/Icons/Healthcare.svg"),
				E(5, "Cemetery", "ServiceBuildings", "HealthcareDeathcare", "Deathcare", 4, "thumbnail://Cemetery01?width=128", "Media/Game/Icons/Deathcare.svg"),
			};
			var view = new CatalogView(fixture, new BuildingCatalogQuery(UiMenu: Menu));

			var icons = view.StripTabs.Select(tab => tab.Icon).ToArray();

			Assert.Equal(icons.Length, icons.Distinct().Count());
			Assert.DoesNotContain(
				icons.GroupBy(icon => icon).Select(group => group.Count()),
				count => count > 1);
		}

		[Fact]
		public void ABranchIconSharedByTwoBranchesIsKept()
		{
			// The disambiguation switches off the CATEGORY glyph, not the authored
			// icon: two branches the dev tree gives one mark keep it, because that
			// mark is what the player associates with the unlock.
			var fixture = new[]
			{
				E(1, "Tram Depot", "ServiceBuildings", "TransportTram", "Tram", 0, "thumbnail://TramDepot01?width=128", "Media/Game/Icons/Transportation.svg")
					with { DevTreeBranchIcon = "Media/Game/Icons/Tram.svg" },
				E(2, "Tram Stop", "ServiceBuildings", "TransportTram", "Tram Stops", 1, "thumbnail://TramStop01?width=128", "Media/Game/Icons/Transportation.svg")
					with { DevTreeBranchIcon = "Media/Game/Icons/Tram.svg" },
			};
			var view = new CatalogView(fixture, new BuildingCatalogQuery(UiMenu: Menu));

			Assert.All(view.StripTabs, tab => Assert.Equal("Media/Game/Icons/Tram.svg", tab.Icon));
		}

		[Fact]
		public void TwoBranchesSharingOneCategoryGlyphGetTheirOwnPictures()
		{
			// Several categories, one (Parking) with two branches, so the strip axis
			// is the development tree. A glyph two tabs would share gives way to
			// asset renders that say which tab is which; alone, it distinguishes.
			var fixture = new[]
			{
				E(1, "Alley", "Networks", "RoadsSmallRoads", "Basic", 0, null, "Media/Game/Icons/Roads.svg"),
				E(2, "Highway", "Networks", "RoadsHighways", "Highways", 1, null, "Media/Game/Icons/Roads.svg"),
				E(3, "Parking Hall", "ServiceBuildings", "RoadsParking", "Underground Parking", 2, "thumbnail://ParkingHall02?width=128", "Media/Game/Icons/Parking.svg"),
				E(4, "Parking Lot", "ServiceBuildings", "RoadsParking", "Parking Lots", 1, "thumbnail://ParkingLot01?width=128", "Media/Game/Icons/Parking.svg"),
			};
			var view = new CatalogView(fixture, new BuildingCatalogQuery(UiMenu: Menu));

			Assert.Equal("development", view.StripAxis);

			var tab = view.StripTabs.Single(t => t.Id == "Underground Parking");
			Assert.Equal("thumbnail://ParkingHall02?width=128", tab.Icon);
			Assert.Equal(
				"thumbnail://ParkingLot01?width=128",
				view.StripTabs.Single(t => t.Id == "Parking Lots").Icon);

			// Nothing better to fall to, so the shared glyph stays rather than
			// leaving these two tabs with no picture at all.
			Assert.Equal("Media/Game/Icons/Roads.svg", view.StripTabs.Single(t => t.Id == "Basic").Icon);

			var expanded = view.ExpandedCategories.Single(c => c.CategoryId == "RoadsParking");
			Assert.Equal(
				"thumbnail://ParkingHall02?width=128",
				expanded.Tabs.Single(t => t.Id == "Underground Parking").Icon);
		}
	}
}
