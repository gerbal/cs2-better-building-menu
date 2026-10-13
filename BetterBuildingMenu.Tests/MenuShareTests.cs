using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;

namespace BetterBuildingMenu.Tests
{
	/// <summary>What the look's Auto rule reads of each menu: its rows, and how many carry a cost or a capacity, a capacity, a lock.</summary>
	public sealed class MenuShareTests
	{
		private static BuildingCatalogEntry Row(int id, double? cost, double? capacity, bool locked = false) =>
			new(
				Id: id, PrefabName: "Prefab" + id, Name: "Building " + id, Category: "ServiceBuildings", SubCategory: "ServiceBuildings_Parks",
				Thumbnail: "", LotWidth: 2, LotDepth: 2, BuildingLevel: 0, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "",
				IsLocked: locked, ConstructionCost: cost, Capacity: capacity);

		[Fact]
		public void CountsTheRowsThatCarryACostOrACapacityACapacityAndALock()
		{
			var share = MenuShare.Of("Parks & Recreation", new[]
			{
				Row(1, cost: 5000, capacity: null),
				Row(2, cost: null, capacity: 40),
				Row(3, cost: 0, capacity: 0, locked: true),
				Row(4, cost: null, capacity: null),
				Row(5, cost: 9000, capacity: 12, locked: true),
			});

			Assert.Equal(new MenuShare("Parks & Recreation", 5, 3, 2, 2), share);
		}

		[Fact]
		public void AnEmptyMenuCountsNothing()
		{
			Assert.Equal(new MenuShare("Areas", 0, 0, 0, 0), MenuShare.Of("Areas", Array.Empty<BuildingCatalogEntry>()));
		}

		[Fact]
		public void CountsTheRowsUnderEachGroupLabelAllDrawsAndNoLockedLabel()
		{
			var sections = new[]
			{
				new CatalogSection("group:0", CatalogSection.Group, "Small Roads", "", 0, 3, false),
				new CatalogSection("group:1", CatalogSection.Group, "Parking", "", 3, 2, false),
				new CatalogSection(CatalogSection.LockedId, CatalogSection.Locked, "", "", 4, 1, false),
			};

			Assert.Equal(new[] { 3, 2 }, MenuShare.Of("Roads", new[] { Row(1, 50, null) }, sections).GroupRows);
			Assert.Empty(MenuShare.Of("Areas", new[] { Row(1, 50, null) }, Array.Empty<CatalogSection>()).GroupRows!);
		}

		[Fact]
		public void CountsTheTabsTheMenusRowDraws()
		{
			// A small menu with no tabs of its own draws no groups in its list; one with tabs keeps them.
			Assert.Equal(2, MenuShare.Of("Communications", new[] { Row(1, 50, null) }, null, tabs: 2).Tabs);
			Assert.Equal(0, MenuShare.Of("Garbage Management", new[] { Row(1, 50, null) }).Tabs);
		}

		[Fact]
		public void EachShareReachesTheUiByName()
		{
			var writer = new RecordingJsonWriter();

			new MenuShare("Roads", 779, 600, 3, 40).Write(writer);

			Assert.Equal(new[] { "menu", "rows", "costOrCapacity", "capacity", "locked", "groupRows", "tabs" }, writer.PropertyNames);
		}

