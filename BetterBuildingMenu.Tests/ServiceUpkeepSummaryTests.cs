using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// What a building costs to run, read from the ServiceUpkeepData buffer the way
	/// the game reads it: Money entries sum to the upkeep, and every other resource
	/// is named on its own.
	/// </summary>
	public sealed class ServiceUpkeepSummaryTests
	{
		[Fact]
		public void MoneyEntriesAreTheUpkeepAndResourcesAreNamed()
		{
			var summary = ServiceUpkeepSummary.Summarise(new[] { ("Money", 5000), ("Coal", 4000) });

			Assert.Equal(5000, summary.Money);
			Assert.Equal(new[] { ("Coal", 4000) }, summary.Resources);
		}

		[Fact]
		public void EveryMoneyEntryCountsAndNoneIsZero()
		{
			Assert.Equal(7000, ServiceUpkeepSummary.Summarise(new[] { ("Money", 7000) }).Money);
			// Two entries, as when BuildingInitializeSystem copies a ConsumptionData
			// upkeep beside one the author put in the buffer: the game warns, and its
			// tooltip sums both.
			Assert.Equal(8000, ServiceUpkeepSummary.Summarise(new[] { ("Money", 5000), ("Money", 3000) }).Money);
			// A buffer with no money in it: vanilla still draws the line, at nothing.
			Assert.Equal(0, ServiceUpkeepSummary.Summarise(new[] { ("Coal", 4000) }).Money);
			Assert.Equal(0, ServiceUpkeepSummary.Summarise(System.Array.Empty<(string, int)>()).Money);
		}

		[Fact]
		public void ZeroAndNegativeAmountsAreNotFacts()
		{
			var summary = ServiceUpkeepSummary.Summarise(new[] { ("Coal", 0), ("Oil", -5), ("Wood", 12) });

			Assert.Equal(new[] { ("Wood", 12) }, summary.Resources);
		}
	}
}
