using System.Collections.Generic;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The fallback tab strip and the entry's milestone facts, including how the
	/// strip matches a tab by its value.
	/// </summary>
	public sealed class BuildingCatalogProgressionTests
	{
		private static BuildingCatalogEntry Entry(int id, string name, int milestone, bool locked = false) =>
			new(
				Id: id,
				PrefabName: name,
				Name: name,
				Category: "Buildings",
				SubCategory: "Buildings_Residential",
				Thumbnail: "",
				LotWidth: 4,
				LotDepth: 4,
				BuildingLevel: 1,
				ZoneType: ZoneTypeFilter.Any,
				HasParking: false,
				IsVanilla: true,
				PdxModsId: "",
				IsLocked: locked,
				UnlockMilestone: milestone);

		private static readonly List<BuildingCatalogEntry> Source = new()
		{
			Entry(1, "Gravel Road", 0),
			Entry(2, "Two-Lane Road", 0),
			Entry(3, "Four-Lane Road", 3),
			Entry(4, "Highway", 7, locked: true),
		};

		[Fact]
		public void ReturnsEverythingTheFixtureHolds()
		{
			var page = BuildingCatalogQueryEngine.Query(Source, new BuildingCatalogQuery());

			Assert.Equal(4, page.TotalCount);
		}

		[Fact]
		public void StripValueReadsWhicheverAxisIsNamed()
		{
			// One reader serves both the predicate and the counts, so a tab cannot
			// report an empty count and then show assets when clicked.
			var pipe = Entry(1, "Water Pipe", 0) with { Category = "Networks", DevTreeBranch = "Basic" };
			var plant = Entry(2, "Water Treatment Plant", 2) with { Category = "ServiceBuildings", DevTreeBranch = "Water Treatment Plant" };

			Assert.Equal("Basic", BuildingCatalogQueryEngine.StripValue(pipe, StripAxes.Development));
			Assert.Equal("Water Treatment Plant", BuildingCatalogQueryEngine.StripValue(plant, StripAxes.Development));
			Assert.Equal(StripAxes.NetworkValue, BuildingCatalogQueryEngine.StripValue(pipe, StripAxes.AssetType));
			Assert.Equal(StripAxes.BuildingValue, BuildingCatalogQueryEngine.StripValue(plant, StripAxes.AssetType));

			// An axis nobody named narrows nothing, which is what leaves the
			// menus that use vanilla's own categories alone.
			Assert.Equal(string.Empty, BuildingCatalogQueryEngine.StripValue(plant, ""));
			Assert.Equal(string.Empty, BuildingCatalogQueryEngine.StripValue(plant, null));
		}

		[Fact]
		public void AnAssetIsANetworkOrAThingYouPlace()
		{
			var pipe = Entry(1, "Water Pipe", 0) with { Category = "Networks" };
			var tower = Entry(2, "Water Tower", 0) with { Category = "ServiceBuildings" };

			Assert.Equal(StripAxes.NetworkValue, BuildingCatalogQueryEngine.AssetTypeOf(pipe));
			Assert.Equal(StripAxes.BuildingValue, BuildingCatalogQueryEngine.AssetTypeOf(tower));
		}

		[Fact]
		public void TheStripTabNarrowsOnWhicheverAxisNamesIt()
		{
			// The selection is a LIST because the filter rail offers the same state
			// and can hold several. A tab's axis belongs to the TAB, not the row, so
			// tabs match by value across axes whose value spaces do not overlap.
			var source = new List<BuildingCatalogEntry>
			{
				Entry(1, "Water Pipe", 0) with { Category = "Networks", DevTreeBranch = "Basic" },
				Entry(2, "Water Tower", 0) with { Category = "ServiceBuildings", DevTreeBranch = "Basic" },
				Entry(3, "Water Treatment Plant", 2) with { Category = "ServiceBuildings", DevTreeBranch = "Water Treatment Plant" },
			};

			var byBranch = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(StripTabs: new[] { "Basic" }));
			Assert.Equal(2, byBranch.TotalCount);

			var byType = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(StripTabs: new[] { StripAxes.NetworkValue }));
			Assert.Equal(1, byType.TotalCount);
			Assert.Equal("Water Pipe", byType.Items[0].Name);

			// A node name still selects its node even when the row's other tabs
			// are asset types, which is what lets one row mix the two.
			// There is no axis on the query at all; the tab's value is what names it.
			var mixed = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(StripTabs: new[] { "Basic" }));
			Assert.Equal(2, mixed.TotalCount);
		}
	}
}
