using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// An index entry, projected into the row the panel draws, through the adapter.
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
			// which answers with the first entry in name order, as a partial pass does.
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
	}
}
