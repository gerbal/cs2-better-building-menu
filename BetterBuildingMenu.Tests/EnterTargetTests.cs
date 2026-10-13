using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Enter's target moved by Up and Down: through the rows that can be placed, in the order the list draws, stopping at its ends.</summary>
	public sealed class EnterTargetTests
	{
		private static BuildingCatalogEntry Lane(int id, string name, string tab = "RoadsMediumRoads", int priority = 1) =>
			new BuildingCatalogEntry(
				Id: id, PrefabName: "Lane" + id, Name: name, Category: "Networks", SubCategory: "Networks_Roads",
				Thumbnail: "", LotWidth: 2, LotDepth: 2, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "")
				with { UiMenu = "Roads", UiCategory = tab, UiCategoryPriority = priority };

		/// <summary>
		/// "Lane", the best match for "lane", then by name A, B (locked), C and D (a unique already built). A
		/// search orders by relevance first, so the best match leads an ungrouped list.
		/// </summary>
		private static readonly BuildingCatalogEntry[] Lanes =
		{
			Lane(1, "Lane"),
			Lane(2, "Lane A"),
			Lane(3, "Lane B") with { IsLocked = true },
			Lane(4, "Lane C"),
			Lane(5, "Lane D") with { IsAlreadyBuilt = true },
		};

		/// <summary>Grouped by tab, Small Roads ahead of Highways: Lane A, Lane B (locked) and Lane C draw above the best match.</summary>
		private static readonly BuildingCatalogEntry[] Grouped =
		{
			Lane(1, "Lane", "RoadsHighways", 2),
			Lane(2, "Lane A", "RoadsSmallRoads", 1),
			Lane(3, "Lane B", "RoadsSmallRoads", 1) with { IsLocked = true },
			Lane(4, "Lane C", "RoadsSmallRoads", 1),
		};

		private static BuildingCatalogPage Moved(int step, bool descending = false) =>
			BuildingCatalogQueryEngine.Query(
				Lanes,
				new BuildingCatalogQuery(SearchText: "lane", SortColumn: "Name", Descending: descending, UiMenu: "Roads", EnterStep: step));

		private static BuildingCatalogPage MovedGrouped(int step) =>
			BuildingCatalogQueryEngine.Query(
				Grouped,
				new BuildingCatalogQuery(SearchText: "lane", SortColumn: "Name", GroupBy: BuildingCatalogGrouping.MenuCategory, UiMenu: "Roads", EnterStep: step));

		[Fact]
		public void ADownStepMovesTheTargetToTheNextRowThatCanBePlaced()
		{
			Assert.Equal(new BuildingCatalogBestMatch(2, "Lane A", "Roads", 1), Moved(1).BestMatch);
			// Lane B is locked: two steps down is Lane C.
			Assert.Equal(new BuildingCatalogBestMatch(4, "Lane C", "Roads", 3), Moved(2).BestMatch);
			Assert.Equal(2, Moved(2).EnterStep);
		}

		[Fact]
		public void AnUpStepMovesItUpTheListPastRowsThatCannotBePlaced()
		{
			// The best match draws last, in Highways: up the list is Lane C, then Lane A past the locked Lane B.
			Assert.Equal(new BuildingCatalogBestMatch(4, "Lane C", "Roads", 2), MovedGrouped(-1).BestMatch);
			Assert.Equal(new BuildingCatalogBestMatch(2, "Lane A", "Roads", 0), MovedGrouped(-2).BestMatch);
			Assert.Equal(-2, MovedGrouped(-2).EnterStep);
		}

		[Fact]
		public void TheTargetStopsAtTheLastRowThatCanBePlacedAndThePageSaysWhere()
		{
			// Lane D is already built, so Lane C is the last row Enter can place.
			Assert.Equal(4, Moved(3).BestMatch!.Id);
			Assert.Equal(2, Moved(3).EnterStep);
			Assert.Equal(2, Moved(9).EnterStep);
			Assert.Equal(-2, MovedGrouped(-9).EnterStep);
			// Past either end from the best match: it stays, and no step is taken.
			Assert.Equal(1, Moved(-1).BestMatch!.Id);
			Assert.Equal(0, Moved(-1).EnterStep);
			Assert.Equal(1, MovedGrouped(1).BestMatch!.Id);
			Assert.Equal(0, MovedGrouped(1).EnterStep);
		}

		[Fact]
		public void EnterArmsTheTargetTheKeysMoved()
		{
			// BestMatchId is what Enter arms: the moved target, so the field and Enter name one row.
			Assert.Equal(4, Moved(2).BestMatchId);
			Assert.Equal(1, Moved(0).BestMatchId);
			Assert.Equal(0, Moved(0).EnterStep);
		}

		[Fact]
		public void WithoutASearchOrARowThatCanBePlacedNoStepIsServed()
		{
			var unsearched = BuildingCatalogQueryEngine.Query(Lanes, new BuildingCatalogQuery(SortColumn: "Name", UiMenu: "Roads", EnterStep: 2));
			var locked = Lanes.Select(lane => lane with { IsLocked = true }).ToArray();
			var allLocked = BuildingCatalogQueryEngine.Query(locked, new BuildingCatalogQuery(SearchText: "lane", SortColumn: "Name", UiMenu: "Roads", EnterStep: 2));

			Assert.Null(unsearched.BestMatch);
			Assert.Equal(0, unsearched.EnterStep);
			Assert.Null(allLocked.BestMatch);
			Assert.True(allLocked.AllMatchesLocked);
			Assert.Equal(0, allLocked.EnterStep);
		}

		[Fact]
		public void TheStepWalksTheOrderTheListDraws()
		{
			// Z to A among the equal matches: below the best match come the built Lane D, then Lane C.
			Assert.Equal(new BuildingCatalogBestMatch(4, "Lane C", "Roads", 2), Moved(1, descending: true).BestMatch);
			Assert.Equal(new BuildingCatalogBestMatch(2, "Lane A", "Roads", 4), Moved(2, descending: true).BestMatch);
		}

		[Fact]
		public void ATargetPastTheWindowIsNamedAndTheWindowStaysAsItWas()
		{
			// Enter arms by id wherever the row is, so the keys never grow the window.
			var lanes = Enumerable.Range(1, 300).Select(id => Lane(id, $"Lane {id:D3}")).ToArray();
			var page = BuildingCatalogQueryEngine.Query(lanes, new BuildingCatalogQuery(SearchText: "lane", SortColumn: "Name", UiMenu: "Roads", EnterStep: 150));

			Assert.Equal(new BuildingCatalogBestMatch(151, "Lane 151", "Roads", 150), page.BestMatch);
			Assert.Equal(BuildingCatalogQuery.DefaultLimit, page.Limit);
			Assert.Equal(BuildingCatalogQuery.DefaultLimit, page.Items.Count);
		}

		[Fact]
		public void ThePageWritesTheStepAfterTheStart()
		{
			var page = new BuildingCatalogPage(Array.Empty<BuildingCatalogEntry>(), 0, 0, 100, ListStart: 3, EnterStep: -2);
			RecordingJsonWriter writer = new();

			page.Write(writer);

			var at = writer.Tokens.IndexOf("PropertyName:listStart");
			Assert.Equal(
				new[] { "PropertyName:listStart", "Write:Int32:3", "PropertyName:enterStep", "Write:Int32:-2" },
				writer.Tokens.Skip(at).Take(4));
		}
	}

	/// <summary>The keys reach the state through one trigger, and the state keeps the step each page served.</summary>
	public sealed class EnterTargetWiringTests
	{
		[Fact]
		public void TheRefreshKeepsTheStepThePageServedBeforeThePageGoesOut()
		{
			var refresh = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Catalog.cs"), "private void RefreshBuildingCatalog(");
			var kept = refresh.IndexOf("_assetMenu = _assetMenu.KeepEnterStep(page.EnterStep);", StringComparison.Ordinal);

			Assert.True(kept >= 0, "the refresh never keeps the step the page served");
			Assert.True(
				kept < refresh.IndexOf("_BuildingCatalogBinding.Value = page with", StringComparison.Ordinal),
				"the state must hold the step before the page goes out");
		}

		[Fact]
		public void UpAndDownReachTheStateThroughOneTrigger()
		{
			Assert.Contains("CreateTrigger<int>(\"MoveEnterTarget\", MoveEnterTarget);", ModSource.Text("Systems/BuildingMenuUISystem.cs"));
			Assert.Contains(
				"private void MoveEnterTarget(int direction) => Apply(_assetMenu.MoveEnterTarget(direction));",
				ModSource.Text("Systems/BuildingMenuUISystem.Query.cs"));
		}
	}
}
