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
		public void EachShareReachesTheUiByName()
		{
			var writer = new RecordingJsonWriter();

			new MenuShare("Roads", 779, 600, 3, 40).Write(writer);

			Assert.Equal(new[] { "menu", "rows", "costOrCapacity", "capacity", "locked" }, writer.PropertyNames);
		}

		[Fact]
		public void TheSharesAreCountedOncePerIndexGenerationOverEachWholeMenu()
		{
			var publish = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Catalog.cs"), "private bool PublishMenuShares(");

			Assert.Contains("if (_menuSharesGeneration == source.Generation) { return false; }", publish);
			Assert.Contains("new BuildingCatalogQuery(UiMenu: menu.Id), VanillaToolbarSelection.None).MenuSet", publish);
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
}
