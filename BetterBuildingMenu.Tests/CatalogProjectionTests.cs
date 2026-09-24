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
	/// Each test builds its own small index and source, so nothing here touches the
	/// indexer or shares state with another test.
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

		private static CatalogIndex ReadyIndex(params PrefabIndex[] entries)
		{
			var index = new CatalogIndex();

			foreach (var entry in entries)
			{
				index.File(entry);
			}

			index.IsReady = true;
			return index;
		}

		private static BuildingCatalogEntry ProjectOnly(CatalogSource source, BuildingCatalogAdapter? adapter = null) =>
			Assert.Single((adapter ?? new BuildingCatalogAdapter())
				.Build(source, new BuildingCatalogQuery(), VanillaToolbarSelection.None)
				.Page.Items);

		[Fact]
		public void AnEntryIsProjectedWithItsNameAndFacts()
		{
			var row = ProjectOnly(new CatalogSource(ReadyIndex(Hospital()), new PlacedUniques(), 1));

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

			Assert.True(ProjectOnly(new CatalogSource(ReadyIndex(Hospital()), placed, 1)).IsAlreadyBuilt);
			Assert.False(ProjectOnly(new CatalogSource(ReadyIndex(Hospital()), new PlacedUniques(), 1)).IsAlreadyBuilt);
		}

		[Fact]
		public void TheSilhouetteComesFromTheLookupTheAdapterWasGiven()
		{
			var adapter = new BuildingCatalogAdapter(thumbnail => "silhouette:" + thumbnail);

			var row = ProjectOnly(new CatalogSource(ReadyIndex(Hospital()), new PlacedUniques(), 1), adapter);

			Assert.Equal("silhouette:" + row.Thumbnail, row.SilhouetteThumbnail);
			Assert.Null(ProjectOnly(new CatalogSource(ReadyIndex(Hospital()), new PlacedUniques(), 1)).SilhouetteThumbnail);
		}

		[Fact]
		public void AServiceUpgradeIsIndexedButNotListed()
		{
			var wing = TestPrefabs.Entry(12, PrefabCategory.ServiceBuildings, PrefabSubCategory.ServiceBuildings_Health);
			wing.IsServiceUpgrade = true;

			var page = new BuildingCatalogAdapter()
				.Build(new CatalogSource(ReadyIndex(Hospital(), wing), new PlacedUniques(), 1), new BuildingCatalogQuery(), VanillaToolbarSelection.None)
				.Page;

			Assert.Equal(new[] { 11 }, page.Items.Select(item => item.Id));
		}
	}
}
