using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// What a building costs to run, read the way the game reads it: the
	/// ServiceUpkeepData buffer, where BuildingInitializeSystem also copies a
	/// ConsumptionData upkeep as a Money entry. Money entries sum to the upkeep;
	/// every other resource is named on its own.
	/// </summary>
	public sealed class ServiceUpkeepSummaryTests
	{
		[Fact]
		public void MoneyEntriesAreTheUpkeepAndResourcesAreNamed()
		{
			var summary = ServiceUpkeepSummary.Summarise(0, new[] { ("Money", 5000), ("Coal", 4000) });

			Assert.Equal(5000, summary.Money);
			Assert.Equal(new[] { ("Coal", 4000) }, summary.Resources);
		}

		[Fact]
		public void TheConsumptionFigureStandsInOnlyWhenTheBufferHasNoMoney()
		{
			// A school: no ConsumptionData upkeep, money in the buffer.
			Assert.Equal(7000, ServiceUpkeepSummary.Summarise(0, new[] { ("Money", 7000) }).Money);
			// A plain placeable with no buffer at all.
			Assert.Equal(3000, ServiceUpkeepSummary.Summarise(3000, System.Array.Empty<(string, int)>()).Money);
			// Both present: the game warns and the buffer already carries the
			// copy, so counting the consumption figure too would double it.
			Assert.Equal(5000, ServiceUpkeepSummary.Summarise(5000, new[] { ("Money", 5000) }).Money);
		}

		[Fact]
		public void ZeroAndNegativeAmountsAreNotFacts()
		{
			var summary = ServiceUpkeepSummary.Summarise(0, new[] { ("Coal", 0), ("Oil", -5), ("Wood", 12) });

			Assert.Equal(new[] { ("Wood", 12) }, summary.Resources);
		}
	}
}
