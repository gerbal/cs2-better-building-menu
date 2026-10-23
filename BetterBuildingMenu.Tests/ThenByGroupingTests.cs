using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The second grouping the player picks beside the first: None drops it, and a dimension
	/// splits each first-level group by its own. Each menu has a default, and keeps its own pick.
	/// </summary>
	public sealed class ThenByGroupingTests
	{
		private static readonly string[] Milestones = { "", "A", "B", "", "", "", "", "", "", "Metropolis" };

		private static BuildingCatalogEntry Signature() =>
			TestEntries.Make(1, "Vesuvius Place", subCategory: "ServiceBuildings_Signatures", zoneType: ZoneTypeFilter.Signature) with
			{
				UiMenu = "Signatures",
				UiCategory = "SignaturesResidential",
				UnlockMilestone = 9,
				BuildingType = "Hospital",
				Theme = "European",
			};

		[Fact]
		public void NoSecondChoiceLeavesTheFirstUnchanged()
		{
			var entry = Signature();

			Assert.Equal(
				BuildingCatalogGrouping.Find("menuCategory").Labels(entry, Milestones).Path,
				BuildingCatalogGrouping.Find("menuCategory", "").Labels(entry, Milestones).Path);
			Assert.Equal(
				BuildingCatalogGrouping.Find("menuCategory").SecondaryKey(entry),
				BuildingCatalogGrouping.Find("menuCategory", "  ").SecondaryKey(entry));
		}

		[Fact]
		public void NoneKeepsOnlyTheFirstChoicesOuterHeadingAndItsLabelId()
		{
			var entry = Signature();
			var auto = BuildingCatalogGrouping.Find("menuCategory").Labels(entry, Milestones);
			var none = BuildingCatalogGrouping.Find("menuCategory", "none");

			Assert.Equal(new[] { auto.Path[0] }, none.Labels(entry, Milestones).Path);
			Assert.Equal(auto.LabelId, none.Labels(entry, Milestones).LabelId);
			Assert.Equal(string.Empty, none.SecondaryKey(entry));
			Assert.True(none.IsGrouped);
		}

		[Fact]
		public void ADimensionSplitsEachFirstLevelGroupByItsOwnHeadingAndKey()
		{
			var entry = Signature();
			var composed = BuildingCatalogGrouping.Find("menuCategory", "theme");

			Assert.Equal(
				new[] { BuildingCatalogGrouping.Find("menuCategory").Labels(entry, Milestones).Path[0], "European" },
				composed.Labels(entry, Milestones).Path);
			Assert.Equal(BuildingCatalogGrouping.Find("menuCategory").PrimaryKey(entry), composed.PrimaryKey(entry));
			Assert.Equal(BuildingCatalogGrouping.Find("theme").PrimaryKey(entry), composed.SecondaryKey(entry));
		}

		[Fact]
		public void AOneLevelFirstChoiceGainsASecondLevel()
		{
			var path = BuildingCatalogGrouping.Find("theme", "progression").Labels(Signature(), Milestones).Path;

			Assert.Equal(new[] { "European", "Metropolis" }, path);
		}

		[Fact]
		public void NothingGroupsWhenTheFirstChoiceIsNone()
		{
			Assert.False(BuildingCatalogGrouping.Find("none", "theme").IsGrouped);
		}

		[Fact]
		public void TheDefaultIsTheDrawnKindMostBuildingsFileUnder()
		{
			var signature = Signature();
			var later = signature with { Id = 2, UnlockMilestone = 1 };

			// Two milestones under one category: both sub-headings draw.
			Assert.Equal("progression", BuildingCatalogGrouping.DefaultThenBy("menuCategory", new[] { signature, later }, Milestones));
			// One milestone: a level of one group draws no heading, so the default adds nothing.
			Assert.Equal("none", BuildingCatalogGrouping.DefaultThenBy("menuCategory", new[] { signature, signature with { Id = 2 } }, Milestones));

			// Roads: a branch named as its category repeats the heading and is dropped, so the
			// differently named branch (Grand Bridge) is what the player sees.
			var road = TestEntries.Make(3, "Avenue") with { UiMenu = "Roads", UiCategory = "RoadsMediumRoads" };
			var parentLabel = BuildingCatalogGrouping.Find("menuCategory").Labels(road).Path[0];
			var avenue = road with { DevTreeBranch = parentLabel };
			var bridge = road with { Id = 4, Name = "Grand Bridge", DevTreeBranch = "Grand Bridge" };
			Assert.Equal("development", BuildingCatalogGrouping.DefaultThenBy("menuCategory", new[] { avenue, bridge }));
			Assert.Equal("none", BuildingCatalogGrouping.DefaultThenBy("menuCategory", new[] { avenue }));

			// A service menu with branches and milestones: the kind more buildings draw under.
			var hospital = TestEntries.Make(7, "Hospital") with { UiMenu = "Health & Deathcare", UiCategory = "HealthcareHealth", DevTreeBranch = "Hospital" };
			var clinic = hospital with { Id = 8, DevTreeBranch = "Clinic" };
			var lab = hospital with { Id = 9, DevTreeBranch = null, UnlockMilestone = 3 };
			Assert.Equal("development", BuildingCatalogGrouping.DefaultThenBy("menuCategory", new[] { hospital, clinic, lab }, Milestones));

			Assert.Equal("subCategory", BuildingCatalogGrouping.DefaultThenBy("category", new[] { signature, signature with { Id = 6, SubCategory = "ServiceBuildings_Health", SubCategoryLabel = "Health" } }));
			Assert.Equal("none", BuildingCatalogGrouping.DefaultThenBy("category", new[] { signature }));
			Assert.Equal("none", BuildingCatalogGrouping.DefaultThenBy("theme", new[] { signature, later }));
		}

		[Fact]
		public void TheSecondLevelIsThePicksWhereTheMenuOffersItElseTheMenusDefault()
		{
			var offered = new[] { "menuCategory", "theme", "progression", "none" };

			Assert.Equal("theme", BuildingCatalogGrouping.EffectiveThenBy("theme", "menuCategory", offered, "progression"));
			Assert.Equal("none", BuildingCatalogGrouping.EffectiveThenBy("none", "menuCategory", offered, "progression"));
			// Not offered here, the first choice itself, or no pick: the menu's default.
			Assert.Equal("progression", BuildingCatalogGrouping.EffectiveThenBy("density", "menuCategory", offered, "progression"));
			Assert.Equal("progression", BuildingCatalogGrouping.EffectiveThenBy("menuCategory", "menuCategory", offered, "progression"));
			Assert.Equal("progression", BuildingCatalogGrouping.EffectiveThenBy("", "menuCategory", offered, "progression"));
			// Nothing grouped first: nothing to split.
			Assert.Equal("none", BuildingCatalogGrouping.EffectiveThenBy("theme", "none", offered, "progression"));
		}

		[Fact]
		public void RoleHeadsTransitTracksByTheirWayNotOther()
		{
			var track = TestEntries.Make(10, "Train Track", subCategory: "Networks_Tracks") with
			{
				UiMenu = "Transportation",
				UiCategory = "TransportationTrain",
				SubCategoryLabel = "Tracks",
			};
			var station = track with { Id = 11, SubCategory = "ServiceBuildings_Transportation", SubCategoryLabel = "Transportation", BuildingType = TransitRole.Station };

			Assert.Equal(new[] { "Tracks" }, BuildingCatalogGrouping.Find("role").Labels(track).Path);
			Assert.Equal(new[] { "Stations" }, BuildingCatalogGrouping.Find("role").Labels(station).Path);
			// Tracks lead, as the transit split orders them.
			Assert.True(string.CompareOrdinal(
				BuildingCatalogGrouping.Find("role").PrimaryKey(track),
				BuildingCatalogGrouping.Find("role").PrimaryKey(station)) < 0);
		}

		[Fact]
		public void EachMenuRemembersItsOwnSecondPick()
		{
			var roads = AssetMenuState.Initial.SelectMenu("Roads").SetThenBy(" theme ");
			Assert.Equal("theme", roads.Query.ThenBy);
			Assert.Same(roads, roads.SetThenBy("theme"));

			var zones = roads.SelectMenu("Zones");
			Assert.Equal(string.Empty, zones.Query.ThenBy);

			var back = zones.SetThenBy("progression").SelectMenu("Roads");
			Assert.Equal("theme", back.Query.ThenBy);
			Assert.Equal("progression", back.SelectMenu("Zones").Query.ThenBy);

			// The first pick moving does not drop it; Reset menu forgets this menu's only.
			Assert.Equal("theme", back.SetGroupBy("theme").Query.ThenBy);
			var reset = back.ResetMenu();
			Assert.Equal(string.Empty, reset.Query.ThenBy);
			Assert.Equal("progression", reset.SelectMenu("Zones").Query.ThenBy);
		}

		[Fact]
		public void TypeGroupsReadInTheSubcategoriesOrderSoRoadsLead()
		{
			var road = TestEntries.Make(20, "Avenue", category: "Networks", subCategory: "Networks_Roads");
			var bridge = road with { Id = 21, SubCategory = "Networks_Bridges" };
			var quay = road with { Id = 22, SubCategory = "Networks_Quays" };
			var key = BuildingCatalogGrouping.Find("subCategory");

			Assert.True(string.CompareOrdinal(key.PrimaryKey(road), key.PrimaryKey(bridge)) < 0);
			Assert.True(string.CompareOrdinal(key.PrimaryKey(bridge), key.PrimaryKey(quay)) < 0);
		}

		[Fact]
		public void RoadsDefaultsToTypeWhereItSplitsAnything()
		{
			var road = TestEntries.Make(30, "Avenue", category: "Networks", subCategory: "Networks_Roads") with { UiMenu = "Roads", UiCategory = "RoadsMediumRoads" };
			var bridge = road with { Id = 31, SubCategory = "Networks_Bridges", DevTreeBranch = "Grand Bridge" };

			var view = new BetterBuildingMenu.Services.CatalogView(new[] { road, bridge }, new BuildingCatalogQuery(UiMenu: "Roads", GroupBy: "menuCategory"));
			Assert.Equal("subCategory", view.EffectiveThenBy);

			// One type only: Type would draw nothing, so the usual default applies.
			var single = new BetterBuildingMenu.Services.CatalogView(new[] { road, road with { Id = 32, DevTreeBranch = "Grand Bridge" } }, new BuildingCatalogQuery(UiMenu: "Roads", GroupBy: "menuCategory"));
			Assert.NotEqual("subCategory", single.EffectiveThenBy);
		}
	}
}
