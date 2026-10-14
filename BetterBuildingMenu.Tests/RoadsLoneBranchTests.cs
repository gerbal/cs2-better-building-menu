using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// A Roads development branch holding one building, folded into its category; and
	/// Roads' strip, which splits no category into branch chips.
	/// </summary>
	/// <remarks>
	/// Parking's Parking Hall and Automated Parking Building are each a branch of one;
	/// unfolded, Parking would group each single building on its own.
	/// </remarks>
	public class RoadsLoneBranchTests
	{
		private static readonly BuildingCatalogEntry Base = new(
			Id: 0,
			PrefabName: "Base",
			Name: "Base",
			Category: "Buildings",
			SubCategory: "Any",
			Thumbnail: "",
			LotWidth: 1,
			LotDepth: 1,
			BuildingLevel: 1,
			ZoneType: ZoneTypeFilter.Any,
			HasParking: false,
			IsVanilla: true,
			PdxModsId: "");

		private static BuildingCatalogEntry Entry(int id, string category, string branch, int depth, string icon, string menu = VanillaMenus.Roads) =>
			Base with
			{
				Id = id,
				PrefabName = $"Prefab{id}",
				Name = $"Building {id}",
				UiMenu = menu,
				UiCategory = category,
				DevTreeBranch = branch,
				DevTreeBranchDepth = depth,
				DevTreeBranchIcon = icon,
			};

		private static BuildingCatalogEntry[] Parking() => new[]
		{
			Entry(1, "RoadsParking", "Parking Areas", 1, "lots.svg"),
			Entry(2, "RoadsParking", "Parking Hall", 2, "hall.svg"),
			Entry(3, "RoadsParking", "Parking Areas", 1, "lots.svg"),
			Entry(4, "RoadsParking", "Automated Parking", 3, "auto.svg"),
			Entry(5, "RoadsParking", "Parking Areas", 1, "lots.svg"),
		};

		[Fact]
		public void FoldsAOneBuildingBranchIntoItsCategorysLargestBranch()
		{
			var folded = RoadsLoneBranches.Fold(Parking(), VanillaMenus.Roads);

			Assert.Equal(new[] { 1, 2, 3, 4, 5 }, folded.Select(entry => entry.Id));
			Assert.All(folded, entry =>
			{
				Assert.Equal("Parking Areas", entry.DevTreeBranch);
				Assert.Equal(1, entry.DevTreeBranchDepth);
				Assert.Equal("lots.svg", entry.DevTreeBranchIcon);
			});
		}

		[Fact]
		public void SplitsNoRoadsCategoryIntoBranchChips()
		{
			// A split Cul-de-Sacs draws as a generic road and a second roundabout beside
			// Roundabouts, in place of its own icon.
			var entries = new[]
			{
				Entry(1, "CulDeSacs", "Cul-De-Sacs", 1, "roads.svg"),
				Entry(2, "CulDeSacs", "Cul-De-Sacs", 1, "roads.svg"),
				Entry(3, "CulDeSacs", "Roundabouts", 2, "roundabout.svg"),
				Entry(4, "CulDeSacs", "Roundabouts", 2, "roundabout.svg"),
				Entry(5, "RoadsSmallRoads", "Small Roads", 1, "small.svg"),
			};

			var view = new CatalogView(entries, new BuildingCatalogQuery(UiMenu: VanillaMenus.Roads));

			Assert.Equal(string.Empty, view.ExpandedCategoryId);
			Assert.Empty(view.ExpandedCategories);
		}

		[Fact]
		public void StillSplitsAnotherMenusCategoryIntoBranchChips()
		{
			const string health = "Health & Deathcare";
			var entries = new[]
			{
				Entry(1, "HealthcareHospital", "Hospital", 1, "h.svg", health),
				Entry(2, "HealthcareHospital", "Clinic", 2, "c.svg", health),
				Entry(3, "HealthcareDeathcare", "Cemetery", 1, "d.svg", health),
			};

			Assert.Equal("HealthcareHospital", new CatalogView(entries, new BuildingCatalogQuery(UiMenu: health)).ExpandedCategoryId);
		}

		[Fact]
		public void LeavesABranchOfTwoAlone()
		{
			var entries = Parking().Append(Entry(6, "RoadsParking", "Parking Hall", 2, "hall.svg")).ToArray();

			var folded = RoadsLoneBranches.Fold(entries, VanillaMenus.Roads);

			Assert.Equal(new[] { 2, 6 }, folded.Where(entry => entry.DevTreeBranch == "Parking Hall").Select(entry => entry.Id));
			Assert.Equal("Parking Areas", folded.Single(entry => entry.Id == 4).DevTreeBranch);
		}

		[Fact]
		public void LeavesACategorysOnlyBranchAloneHoweverSmall()
		{
			var entries = new[] { Entry(1, "RoadsServices", "Road Services", 1, "services.svg") };

			Assert.Same(entries[0], RoadsLoneBranches.Fold(entries, VanillaMenus.Roads).Single());
		}

		[Fact]
		public void LeavesEntriesWithNoBranchAlone()
		{
			var bare = Entry(9, "RoadsParking", "", 0, "");
			var entries = Parking().Append(bare).ToArray();

			Assert.Same(bare, RoadsLoneBranches.Fold(entries, VanillaMenus.Roads).Single(entry => entry.Id == 9));
		}

		[Fact]
		public void LeavesEveryOtherMenuAlone()
		{
			const string health = "Health & Deathcare";
			var entries = new[]
			{
				Entry(1, "HealthcareHospital", "Hospital", 1, "h.svg", health),
				Entry(2, "HealthcareHospital", "Hospital", 1, "h.svg", health),
				Entry(3, "HealthcareHospital", "Disease Control Center", 2, "d.svg", health),
			};

			Assert.Equal(entries, RoadsLoneBranches.Fold(entries, health));
		}
	}
}