		[Fact]
		public void TheOpenMenuIsCountedOverItsWholeMenuAndNoOtherMenuIs()
		{
			var publish = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Catalog.cs"), "private bool PublishMenuShares(");

			// With the toolbar's row untouched this query is the refresh's own snapshot, from the cache.
			Assert.Contains("_buildingCatalogAdapter.Build(source, new BuildingCatalogQuery(UiMenu: _assetMenu.Menu), VanillaToolbarSelection.None, built => built.DefaultGroupBy)", publish);
			// All's labels in the menu's own grouping, the ones a menu opening on All draws.
			Assert.Contains("_menuShares.Count(_assetMenu.Menu, source.Generation, () => All().MenuSet, () => All().Page.Sections, () => All().MenuCategoryCounts.Count)", publish);
			Assert.Contains("_MenuShares.Value = _menuShares.Shares;", publish);
			Assert.DoesNotContain("AssetMenus()", publish);
			Assert.Contains("PublishMenuShares(source);", ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Catalog.cs"), "private void RefreshBuildingCatalog("));
		}

		[Fact]
		public void TheRefreshLogsItsOwnProjectionAndTheSharesOnALineOfTheirOwn()
		{
			var refresh = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Catalog.cs"), "private void RefreshBuildingCatalog(");
			var read = refresh.IndexOf("var projectionMs = _buildingCatalogAdapter.LastProjectionMs;", StringComparison.Ordinal);

			// The shares' builds add to the adapter's projection time, so the refresh reads its own first.
			Assert.InRange(read, 0, refresh.IndexOf("PublishMenuShares(source);", StringComparison.Ordinal));
			Assert.Contains("proj={projectionMs}ms({(projectionWasHit ? \"hit\" : \"miss\")})", refresh);
			Assert.Contains("if (sharesCounted) { Mod.Log.Debug($\"[ASSET-MENU-SHARES] {sharesMs}ms", refresh);
		}
	}

	/// <summary>The shares counted so far: a menu is counted when it is open, once per index generation.</summary>
	public sealed class MenuShareLedgerTests
	{
		private static BuildingCatalogEntry Row(int id, double? cost) =>
			new(
				Id: id, PrefabName: "Prefab" + id, Name: "Building " + id, Category: "Roads", SubCategory: "RoadsSmallRoads",
				Thumbnail: "", LotWidth: 0, LotDepth: 0, BuildingLevel: 0, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: "",
				IsLocked: false, ConstructionCost: cost, Capacity: null);

		/// <summary>Rows as a menu's projection would hand them over, counting each time they are read.</summary>
		private sealed class Spy
		{
			public int Reads { get; private set; }

			public Func<IEnumerable<BuildingCatalogEntry>> Rows(params BuildingCatalogEntry[] rows) => () =>
			{
				Reads++;

				return rows;
			};
		}

		[Fact]
		public void OpeningOneMenuCountsThatMenuOnly()
		{
			var ledger = new MenuShareLedger();
			var spy = new Spy();

			Assert.True(ledger.Count("Roads", 1, spy.Rows(Row(1, 50), Row(2, null))));

			Assert.Equal(1, spy.Reads);
			Assert.Equal(new[] { new MenuShare("Roads", 2, 1, 0, 0) }, ledger.Shares);
		}

		[Fact]
		public void ACountCarriesAllsGroupLabelsWhereItIsGivenThem()
		{
			var ledger = new MenuShareLedger();
			var sections = new[] { new CatalogSection("group:0", CatalogSection.Group, "Small Roads", "", 0, 1, false), new CatalogSection("group:1", CatalogSection.Group, "Parking", "", 1, 1, false) };

			Assert.True(ledger.Count("Roads", 1, new Spy().Rows(Row(1, 50), Row(2, null)), () => sections));

			Assert.Equal(new[] { 1, 1 }, ledger.Shares[0].GroupRows);
		}

		[Fact]
		public void ACountCarriesTheTabsTheMenusRowDrawsWhereItIsGivenThem()
		{
			var ledger = new MenuShareLedger();

			Assert.True(ledger.Count("Roads", 1, new Spy().Rows(Row(1, 50)), null, () => 16));

			Assert.Equal(16, ledger.Shares[0].Tabs);
		}

		[Fact]
		public void ASecondRefreshInTheSameGenerationCountsNothingNew()
		{
			var ledger = new MenuShareLedger();
			var spy = new Spy();
			ledger.Count("Roads", 1, spy.Rows(Row(1, 50)));

			Assert.False(ledger.Count("Roads", 1, spy.Rows(Row(1, 50))));

			Assert.Equal(1, spy.Reads);
		}

		[Fact]
		public void AGenerationChangeRecountsTheOpenMenuAndKeepsTheOthersAsCounted()
		{
			var ledger = new MenuShareLedger();
			var spy = new Spy();
			ledger.Count("Roads", 1, spy.Rows(Row(1, 50)));
			ledger.Count("Zones", 1, spy.Rows(Row(2, null)));

			Assert.True(ledger.Count("Roads", 2, spy.Rows(Row(1, 50), Row(3, 70))));

			Assert.Equal(3, spy.Reads);
			Assert.Equal(new[] { new MenuShare("Roads", 2, 2, 0, 0), new MenuShare("Zones", 1, 0, 0, 0) }, ledger.Shares);
		}

		[Fact]
		public void EachMenuKeepsTheGenerationItWasCountedOn()
		{
			var ledger = new MenuShareLedger();
			var spy = new Spy();
			ledger.Count("Roads", 1, spy.Rows(Row(1, 50)));
			ledger.Count("Zones", 2, spy.Rows(Row(2, null)));

			// Zones counted on 2 says nothing of Roads, last counted on 1.
			Assert.True(ledger.Count("Roads", 2, spy.Rows(Row(1, 50), Row(3, 70))));

			Assert.Equal(3, spy.Reads);
			Assert.Equal(new MenuShare("Roads", 2, 2, 0, 0), ledger.Shares[0]);
		}

		[Fact]
		public void ACountThatThrowsIsCountedAgainNextTime()
		{
			var ledger = new MenuShareLedger();

			Func<IEnumerable<BuildingCatalogEntry>> broken = () => throw new InvalidOperationException();

			Assert.Throws<InvalidOperationException>(() => { ledger.Count("Roads", 1, broken); });

			Assert.Empty(ledger.Shares);
			Assert.True(ledger.Count("Roads", 1, new Spy().Rows(Row(1, 50))));
		}

		[Fact]
		public void NoMenuOpenCountsNothing()
		{
			var spy = new Spy();

			Assert.False(new MenuShareLedger().Count("", 1, spy.Rows(Row(1, 50))));

			Assert.Equal(0, spy.Reads);
		}
	}
}
