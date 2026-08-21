using System.Collections.Generic;
using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The progression tab strip: narrowing a menu to one tier of the game's
	/// own unlock progression.
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
				IsUniqueMesh: false,
				IsVanilla: true,
				IsFavorited: false,
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
		public void QueryDefaultsToAnyMilestone()
		{
			// The record's primary constructor cannot spell AnyMilestone in its
			// own default (CS0103), so the two are written separately. If they
			// ever drift, every unnarrowed query silently starts filtering.
			Assert.Equal(BuildingCatalogQuery.AnyMilestone, new BuildingCatalogQuery().UnlockMilestone);
		}

		[Fact]
		public void ReturnsEverythingWhenNoTierIsSelected()
		{
			var page = BuildingCatalogQueryEngine.Query(Source, new BuildingCatalogQuery());

			Assert.Equal(4, page.TotalCount);
		}

		[Fact]
		public void NarrowsToASingleTier()
		{
			var page = BuildingCatalogQueryEngine.Query(
				Source,
				new BuildingCatalogQuery(UnlockMilestone: 0));

			Assert.Equal(2, page.TotalCount);
		}

		[Fact]
		public void TierIsExactRatherThanCumulative()
		{
			// A tab names the point the game gated an asset behind. Read as
			// "this tier and below" the last tab would be the whole menu again,
			// and every tab would contain the one before it.
			var page = BuildingCatalogQueryEngine.Query(
				Source,
				new BuildingCatalogQuery(UnlockMilestone: 7));

			Assert.Equal(1, page.TotalCount);
			Assert.Equal("Highway", page.Items[0].Name);
		}

		[Fact]
		public void UnlockedAssetsKeepTheirTier()
		{
			// The milestone is a property of the ASSET, not of the save. This
			// is the whole reason the strip is worth drawing in a developed
			// city — where, when the backend zeroed the milestone on unlock,
			// every tab but the first went empty.
			var page = BuildingCatalogQueryEngine.Query(
				Source,
				new BuildingCatalogQuery(UnlockMilestone: 3));

			Assert.Equal(1, page.TotalCount);
			Assert.False(page.Items[0].IsLocked);
			Assert.Equal("Four-Lane Road", page.Items[0].Name);
		}

		[Fact]
		public void StripValueReadsWhicheverAxisIsNamed()
		{
			// One reader for the predicate and the counts. They read the axis
			// separately once before — the category counts against UiCategory
			// while the tab selected on EffectiveCategory — and ten Roads tabs
			// reported 0 while showing assets when clicked.
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
			// A tab's axis is a property of the TAB, not of the row: Water draws
			// its buildings as development nodes and its pipes as one Networks
			// tab, so one row carries both. Matched by value across the
			// candidate axes, which works because the value spaces do not
			// overlap — node names against "Buildings"/"Networks".
			var source = new List<BuildingCatalogEntry>
			{
				Entry(1, "Water Pipe", 0) with { Category = "Networks", DevTreeBranch = "Basic" },
				Entry(2, "Water Tower", 0) with { Category = "ServiceBuildings", DevTreeBranch = "Basic" },
				Entry(3, "Water Treatment Plant", 2) with { Category = "ServiceBuildings", DevTreeBranch = "Water Treatment Plant" },
			};

			var byBranch = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(StripAxis: StripAxes.Development, StripTab: "Basic"));
			Assert.Equal(2, byBranch.TotalCount);

			var byType = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(StripAxis: StripAxes.AssetType, StripTab: StripAxes.NetworkValue));
			Assert.Equal(1, byType.TotalCount);
			Assert.Equal("Water Pipe", byType.Items[0].Name);

			// A node name still selects its node even when the row's other tabs
			// are asset types, which is what lets one row mix the two.
			var mixed = BuildingCatalogQueryEngine.Query(
				source,
				new BuildingCatalogQuery(StripAxis: StripAxes.AssetType, StripTab: "Basic"));
			Assert.Equal(2, mixed.TotalCount);
		}
	}
}
