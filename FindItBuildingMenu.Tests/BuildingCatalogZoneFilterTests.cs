using System.Collections.Generic;
using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class BuildingCatalogZoneFilterTests
	{
		private static BuildingCatalogEntry Entry(int id, string name, ZoneTypeFilter zone) =>
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
				ZoneType: zone,
				HasParking: false,
				IsUniqueMesh: false,
				IsVanilla: true,
				IsFavorited: false,
				PdxModsId: "");

		private static readonly List<BuildingCatalogEntry> Source = new()
		{
			Entry(1, "Low House", ZoneTypeFilter.Low),
			Entry(2, "Row House", ZoneTypeFilter.Row),
			Entry(3, "Medium Block", ZoneTypeFilter.Medium),
			Entry(4, "High Tower", ZoneTypeFilter.High),
			Entry(5, "Signature Tower", ZoneTypeFilter.Signature),
		};

		[Fact]
		public void ReturnsEverythingWhenNoZoneDensityIsSelected()
		{
			// Zone density was indexed on every entry and the engine already
			// sorted by it, but the query had no field for it, so the density
			// levels the vanilla Zones menu is organised around could not be
			// filtered at all.
			var page = BuildingCatalogQueryEngine.Query(Source, new BuildingCatalogQuery());

			Assert.Equal(5, page.TotalCount);
		}

		[Fact]
		public void NarrowsToASingleDensity()
		{
			var page = BuildingCatalogQueryEngine.Query(
				Source,
				new BuildingCatalogQuery(ZoneTypes: new[] { "High" }));

			Assert.Equal(1, page.TotalCount);
			Assert.Equal("High Tower", page.Items[0].Name);
		}

		[Fact]
		public void TreatsSeveralDensitiesAsAUnion()
		{
			// The vanilla menu lets you look at low and medium together, so the
			// selection has to widen rather than intersect.
			var page = BuildingCatalogQueryEngine.Query(
				Source,
				new BuildingCatalogQuery(ZoneTypes: new[] { "Low", "Medium" }));

			Assert.Equal(2, page.TotalCount);
		}

		[Fact]
		public void MatchesDensityNamesCaseInsensitively()
		{
			var page = BuildingCatalogQueryEngine.Query(
				Source,
				new BuildingCatalogQuery(ZoneTypes: new[] { "sIGNATURE" }));

			Assert.Equal(1, page.TotalCount);
		}

		[Fact]
		public void IgnoresADensityNameItDoesNotRecognise()
		{
			// An unknown name must not silently match everything, which would
			// make a broken preset look like a working one.
			var page = BuildingCatalogQueryEngine.Query(
				Source,
				new BuildingCatalogQuery(ZoneTypes: new[] { "Enormous" }));

			Assert.Equal(0, page.TotalCount);
		}

		[Fact]
		public void ResetsTheWindowWhenTheZoneSelectionChanges()
		{
			// Same contract the other predicates already honour: changing what
			// is being filtered must not leave the player holding a window they
			// grew against a different result set.
			var deep = new BuildingCatalogQuery(Offset: 400, Limit: 600);
			var narrowed = deep with { ZoneTypes = new[] { "Low" } };

			Assert.Equal(0, narrowed.ResetWindowIfPredicatesChanged(deep).Offset);
			Assert.Equal(BuildingCatalogQuery.DefaultLimit, narrowed.ResetWindowIfPredicatesChanged(deep).Limit);
		}
	}
}
