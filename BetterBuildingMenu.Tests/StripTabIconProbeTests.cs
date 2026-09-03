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
		public void TabsSharingOneCategoryDoNotAllDrawItsGlyph()
		{
			// Healthcare's shape, which is where this was reported: several dev-tree
			// branches, none of them carrying an authored icon, all sitting in one
			// category — so every tab's fallback thumbnail is the SAME category
			// glyph. The strip drew Media/Game/Icons/Healthcare.svg four times over
			// and the tabs could not be told apart.
			//
			// Deathcare is here to keep the check honest: it is a second category
			// whose single tab should keep its own glyph, so a fix that simply
			// stopped using glyphs would fail this too.
			var fixture = new[]
			{
				E(1, "Medical Clinic", "ServiceBuildings", "HealthcareHealthcare", "Basic Healthcare", 0, "thumbnail://MedicalClinic01?width=128", "Media/Game/Icons/Healthcare.svg"),
				E(2, "Hospital", "ServiceBuildings", "HealthcareHealthcare", "Hospitals", 1, "thumbnail://Hospital01?width=128", "Media/Game/Icons/Healthcare.svg"),
				E(3, "Clinic Wing", "ServiceBuildings", "HealthcareHealthcare", "Treatment", 2, "thumbnail://ClinicWing01?width=128", "Media/Game/Icons/Healthcare.svg"),
				E(4, "Ambulance Depot", "ServiceBuildings", "HealthcareHealthcare", "Emergency", 3, "thumbnail://AmbulanceDepot01?width=128", "Media/Game/Icons/Healthcare.svg"),
				E(5, "Cemetery", "ServiceBuildings", "HealthcareDeathcare", "Deathcare", 4, "thumbnail://Cemetery01?width=128", "Media/Game/Icons/Deathcare.svg"),
			};
			var view = new CatalogView(fixture, new BuildingCatalogQuery(UiMenu: "Roads"));

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
			// icon. Two branches the dev tree genuinely gives one mark keep it:
			// that mark is what the player already associates with the unlock, and
			// replacing it with two asset renders would be the cm-2xvs.17 bug back.
			var fixture = new[]
			{
				E(1, "Tram Depot", "ServiceBuildings", "TransportTram", "Tram", 0, "thumbnail://TramDepot01?width=128", "Media/Game/Icons/Transportation.svg")
					with { DevTreeBranchIcon = "Media/Game/Icons/Tram.svg" },
				E(2, "Tram Stop", "ServiceBuildings", "TransportTram", "Tram Stops", 1, "thumbnail://TramStop01?width=128", "Media/Game/Icons/Transportation.svg")
					with { DevTreeBranchIcon = "Media/Game/Icons/Tram.svg" },
			};
			var view = new CatalogView(fixture, new BuildingCatalogQuery(UiMenu: "Roads"));

			Assert.All(view.StripTabs, tab => Assert.Equal("Media/Game/Icons/Tram.svg", tab.Icon));
		}

		[Fact]
		public void TwoBranchesSharingOneCategoryGlyphGetTheirOwnPictures()
		{
			// Roads: several categories, one of them (Parking) with two branches,
			// so the strip axis is the development tree via the expanded category.
			//
			// This test used to assert the opposite — that both parking branches
			// draw Media/Game/Icons/Parking.svg — which is what cm-2xvs.17 chose
			// when it stopped a lone iconless branch falling to a photographic
			// asset render sitting in a row of flat glyphs.
			//
			// SUPERSEDED, deliberately. That rule answers with the CATEGORY's mark,
			// so every tab sharing a category draws one picture: Healthcare's strip
			// rendered Healthcare.svg four times and the tabs could not be told
			// apart at all. Between a row that looks tidy and a row you can read,
			// the row you can read wins — a render still says WHICH tab this is.
			//
			// The glyph is kept wherever it distinguishes: Basic and Highways below
			// share Roads.svg and have no thumbnail to fall to, so they keep it.
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
