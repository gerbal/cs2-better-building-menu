using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// An index entry, projected into the row the asset menu draws, through the adapter.
	/// </summary>
	/// <remarks>
	/// Each test builds its own small index and source, so no test shares state with
	/// another.
	/// </remarks>
	public sealed class CatalogProjectionTests
	{
		private static PrefabIndex Hospital()
		{
			var entry = TestPrefabs.Entry(11, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Health);
			entry.PrefabName = "Hospital01";
			entry.Name = "Hospital";
			entry.Thumbnail = "Media/Game/Icons/Hospital.svg";
			entry.IsUnique = true;
			entry.ServiceFacts.Add(new ServiceFact("Capacity", 200));
			return entry;
		}

		private static BuildingCatalogEntry ProjectOnly(CatalogSource source, BuildingCatalogAdapter? adapter = null) =>
			Assert.Single((adapter ?? new BuildingCatalogAdapter())
				.Build(source, new BuildingCatalogQuery(), VanillaToolbarSelection.None)
				.Page.Items);

		[Fact]
		public void APrewarmedMenuOpensFromTheProjectionCache()
		{
			var source = new CatalogSource(TestPrefabs.ReadyIndex(Hospital()), new PlacedUniques(), 1);
			var adapter = new BuildingCatalogAdapter();

			Assert.Equal(1, adapter.Prewarm(source, new[] { "Health & Deathcare" }, VanillaToolbarSelection.None));

			adapter.BeginRefresh();
			_ = adapter.Build(source, new BuildingCatalogQuery(UiMenu: "Health & Deathcare"), VanillaToolbarSelection.None).Page;
			Assert.True(adapter.LastProjectionWasHit);

			// One it was not given still projects on its first open.
			adapter.BeginRefresh();
			_ = adapter.Build(source, new BuildingCatalogQuery(UiMenu: "Roads"), VanillaToolbarSelection.None).Page;
			Assert.False(adapter.LastProjectionWasHit);
		}

		[Fact]
		public void AnEntryIsProjectedWithItsNameAndFacts()
		{
			var row = ProjectOnly(new CatalogSource(TestPrefabs.ReadyIndex(Hospital()), new PlacedUniques(), 1));

			Assert.Equal(11, row.Id);
			Assert.Equal("Hospital", row.Name);
			Assert.Equal("Hospital01", row.PrefabName);
			Assert.True(row.IsUnique);
			Assert.Equal("Capacity", Assert.Single(row.ServiceFacts ?? System.Array.Empty<ServiceFact>()).Key);
		}

		[Fact]
		public void AlreadyBuiltComesFromTheSourcesPlacedUniques()
		{
			var placed = new PlacedUniques();
			placed.Set(11, placed: true);

			Assert.True(ProjectOnly(new CatalogSource(TestPrefabs.ReadyIndex(Hospital()), placed, 1)).IsAlreadyBuilt);
			Assert.False(ProjectOnly(new CatalogSource(TestPrefabs.ReadyIndex(Hospital()), new PlacedUniques(), 1)).IsAlreadyBuilt);
		}

		[Fact]
		public void TheSilhouetteComesFromTheLookupTheAdapterWasGiven()
		{
			var adapter = new BuildingCatalogAdapter(thumbnail => "silhouette:" + thumbnail);

			var row = ProjectOnly(new CatalogSource(TestPrefabs.ReadyIndex(Hospital()), new PlacedUniques(), 1), adapter);

			Assert.Equal("silhouette:" + row.Thumbnail, row.SilhouetteThumbnail);
			Assert.Null(ProjectOnly(new CatalogSource(TestPrefabs.ReadyIndex(Hospital()), new PlacedUniques(), 1)).SilhouetteThumbnail);
		}

		[Fact]
		public void AServiceUpgradeIsIndexedButNotListed()
		{
			var wing = TestPrefabs.Entry(12, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Health);
			wing.IsServiceUpgrade = true;

			var index = TestPrefabs.ReadyIndex(Hospital(), wing);
			var page = new BuildingCatalogAdapter()
				.Build(new CatalogSource(index, new PlacedUniques(), 1), new BuildingCatalogQuery(), VanillaToolbarSelection.None)
				.Page;

			Assert.NotNull(index.Get(12));
			Assert.Equal(new[] { 11 }, page.Items.Select(item => item.Id));
		}

		[Fact]
		public void TwoEntriesSharingAPrefabNameResolveToTheFirstInNameOrder()
		{
			// Two prefab types can carry one name. The picker asks the index's own map,
			// which answers with the first entry in name order.
			var later = Hospital();
			later.Name = "Hospital B";
			var earlier = TestPrefabs.Entry(12, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Health);
			earlier.PrefabName = "Hospital01";
			earlier.Name = "Hospital A";

			var row = new BuildingCatalogAdapter().EntryForPrefabName(
				new CatalogSource(TestPrefabs.ReadyIndex(later, earlier), new PlacedUniques(), 1),
				"Hospital01");

			Assert.Equal(12, row?.Id);
		}

		[Fact]
		public void AnUnreadyIndexProjectsNothingItHolds()
		{
			var index = new CatalogIndex();
			index.File(Hospital());
			var source = new CatalogSource(index, new PlacedUniques(), 1);
			var adapter = new BuildingCatalogAdapter();

			Assert.Empty(adapter.Build(source, new BuildingCatalogQuery(), VanillaToolbarSelection.None).Page.Items);
			Assert.Null(adapter.EntryForPrefabName(source, "Hospital01"));

			// As a pass does: ready, then a new generation, which the adapter's caches key on.
			index.IsReady = true;
			source = source with { Generation = 2 };

			Assert.Single(adapter.Build(source, new BuildingCatalogQuery(), VanillaToolbarSelection.None).Page.Items);
			Assert.NotNull(adapter.EntryForPrefabName(source, "Hospital01"));
		}
	
		private static PrefabIndex Clinic()
		{
			var entry = TestPrefabs.Entry(12, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Health);
			entry.PrefabName = "Clinic01";
			entry.Name = "Clinic";
			return entry;
		}

		private static BuildingCatalogEntry[] Rows(BuildingCatalogAdapter adapter, CatalogSource source)
		{
			adapter.BeginRefresh();
			return adapter.Build(source, new BuildingCatalogQuery(), VanillaToolbarSelection.None).MenuSet;
		}

		[Fact]
		public void AnUnlockUpdatesTheCachedRowsWithoutProjectingAgain()
		{
			var hospital = Hospital();
			hospital.IsLocked = true;
			hospital.UnlockMilestone = 3;
			hospital.UnlockRequirements = new[] { "Reach milestone 3" };
			var source = new CatalogSource(TestPrefabs.ReadyIndex(hospital, Clinic()), new PlacedUniques(), 1) { ContentGeneration = 1 };
			var adapter = new BuildingCatalogAdapter();
			var before = Rows(adapter, source);

			// As the unlock path does: the index's own entry changes, and only the generation moves.
			hospital.IsLocked = false;
			hospital.UnlockRequirements = System.Array.Empty<string>();
			var after = Rows(adapter, source with { Generation = 2 });

			Assert.True(adapter.LastProjectionWasHit);
			var unlocked = after.Single(row => row.Id == 11);
			Assert.False(unlocked.IsLocked);
			Assert.Equal(3, unlocked.UnlockMilestone);
			Assert.Empty(unlocked.UnlockRequirements ?? System.Array.Empty<string>());
			Assert.Same(before.Single(row => row.Id == 12), after.Single(row => row.Id == 12));
		}

		[Fact]
		public void APlacedUniqueUpdatesTheCachedRowsWithoutProjectingAgain()
		{
			var placed = new PlacedUniques();
			var source = new CatalogSource(TestPrefabs.ReadyIndex(Hospital(), Clinic()), placed, 1) { ContentGeneration = 1 };
			var adapter = new BuildingCatalogAdapter();
			var before = Rows(adapter, source);
			Assert.False(before.Single(row => row.Id == 11).IsAlreadyBuilt);

			placed.Set(11, placed: true);
			var built = Rows(adapter, source with { Generation = 2 });

			Assert.True(adapter.LastProjectionWasHit);
			Assert.True(built.Single(row => row.Id == 11).IsAlreadyBuilt);
			Assert.Same(before.Single(row => row.Id == 12), built.Single(row => row.Id == 12));

			placed.Set(11, placed: false);
			Assert.False(Rows(adapter, source with { Generation = 3 }).Single(row => row.Id == 11).IsAlreadyBuilt);
		}

		[Fact]
		public void ANewContentGenerationProjectsAgain()
		{
			var hospital = Hospital();
			var source = new CatalogSource(TestPrefabs.ReadyIndex(hospital), new PlacedUniques(), 1) { ContentGeneration = 1 };
			var adapter = new BuildingCatalogAdapter();
			_ = Rows(adapter, source);

			hospital.Name = "General Hospital";
			var renamed = Rows(adapter, source with { Generation = 2, ContentGeneration = 2 });

			Assert.False(adapter.LastProjectionWasHit);
			Assert.Equal("General Hospital", Assert.Single(renamed).Name);
		}

		[Fact]
		public void WithoutAContentGenerationEveryGenerationProjectsAgain()
		{
			// What a source that does not tell the two apart gets: the old rule, any change rebuilds.
			var hospital = Hospital();
			var source = new CatalogSource(TestPrefabs.ReadyIndex(hospital), new PlacedUniques(), 1);
			var adapter = new BuildingCatalogAdapter();
			_ = Rows(adapter, source);

			hospital.Name = "General Hospital";

			Assert.Equal("General Hospital", Assert.Single(Rows(adapter, source with { Generation = 2 })).Name);
			Assert.False(adapter.LastProjectionWasHit);
		}
	}
}
