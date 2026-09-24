using System;
using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class BuildingCatalogGroupingTests
	{
		private static BuildingCatalogEntry Entry(
			int id,
			string category = "ServiceBuildings",
			string subCategory = "Health",
			string name = "Thing",
			double? cost = 10_000,
			int width = 4,
			int depth = 4,
			string buildingType = "Hospital",
			string theme = "European",
			string provenance = "BaseGame",
			string dlcId = "") =>
			new BuildingCatalogEntry(
				Id: id,
				PrefabName: name,
				Name: name,
				Category: category,
				SubCategory: subCategory,
				Thumbnail: "",
				LotWidth: width,
				LotDepth: depth,
				BuildingLevel: 1,
				ZoneType: 0,
				HasParking: false,
				IsVanilla: true,
				PdxModsId: "",
				BuildingType: buildingType,
				Provenance: provenance,
				DlcId: dlcId,
				Theme: theme,
				ConstructionCost: cost);

		[Fact]
		public void GroupsAreContiguousAcrossTheWholeResult()
		{
			// The one property the ordering has to guarantee. If members of a
			// group are not adjacent, a page boundary lands mid-group and the
			// heading describes something other than what follows it.
			var source = new[]
			{
				Entry(1, subCategory: "Health", name: "A"),
				Entry(2, subCategory: "Education", name: "B"),
				Entry(3, subCategory: "Health", name: "C"),
				Entry(4, subCategory: "Education", name: "D"),
				Entry(5, subCategory: "Police", name: "E"),
			};

			var page = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.SubCategory));

			var keys = page.Items.Select(entry => entry.SubCategory).ToArray();
			var runs = keys.Where((key, index) => index == 0 || key != keys[index - 1]).ToArray();

			Assert.Equal(runs.Length, runs.Distinct().Count());
		}

		[Fact]
		public void SortsWithinEachGroupByTheChosenColumn()
		{
			// Group by is a primary key; the player's sort still decides the
			// order inside each group.
			var source = new[]
			{
				Entry(1, subCategory: "Health", name: "Zebra"),
				Entry(2, subCategory: "Health", name: "Alpha"),
				Entry(3, subCategory: "Education", name: "Yak"),
				Entry(4, subCategory: "Education", name: "Bee"),
			};

			var page = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.SubCategory, SortColumn: "Name"));

			var names = page.Items.Select(entry => entry.Name).ToArray();

			Assert.Equal(new[] { "Bee", "Yak", "Alpha", "Zebra" }, names);
		}

		[Fact]
		public void LeavesTheOrderUntouchedWhenNothingIsGrouped()
		{
			// The seed is a constant in this case and OrderBy is stable, so the
			// sort behaves exactly as it does with no grouping at all.
			var source = new[]
			{
				Entry(1, subCategory: "Health", name: "Zebra"),
				Entry(2, subCategory: "Education", name: "Alpha"),
			};

			var grouped = BuildingCatalogQueryEngine.Query(source, new BuildingCatalogQuery(GroupBy: "none"));
			var ungrouped = BuildingCatalogQueryEngine.Query(source, new BuildingCatalogQuery());

			Assert.Equal(
				ungrouped.Items.Select(entry => entry.Id),
				grouped.Items.Select(entry => entry.Id));
			Assert.Equal(new[] { "Alpha", "Zebra" }, grouped.Items.Select(entry => entry.Name));
		}

		[Fact]
		public void CategoryGroupsByCategoryThenSubCategory()
		{
			Assert.Equal("ServiceBuildings", BuildingCatalogGrouping.PrimaryKey(Entry(1), BuildingCatalogGrouping.Category));
			Assert.Equal("Health", BuildingCatalogGrouping.SecondaryKey(Entry(1), BuildingCatalogGrouping.Category));
		}

		[Fact]
		public void OnlyTheTwoCategoryDimensionsHaveASecondLevel()
		{
			// Everything in this list is depth 1, and a stray secondary key would
			// silently split one of their groups.
			foreach (var dimension in new[]
			{
				BuildingCatalogGrouping.SubCategory,
				BuildingCatalogGrouping.Role,
				BuildingCatalogGrouping.SchoolTier,
				BuildingCatalogGrouping.Theme,
				BuildingCatalogGrouping.Source,
				BuildingCatalogGrouping.Cost,
				BuildingCatalogGrouping.Footprint,
			})
			{
				Assert.Equal(string.Empty, BuildingCatalogGrouping.SecondaryKey(Entry(1), dimension));
			}
		}

		[Fact]
		public void EveryDimensionProducesAKeyForAnEntryThatCarriesItsValue()
		{
			// The UI regroups whatever order it is handed, so a dimension that
			// emits no key orders nothing and fails silently. Only asking each
			// dimension directly catches one.
			var entry = Entry(1) with { UiCategory = "TransportationRoad", UiCategoryPriority = 20 };

			foreach (var dimension in new[]
			{
				BuildingCatalogGrouping.Category,
				BuildingCatalogGrouping.MenuCategory,
				BuildingCatalogGrouping.SubCategory,
				BuildingCatalogGrouping.Role,
				BuildingCatalogGrouping.SchoolTier,
				BuildingCatalogGrouping.Theme,
				BuildingCatalogGrouping.Source,
				BuildingCatalogGrouping.Density,
				BuildingCatalogGrouping.Footprint,
				BuildingCatalogGrouping.Cost,
			})
			{
				Assert.False(
					string.IsNullOrEmpty(BuildingCatalogGrouping.PrimaryKey(entry, dimension)),
					$"{dimension} produced no group key, so grouping by it orders nothing");
			}
		}

		[Fact]
		public void SchoolTiersOrderByCareerRatherThanByName()
		{
			// "College" and "High School" alphabetise into the wrong career
			// order, which is why this ranks rather than naming.
			var source = new[] { 4, 1, 3, 2 }
				.Select(level => Entry(level, name: $"School{level}") with { EducationLevel = level })
				.ToArray();

			var page = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.SchoolTier));

			Assert.Equal(new int?[] { 1, 2, 3, 4 }, page.Items.Select(entry => entry.EducationLevel).ToArray());
		}

		[Fact]
		public void EveryNonTierEducationLevelLandsInOneUnrankedGroup()
		{
			// 0 is a capacity-only school upgrade, 5 is the outside connection,
			// and null is every building in the catalog that is not a school.
			var unranked = BuildingCatalogGrouping.SchoolTierRank(null);

			Assert.Equal(unranked, BuildingCatalogGrouping.SchoolTierRank(0));
			Assert.Equal(unranked, BuildingCatalogGrouping.SchoolTierRank(5));
			Assert.True(
				string.CompareOrdinal(unranked, BuildingCatalogGrouping.SchoolTierRank(4)) > 0,
				"the tier-less group must sort after every real tier");
		}

		private static BuildingCatalogEntry MenuEntry(int id, string category, int priority, string name = "Thing") =>
			Entry(id, name: name) with { UiMenu = "Transportation", UiCategory = category, UiCategoryPriority = priority };

		[Fact]
		public void MenuCategoryGroupsFollowTheGamesTabOrderRatherThanTheAlphabet()
		{
			// Groups follow the priority the game gives its category strip.
			var source = new[]
			{
				MenuEntry(1, "TransportationTram", 60),
				MenuEntry(2, "TransportationAir", 10),
				MenuEntry(3, "TransportationSubway", 40),
				MenuEntry(4, "TransportationRoad", 20),
			};

			var page = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.MenuCategory));

			Assert.Equal(
				new[] { "TransportationAir", "TransportationRoad", "TransportationSubway", "TransportationTram" },
				page.Items.Select(entry => entry.UiCategory));
		}

		/// <summary>Roads ships two tabs at priority 70, and vanilla's unstable sort draws
		/// Roundabouts before Cul-de-sacs. The headings follow the strip, not the alphabet.</summary>
		[Fact]
		public void MenuCategoriesSharingAPriorityFollowTheStrip()
		{
			var source = new[]
			{
				MenuEntry(1, "RoadsCulDeSacs", 70) with { UiCategoryTab = 5 },
				MenuEntry(2, "RoadsRoundabouts", 70) with { UiCategoryTab = 4 },
				MenuEntry(3, "RoadsSmall", 10) with { UiCategoryTab = 0 },
			};

			var page = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.MenuCategory));

			Assert.Equal(
				new[] { "RoadsSmall", "RoadsRoundabouts", "RoadsCulDeSacs" },
				page.Items.Select(entry => entry.UiCategory));
		}

		[Fact]
		public void ACategoryTheStripDoesNotDrawFollowsTheOnesItDoesAtItsPriority()
		{
			Assert.True(string.CompareOrdinal(
				BuildingCatalogGrouping.MenuCategoryRank("Aardvark", 20),
				BuildingCatalogGrouping.MenuCategoryRank("Zebra", 20, tab: 3)) > 0);
			// Priority still leads: the strip is sorted by it, and entries from two menus
			// share no strip.
			Assert.True(string.CompareOrdinal(
				BuildingCatalogGrouping.MenuCategoryRank("Zebra", 10),
				BuildingCatalogGrouping.MenuCategoryRank("Aardvark", 20, tab: 0)) < 0);
		}

		[Fact]
		public void MenuCategoryRankHandlesNegativePriorities()
		{
			// Signed int, so a naive zero-pad would sort every negative after
			// every positive, and -100 ahead of -99.
			var keys = new[] { 5, -100, -99, 0 }
				.Select(priority => BuildingCatalogGrouping.MenuCategoryRank("Category", priority))
				.ToArray();

			Assert.Equal(
				new[] { -100, -99, 0, 5 }.Select(priority => BuildingCatalogGrouping.MenuCategoryRank("Category", priority)),
				keys.OrderBy(key => key, System.StringComparer.OrdinalIgnoreCase));
		}

		[Fact]
		public void MenuCategoriesSharingAPriorityStayDistinctGroups()
		{
			// Vanilla's comparator has no tiebreak, but a group key must be a
			// function of the group: one key for two categories interleaves
			// their members and draws the same heading twice.
			Assert.NotEqual(
				BuildingCatalogGrouping.MenuCategoryRank("TransportationRoad", 20),
				BuildingCatalogGrouping.MenuCategoryRank("TransportationShip", 20));
		}

		[Fact]
		public void AssetsInNoMenuCategorySortAfterEveryNamedOne()
		{
			var unnamed = BuildingCatalogGrouping.PrimaryKey(
				Entry(1) with { UiCategory = null },
				BuildingCatalogGrouping.MenuCategory);

			Assert.True(
				string.CompareOrdinal(unnamed, BuildingCatalogGrouping.MenuCategoryRank("Anything", int.MaxValue)) > 0);
		}

		[Fact]
		public void SourcePrefersTheDlcNameOverTheBroadProvenance()
		{
			Assert.Equal(
				"BridgesAndPorts",
				BuildingCatalogGrouping.PrimaryKey(Entry(1, dlcId: "BridgesAndPorts"), BuildingCatalogGrouping.Source));
			Assert.Equal(
				"BaseGame",
				BuildingCatalogGrouping.PrimaryKey(Entry(1, dlcId: ""), BuildingCatalogGrouping.Source));
		}

		[Fact]
		public void RanksCostBandsNumericallyRatherThanByTheirLabels()
		{
			// Ordering the labels as text would put "₡100k+" before
			// "₡25k–₡100k". These edges are duplicated in buildingGroups.ts and
			// asserted there too; the two must agree.
			Assert.Equal("0", BuildingCatalogGrouping.CostRank(0));
			Assert.Equal("0", BuildingCatalogGrouping.CostRank(4_999));
			Assert.Equal("1", BuildingCatalogGrouping.CostRank(5_000));
			Assert.Equal("1", BuildingCatalogGrouping.CostRank(24_999));
			Assert.Equal("2", BuildingCatalogGrouping.CostRank(25_000));
			Assert.Equal("3", BuildingCatalogGrouping.CostRank(100_000));
			Assert.Equal("3", BuildingCatalogGrouping.CostRank(999_999));
		}

		[Fact]
		public void SortsEntriesWithNoValueAfterEveryBand()
		{
			// Not before the cheapest band, which is where an empty key would
			// put them.
			Assert.Equal("9", BuildingCatalogGrouping.CostRank(null));
			Assert.Equal("9", BuildingCatalogGrouping.FootprintRank(0, 0));

			Assert.True(string.CompareOrdinal(
				BuildingCatalogGrouping.CostRank(null),
				BuildingCatalogGrouping.CostRank(999_999)) > 0);
		}

		[Fact]
		public void SortsTheUnnamedGroupAfterEveryNamedOne()
		{
			// An empty key sorts first, which opens a menu on the entries that
			// have no role at all.
			string unnamed = BuildingCatalogGrouping.PrimaryKey(
				Entry(1, buildingType: ""), BuildingCatalogGrouping.Role);
			string named = BuildingCatalogGrouping.PrimaryKey(
				Entry(2, buildingType: "Zoo"), BuildingCatalogGrouping.Role);

			Assert.True(string.CompareOrdinal(unnamed, named) > 0);
		}

		[Fact]
		public void BandsAFootprintByItsLongerSide()
		{
			Assert.Equal("0", BuildingCatalogGrouping.FootprintRank(2, 2));
			Assert.Equal("2", BuildingCatalogGrouping.FootprintRank(2, 6));
			Assert.Equal("1", BuildingCatalogGrouping.FootprintRank(3, 3));
			Assert.Equal("3", BuildingCatalogGrouping.FootprintRank(20, 1));
		}

		[Fact]
		public void TreatsAnUnknownOrAbsentDimensionAsNoGrouping()
		{
			Assert.False(BuildingCatalogGrouping.IsGrouped(null));
			Assert.False(BuildingCatalogGrouping.IsGrouped(""));
			Assert.False(BuildingCatalogGrouping.IsGrouped("   "));
			Assert.False(BuildingCatalogGrouping.IsGrouped("none"));
			Assert.True(BuildingCatalogGrouping.IsGrouped("category"));

			// Unknown but non-"none" still yields an empty key rather than
			// throwing, so a UI that sends something stale degrades to flat.
			Assert.Equal(string.Empty, BuildingCatalogGrouping.PrimaryKey(Entry(1), "assetPack"));
		}
		[Fact]
		public void RanksDensityByTheDecidedOrderRatherThanTheEnumValue()
		{
			// Low, Row, Medium, Mixed, LowRent, High — the order the player meets
			// them in. The raw flag values put Mixed and LowRent past High and
			// past Signature, so the rank comes from a table instead.
			var ranked = new[]
			{
				ZoneTypeFilter.Low,
				ZoneTypeFilter.Row,
				ZoneTypeFilter.Medium,
				ZoneTypeFilter.Mixed,
				ZoneTypeFilter.LowRent,
				ZoneTypeFilter.High,
			}.Select(BuildingCatalogGrouping.DensityRank).ToArray();

			Assert.Equal(ranked.OrderBy(rank => rank, StringComparer.Ordinal).ToArray(), ranked);
		}

		[Fact]
		public void SortsUntieredZonesAfterEveryRankedTier()
		{
			// Industrial and the extractor areas carry no tier. They belong at
			// the end, like every other group defined by absence.
			Assert.True(
				string.CompareOrdinal(
					BuildingCatalogGrouping.DensityRank(ZoneTypeFilter.High),
					BuildingCatalogGrouping.DensityRank(ZoneTypeFilter.Any)) < 0);
		}
		[Fact]
		public void EveryRankedTierHasItsOwnHeading()
		{
			// The rank and the heading come from two tables in two files; a
			// tier that ranks but reads "Other" would sort into its place and
			// then be filed under the group defined by absence.
			var headings = BuildingCatalogGrouping.DensityOrder
				.Select(BuildingCatalogGrouping.DensityTierLabel)
				.ToArray();

			Assert.DoesNotContain(BuildingCatalogGrouping.Other, headings);
			Assert.Equal(headings.Length, headings.Distinct(StringComparer.Ordinal).Count());
			Assert.Equal(BuildingCatalogGrouping.Other, BuildingCatalogGrouping.DensityTierLabel(ZoneTypeFilter.Any));
		}

		[Fact]
		public void OrdersDensityBeneathTheGamesOwnCategory()
		{
			// The tier is a second GROUP level under menuCategory, so it needs a
			// secondary key as well as a heading, or the group straddles a page
			// boundary and the heading describes the wrong thing.
			var low = Entry(1) with { UiCategory = "ZonesResidential", ZoneType = ZoneTypeFilter.Low };
			var high = Entry(2) with { UiCategory = "ZonesResidential", ZoneType = ZoneTypeFilter.High };

			Assert.True(
				string.CompareOrdinal(
					BuildingCatalogGrouping.SecondaryKey(low, "menuCategory"),
					BuildingCatalogGrouping.SecondaryKey(high, "menuCategory")) < 0);
		}

		[Fact]
		public void OrdersServiceBranchesBeneathTheirCategory()
		{
			// The development branch partitions its category on every service
			// menu. Depth leads the key so the branches read in the order the
			// game's own tree lays them out.
			var basic = Entry(1) with { UiCategory = "Healthcare", DevTreeBranch = "Healthcare", DevTreeBranchDepth = 0 };
			var later = Entry(2) with { UiCategory = "Healthcare", DevTreeBranch = "Hospital", DevTreeBranchDepth = 2 };

			Assert.True(
				string.CompareOrdinal(
					BuildingCatalogGrouping.SecondaryKey(basic, "menuCategory"),
					BuildingCatalogGrouping.SecondaryKey(later, "menuCategory")) < 0);
		}

		[Fact]
		public void FallsBackToTheMilestoneForSignatures()
		{
			// Signature buildings carry no development branch and all share
			// ZoneType.Signature, so the milestone is the only thing that
			// varies; reading Signature as a density collapses them into one.
			var early = Entry(1) with { UiCategory = "SignaturesCommercial", ZoneType = ZoneTypeFilter.Signature, UnlockMilestone = 1 };
			var late = Entry(2) with { UiCategory = "SignaturesCommercial", ZoneType = ZoneTypeFilter.Signature, UnlockMilestone = 9 };

			Assert.NotEqual(
				BuildingCatalogGrouping.SecondaryKey(early, "menuCategory"),
				BuildingCatalogGrouping.SecondaryKey(late, "menuCategory"));

			Assert.True(
				string.CompareOrdinal(
					BuildingCatalogGrouping.SecondaryKey(early, "menuCategory"),
					BuildingCatalogGrouping.SecondaryKey(late, "menuCategory")) < 0);
		}

		[Fact]
		public void KeepsTheThreeTierSourcesApart()
		{
			// Each menu is homogeneous so they never mix in practice, but a
			// collision would silently merge two unrelated groups.
			var density = Entry(1) with { UiCategory = "C", ZoneType = ZoneTypeFilter.Low };
			var branch = Entry(2) with { UiCategory = "C", DevTreeBranch = "Hospital" };
			var milestone = Entry(3) with { UiCategory = "C", UnlockMilestone = 4 };

			var keys = new[] { density, branch, milestone }
				.Select(entry => BuildingCatalogGrouping.SecondaryKey(entry, "menuCategory"))
				.ToArray();

			Assert.Equal(keys.Length, keys.Distinct().Count());
		}
		[Fact]
		public void UsesTheSubcategoryAsTransitsTier()
		{
			// Transit is the one menu whose development branch divides nothing:
			// its branches map one to one onto its categories. Tracks, stops,
			// lines and stations are the real split.
			var track = Entry(1) with
			{
				UiMenu = "Transportation",
				UiCategory = "TransportationTrain",
				SubCategory = "Networks_Tracks",
				DevTreeBranch = "Train",
			};
			var station = track with { Id = 2, SubCategory = "ServiceBuildings_Transportation" };

			Assert.NotEqual(
				BuildingCatalogGrouping.SecondaryKey(track, "menuCategory"),
				BuildingCatalogGrouping.SecondaryKey(station, "menuCategory"));
		}

		[Fact]
		public void StillUsesTheBranchOutsideTransit()
		{
			// The transit rule must not leak: a service menu's subcategory is
			// constant across its whole menu, so taking it there would collapse
			// the branch sub-grouping to a single child everywhere.
			var hospital = Entry(1) with
			{
				UiMenu = "Health & Deathcare",
				UiCategory = "Healthcare",
				SubCategory = "ServiceBuildings_Health",
				DevTreeBranch = "Hospital",
				DevTreeBranchDepth = 2,
			};
			var basic = hospital with { Id = 2, DevTreeBranch = "Healthcare", DevTreeBranchDepth = 0 };

			Assert.NotEqual(
				BuildingCatalogGrouping.SecondaryKey(hospital, "menuCategory"),
				BuildingCatalogGrouping.SecondaryKey(basic, "menuCategory"));
		}

		[Fact]
		public void DefaultOpensOnCategoryWhenNothingNarrowerApplies()
		{
			Assert.Equal("category", BuildingCatalogGrouping.DefaultDimension(false, "", false));
			Assert.Equal("category", BuildingCatalogGrouping.DefaultDimension(false, null, false));
		}

		[Fact]
		public void TheMenusOwnCategoriesBeatADevelopmentAxis()
		{
			Assert.Equal("menuCategory", BuildingCatalogGrouping.DefaultDimension(true, "development", false));
		}

		[Fact]
		public void TheAxisDecidesWhenTheMenuHasNoCategoriesOfItsOwn()
		{
			Assert.Equal("development", BuildingCatalogGrouping.DefaultDimension(false, "development", false));
			Assert.Equal("category", BuildingCatalogGrouping.DefaultDimension(false, "assetType", false));
		}

		[Fact]
		public void SchoolTiersComeBeforeEverythingCategoriesIncluded()
		{
			Assert.Equal("schoolTier", BuildingCatalogGrouping.DefaultDimension(true, "development", true));
		}

		[Fact]
		public void TheEffectiveGroupingIsOneTheMenuOffers()
		{
			// One category, so the picker does not offer the default menuCategory:
			// it would put the whole menu in one bucket. The strip's axis is the
			// next answer, and it is offered.
			var electricity = new[] { "category", "subCategory", "role", "development", "source", "footprint", "cost", "none" };
			Assert.Equal("development", BuildingCatalogGrouping.Effective("", true, "development", false, electricity));

			// A choice carried over from another menu that cannot act here falls
			// back the same way, to the menu's own default when that is offered.
			var roads = new[] { "menuCategory", "category", "subCategory", "progression", "development", "none" };
			Assert.Equal("menuCategory", BuildingCatalogGrouping.Effective("schoolTier", true, "development", false, roads));

			// Neither the default nor the axis offered: the picker's first grouping.
			var flat = new[] { "source", "cost", "none" };
			Assert.Equal("source", BuildingCatalogGrouping.Effective("", true, "development", false, flat));

			// Nothing grouped offered at all: none. And "none" itself is always honoured.
			Assert.Equal("none", BuildingCatalogGrouping.Effective("", true, "development", false, new[] { "none" }));
			Assert.Equal("none", BuildingCatalogGrouping.Effective("none", true, "development", false, roads));

			// Not judged yet (no entries): the plain rule stands.
			Assert.Equal("menuCategory", BuildingCatalogGrouping.Effective("", true, "development", false, System.Array.Empty<string>()));
		}

		[Fact]
		public void AChoiceWinsAndAutoFallsThroughToTheDefault()
		{
			Assert.Equal("cost", BuildingCatalogGrouping.Effective("cost", true, "development", false));
			Assert.Equal("none", BuildingCatalogGrouping.Effective("none", true, "development", false));
			Assert.Equal("menuCategory", BuildingCatalogGrouping.Effective("", true, "development", false));
			Assert.Equal("menuCategory", BuildingCatalogGrouping.Effective(null, true, "development", false));
			// An id the picker does not offer is not a choice.
			Assert.Equal("menuCategory", BuildingCatalogGrouping.Effective("nonsense", true, "development", false));
		}

		[Fact]
		public void ProgressionAndDevelopmentHaveKeysSoTheirGroupsAreContiguous()
		{
			// Without an ordering key the UI groups by label alone and a group
			// can straddle a window boundary.
			var early = Entry(1) with { UnlockMilestone = 2, DevTreeBranch = "Basic", DevTreeBranchDepth = 0 };
			var late = Entry(2) with { UnlockMilestone = 10, DevTreeBranch = "Nuclear", DevTreeBranchDepth = 3 };

			Assert.True(string.CompareOrdinal(BuildingCatalogGrouping.PrimaryKey(early, "progression"), BuildingCatalogGrouping.PrimaryKey(late, "progression")) < 0);
			Assert.True(string.CompareOrdinal(BuildingCatalogGrouping.PrimaryKey(early, "development"), BuildingCatalogGrouping.PrimaryKey(late, "development")) < 0);
		}
	}
}
