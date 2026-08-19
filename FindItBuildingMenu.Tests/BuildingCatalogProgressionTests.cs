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
	}
}
