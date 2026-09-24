using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;
using BetterBuildingMenu.Utilities.PrefabCategoryProcessor;

using Game.Prefabs;

using System.Collections.Generic;
using System.Runtime.CompilerServices;

using Unity.Entities;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The zone, progression and mod tables a full pass builds into its index.
	/// </summary>
	/// <remarks>
	/// Each test builds its own tables. None of them is a static any more, so two indexes
	/// answer from their own and nothing a test builds is seen by another.
	/// </remarks>
	public sealed class CatalogIndexTablesTests
	{
		private static ZoneIndex Zones(
			Dictionary<int, ZoneTypeFilter>? types = null,
			Dictionary<int, ZoneTypeFilter>? densities = null,
			Dictionary<int, ZoneLotSizes>? lotSizes = null,
			ZoneCatalogEntry[]? catalog = null) =>
			new(
				types ?? new(),
				densities ?? new(),
				lotSizes ?? new(),
				catalog ?? System.Array.Empty<ZoneCatalogEntry>());

		private static ProgressionIndex Progression(
			Dictionary<int, string>? milestones = null,
			Dictionary<int, (string Label, string Icon, int Depth, string Service)>? branches = null,
			Dictionary<string, (string Label, string Icon, int Depth)>? roots = null) =>
			new(milestones ?? new(), branches ?? new(), roots ?? new());

		[Fact]
		public void ANewIndexStartsWithEmptyTables()
		{
			var index = new CatalogIndex();

			Assert.Same(VanillaMenuIndex.Empty, index.Menus);
			Assert.Same(ZoneIndex.Empty, index.Zones);
			Assert.Same(ProgressionIndex.Empty, index.Progression);
			Assert.Same(ModCompatibility.None, index.Mods);
			Assert.False(index.Mods.ExtraDetailing);
			Assert.False(index.Mods.RoadBuilder);
		}

		[Fact]
		public void AZoneThePassNeverSawReadsAsAnyWithNoLots()
		{
			var zones = ZoneIndex.Empty;

			Assert.Equal(ZoneTypeFilter.Any, zones.TypeOf(5));
			Assert.Equal(ZoneTypeFilter.Any, zones.DensityOf(5));
			Assert.Null(zones.LotSizesOf(5));
			Assert.Empty(zones.Catalog);
		}

		[Fact]
		public void AZonesTypeAndDensityAreKeptApart()
		{
			// A mixed zone is Medium to the buildings that grow in it, and Mixed to itself.
			var zones = Zones(
				types: new() { [5] = ZoneTypeFilter.Medium },
				densities: new() { [5] = ZoneTypeFilter.Mixed },
				lotSizes: new() { [5] = ZoneLotSizes.From(2, 3).Include(4, 3) });

			Assert.Equal(ZoneTypeFilter.Medium, zones.TypeOf(5));
			Assert.Equal(ZoneTypeFilter.Mixed, zones.DensityOf(5));
			Assert.Equal(4, zones.LotSizesOf(5)?.MaxWidth);
			Assert.Equal(ZoneTypeFilter.Any, zones.TypeOf(6));
		}

		[Fact]
		public void TheZoneCatalogIsTheOneThePassBuilt()
		{
			var entry = new ZoneCatalogEntry(5, 1, "EU_Residential_Mixed", "Mixed Housing", "Residential", ZoneTypeFilter.Mixed, string.Empty);

			Assert.Same(entry, Assert.Single(Zones(catalog: new[] { entry }).Catalog));
		}

		[Fact]
		public void NoMilestonesMeansNoNames()
		{
			Assert.Empty(ProgressionIndex.Empty.MilestoneNames());
			Assert.Equal(string.Empty, ProgressionIndex.Empty.MilestoneName(1));
		}

		[Fact]
		public void MilestoneNamesAreDenseToTheHighestIndexWithGapsEmpty()
		{
			var progression = Progression(milestones: new() { [1] = "Tiny Village", [3] = "Small Town" });

			Assert.Equal(new[] { string.Empty, "Tiny Village", string.Empty, "Small Town" }, progression.MilestoneNames());
			Assert.Equal("Small Town", progression.MilestoneName(3));
			Assert.Equal(string.Empty, progression.MilestoneName(2));
		}

		[Fact]
		public void ABranchIsFoundByItsNode()
		{
			var progression = Progression(branches: new() { [40] = ("Airport", "Media/Airport.svg", 2, "Transportation") });

			Assert.True(progression.TryGetBranch(40, out var branch));
			Assert.Equal(("Airport", "Media/Airport.svg", 2, "Transportation"), branch);
			Assert.False(progression.TryGetBranch(41, out _));
		}

		[Fact]
		public void ARootIsFoundByItsServiceAndNamesTheLabel()
		{
			// A dictionary that ignores case: the index matches exactly whatever the caller built.
			var progression = Progression(roots: new(System.StringComparer.OrdinalIgnoreCase) { ["Healthcare"] = ("Healthcare", "Media/Health.svg", 0) });

			Assert.True(progression.TryGetRoot("Healthcare", out var root));
			Assert.Equal("Media/Health.svg", root.Icon);
			Assert.Equal("Healthcare", progression.RootLabel("Healthcare"));
			// The same comparison the game's service names get elsewhere: exact.
			Assert.Equal(string.Empty, progression.RootLabel("healthcare"));
			Assert.Equal(string.Empty, progression.RootLabel(null));
			Assert.False(progression.TryGetRoot(null, out _));
		}

		[Fact]
		public void EachIndexReadsItsOwnTables()
		{
			var full = new CatalogIndex(
				zones: Zones(types: new() { [5] = ZoneTypeFilter.High }),
				progression: Progression(milestones: new() { [0] = "Founding" }),
				mods: new ModCompatibility(ExtraDetailing: true, RoadBuilder: true));
			var empty = new CatalogIndex();

			Assert.Equal(ZoneTypeFilter.High, full.Zones.TypeOf(5));
			Assert.Equal(new[] { "Founding" }, full.Progression.MilestoneNames());
			Assert.True(full.Mods.ExtraDetailing);
			Assert.Equal(ZoneTypeFilter.Any, empty.Zones.TypeOf(5));
			Assert.Empty(empty.Progression.MilestoneNames());
			Assert.False(empty.Mods.ExtraDetailing);
		}

		[Fact]
		public void TheCatalogNamesMilestonesFromItsOwnIndex()
		{
			var hospital = TestPrefabs.Entry(7, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Health);
			hospital.UnlockMilestone = 1;
			var index = new CatalogIndex(progression: Progression(milestones: new() { [1] = "Tiny Village" }));
			index.File(hospital);
			index.IsReady = true;

			var page = new BuildingCatalogAdapter()
				.Build(
					new CatalogSource(index, new PlacedUniques(), 1),
					new BuildingCatalogQuery(GroupBy: BuildingCatalogGrouping.Progression),
					VanillaToolbarSelection.None)
				.Page;

			Assert.Equal(new[] { "Tiny Village" }, Assert.Single(page.Items).GroupPath);
		}

		[Fact]
		public void WithoutExtraDetailingInItsIndexALaneIsNotIndexed()
		{
			// Uninitialized, because a prefab is a Unity ScriptableObject. The processor
			// answers from the index's flag before it reads the prefab or the entity.
			var lane = (PrefabBase)RuntimeHelpers.GetUninitializedObject(typeof(NetLaneGeometryPrefab));

			Assert.False(new LanesPrefabCategoryProcessor(default).TryCreatePrefabIndex(
				lane,
				default(Entity),
				new CatalogIndex(mods: new ModCompatibility(ExtraDetailing: false, RoadBuilder: true)),
				out var entry));
			Assert.Null(entry);
		}
	}
}
