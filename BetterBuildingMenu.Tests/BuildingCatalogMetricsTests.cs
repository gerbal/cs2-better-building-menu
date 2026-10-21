using System.Linq;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The table of range metrics, which the parser, the query, the published state and the
	/// bounds all read: a row that named one metric's field in one column and another's in the
	/// next would move a range from one metric to another without failing anything else.
	/// </summary>
	public class BuildingCatalogMetricsTests
	{
		[Fact]
		public void ListsTheSixRangeMetricsInTheDrawersOrder()
		{
			Assert.Equal(
				new[] { "cost", "upkeep", "workers", "capacity", "lotWidth", "lotDepth" },
				BuildingCatalogMetrics.All.Select(metric => metric.Id));
		}

		[Fact]
		public void EachMetricReadsBackTheRangeItWroteIntoTheQuery()
		{
			foreach (BuildingCatalogMetric metric in BuildingCatalogMetrics.All)
			{
				BuildingCatalogQuery query = metric.QueryWith(new BuildingCatalogQuery(), 2, 7);

				Assert.Equal(2, metric.QueryMin(query));
				Assert.Equal(7, metric.QueryMax(query));
				Assert.All(
					BuildingCatalogMetrics.All.Where(other => other != metric),
					other => Assert.Null(other.QueryMin(query) ?? other.QueryMax(query)));
			}
		}

		[Fact]
		public void EachMetricPublishesItsQueryRangeUnderItsOwnKeys()
		{
			foreach (BuildingCatalogMetric metric in BuildingCatalogMetrics.All)
			{
				BuildingCatalogMetricRangeState state = BuildingCatalogMetricRangeState.FromQuery(
					metric.QueryWith(new BuildingCatalogQuery(), 2, 7));

				Assert.Equal(2, metric.StateMin(state));
				Assert.Equal(7, metric.StateMax(state));
				Assert.True(state.HasSelection);
				Assert.All(
					BuildingCatalogMetrics.All.Where(other => other != metric),
					other => Assert.Null(other.StateMin(state) ?? other.StateMax(state)));
			}
		}

		[Fact]
		public void EachMetricBoundsTheViewByItsOwnValue()
		{
			BuildingCatalogEntry small = TestEntries.Make(1, lotWidth: 1, lotDepth: 2) with
			{
				ConstructionCost = 3, Upkeep = 4, Workers = 5, Capacity = 6,
			};
			BuildingCatalogEntry large = TestEntries.Make(2, lotWidth: 11, lotDepth: 12) with
			{
				ConstructionCost = 13, Upkeep = 14, Workers = 15, Capacity = 16,
			};

			BuildingCatalogMetricRangeState bounds = BuildingCatalogAdapter.MetricBoundsOf(new[] { large, small });

			Assert.Equal(
				new double?[] { 3, 13, 4, 14, 5, 15, 6, 16, 1, 11, 2, 12 },
				BuildingCatalogMetrics.All.SelectMany(metric => new[] { metric.StateMin(bounds), metric.StateMax(bounds) }));
		}

		[Fact]
		public void FindsAMetricByItsIdInAnyCase()
		{
			Assert.True(BuildingCatalogMetrics.TryFind(" LOTWIDTH ", out BuildingCatalogMetric? metric));
			Assert.Equal("lotWidth", metric!.Id);
			Assert.True(metric.Integer);
			Assert.False(BuildingCatalogMetrics.TryFind("level", out _));
			Assert.False(BuildingCatalogMetrics.TryFind(null, out _));
		}
	}
}
