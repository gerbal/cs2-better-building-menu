using System;
using System.Linq;

using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Services;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The spread each metric has in the current view, which is what lets the
	/// range fields open at real numbers instead of blank.
	/// </summary>
	public class MetricBoundsTests
	{
		private static BuildingCatalogEntry Entry(int id, double? cost, double? workers, int lotWidth) =>
			new BuildingCatalogEntry(
				Id: id,
				PrefabName: $"P{id}",
				Name: $"P{id}",
				Category: "ServiceBuildings",
				SubCategory: "Police",
				Thumbnail: "",
				LotWidth: lotWidth,
				LotDepth: 4,
				BuildingLevel: 1,
				ZoneType: 0,
				HasParking: false,
				IsUniqueMesh: false,
				IsVanilla: true,
				IsFavorited: false,
				PdxModsId: "",
				ConstructionCost: cost,
				Workers: workers);

		private static readonly BuildingCatalogEntry[] Source =
		{
			Entry(1, cost: 30_000, workers: 10, lotWidth: 2),
			Entry(2, cost: 650_000, workers: null, lotWidth: 6),
			Entry(3, cost: 120_000, workers: 40, lotWidth: 4),
		};

		[Fact]
		public void ReportsTheLowestAndHighestPresent()
		{
			BuildingCatalogMetricRangeState bounds = BuildingCatalogAdapter.MetricBoundsOf(Source);

			Assert.Equal(30_000, bounds.MinCost);
			Assert.Equal(650_000, bounds.MaxCost);
			Assert.Equal(2, bounds.MinLotWidth);
			Assert.Equal(6, bounds.MaxLotWidth);
		}

		[Fact]
		public void SkipsEntriesThatDoNotCarryTheMetric()
		{
			// Most assets have no worker count. The bound describes the ones that
			// do, rather than being dragged to zero by the ones that do not.
			BuildingCatalogMetricRangeState bounds = BuildingCatalogAdapter.MetricBoundsOf(Source);

			Assert.Equal(10, bounds.MinWorkers);
			Assert.Equal(40, bounds.MaxWorkers);
		}

		[Fact]
		public void ReportsNothingWhenNoEntryCarriesTheMetric()
		{
			// Null rather than zero: a floor of 0 on a menu where nothing employs
			// anyone would state a range that does not exist.
			BuildingCatalogMetricRangeState bounds = BuildingCatalogAdapter.MetricBoundsOf(
				new[] { Entry(9, cost: 500, workers: null, lotWidth: 2) });

			Assert.Null(bounds.MinWorkers);
			Assert.Null(bounds.MaxWorkers);
		}

		[Fact]
		public void AnEmptyViewHasNoBoundsAtAll()
		{
			BuildingCatalogMetricRangeState bounds = BuildingCatalogAdapter.MetricBoundsOf(
				Array.Empty<BuildingCatalogEntry>());

			Assert.Null(bounds.MinCost);
			Assert.Null(bounds.MaxCost);
		}

		[Fact]
		public void ASingleEntryBoundsToItself()
		{
			// Min equals max, which is honest: there is one value and the field
			// should say so rather than pretending to a range.
			BuildingCatalogMetricRangeState bounds = BuildingCatalogAdapter.MetricBoundsOf(
				new[] { Entry(9, cost: 500, workers: 3, lotWidth: 2) });

			Assert.Equal(500, bounds.MinCost);
			Assert.Equal(500, bounds.MaxCost);
		}
	}
}
