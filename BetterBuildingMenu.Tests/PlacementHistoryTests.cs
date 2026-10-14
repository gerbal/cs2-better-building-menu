using BetterBuildingMenu.Domain.Placement;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// What the history keeps per game menu: the counts, the latest placement and the two
	/// slot holders, and how counts age at each launch.
	/// </summary>
	public sealed class PlacementHistoryTests
	{
		private const string Roads = "Roads";

		private static PlacementHistory Placed(params string[] prefabs)
		{
			var history = new PlacementHistory();

			foreach (var prefab in prefabs)
			{
				history.Record(Roads, prefab);
			}

			return history;
		}

		private static string[] Repeat(string prefab, int times) => Enumerable.Repeat(prefab, times).ToArray();

		private static KeyValuePair<string, float> Count(string prefab, float count) => new(prefab, count);

		[Fact]
		public void APlacementCountsOneSetsLatestAndFillsAnEmptySlot()
		{
			var history = Placed("Small Road");
			var roads = history.Menus[Roads];

			Assert.Equal(1f, roads.Counts["Small Road"]);
			Assert.Equal("Small Road", roads.Latest);
			Assert.Equal(new[] { "Small Road" }, roads.Held);
			Assert.True(history.IsDirty);
		}

		[Fact]
		public void TheFirstTwoPrefabsHoldTheSlotsMostPlacedFirst()
		{
			var roads = Placed("Small Road", "Medium Road", "Medium Road").Menus[Roads];

			Assert.Equal(new[] { "Medium Road", "Small Road" }, roads.Held);
		}

		[Fact]
		public void ANewcomerTakesTheWeakerSlotOnceItHasTheMarginOverIt()
		{
			var history = new PlacementHistory();
			history.Restore(Roads, new[] { Count("Small Road", 4f), Count("Medium Road", 4f), Count("Large Road", 3.75f) }, "Small Road", new[] { "Small Road", "Medium Road" });

			history.Record(Roads, "Large Road");

			// 4.75 against 4 falls short: the margin asks for 4 x 1.25 = 5.
			Assert.Equal(new[] { "Small Road", "Medium Road" }, history.Menus[Roads].Held);

			var placed = Placed(Repeat("Small Road", 4).Concat(Repeat("Medium Road", 4)).Concat(Repeat("Large Road", 5)).ToArray());

			// Five against four is the margin exactly, and takes the slot.
			Assert.Equal(new[] { "Large Road", "Small Road" }, placed.Menus[Roads].Held);
		}

		[Fact]
		public void AHolderPlacedAgainMovesUpRatherThanOut()
		{
			var roads = Placed("Small Road", "Medium Road", "Medium Road", "Small Road", "Small Road").Menus[Roads];

			Assert.Equal(new[] { "Small Road", "Medium Road" }, roads.Held);
		}

		[Fact]
		public void LatestIsTheLastPlacementEvenWithoutASlot()
		{
			var roads = Placed("Small Road", "Small Road", "Medium Road", "Medium Road", "Gravel Road").Menus[Roads];

			Assert.Equal("Gravel Road", roads.Latest);
			Assert.Equal(new[] { "Small Road", "Medium Road" }, roads.Held);
		}

		[Fact]
		public void EachMenuKeepsItsOwnCounts()
		{
			var history = Placed("Small Road");
			history.Record("Parks & Recreation", "Plaza");

			Assert.Equal(new[] { "Small Road" }, history.Menus[Roads].Counts.Keys);
			Assert.Equal(new[] { "Plaza" }, history.Menus["Parks & Recreation"].Counts.Keys);
		}

		[Fact]
		public void DecayHalvesEveryCountAndLeavesTheHistoryClean()
		{
			var history = new PlacementHistory();
			history.Restore(Roads, new[] { Count("Small Road", 3f), Count("Medium Road", 1f) }, "Small Road", new[] { "Small Road", "Medium Road" });

			history.Decay();

			Assert.Equal(1.5f, history.Menus[Roads].Counts["Small Road"]);
			Assert.Equal(0.5f, history.Menus[Roads].Counts["Medium Road"]);
			Assert.False(history.IsDirty);
		}

		[Fact]
		public void DecayDropsCountsUnderAHalfButNeverLatestOrAHolder()
		{
			var history = new PlacementHistory();
			history.Restore(
				Roads,
				new[] { Count("Small Road", 4f), Count("Medium Road", 0.75f), Count("Gravel Road", 0.75f), Count("Alley", 0.5f) },
				"Alley",
				new[] { "Small Road", "Medium Road" });

			history.Decay();

			Assert.Equal(new[] { "Alley", "Medium Road", "Small Road" }, history.Menus[Roads].Counts.Keys.OrderBy(name => name, StringComparer.Ordinal));
		}

		[Fact]
		public void DecayKeepsEightPerMenuCountingLatestAndTheHolders()
		{
			var prefabs = Enumerable.Range(1, 12).Select(number => $"Road{number:00}").ToArray();
			var history = new PlacementHistory();
			// Road01 is placed 24 times, down to Road12 twice; the latest is the least placed.
			history.Restore(Roads, prefabs.Select((prefab, index) => Count(prefab, 2f * (12 - index))), "Road12", new[] { "Road01", "Road02" });

			history.Decay();

			Assert.Equal(
				new[] { "Road01", "Road02", "Road03", "Road04", "Road05", "Road06", "Road07", "Road12" },
				history.Menus[Roads].Counts.Keys.OrderBy(name => name, StringComparer.Ordinal));
		}

		[Fact]
		public void DecayForgetsAMenuWithNothingLeft()
		{
			var history = new PlacementHistory();
			history.Restore("Parks & Recreation", new[] { Count("Plaza", 0.75f) }, null, Array.Empty<string>());

			history.Decay();

			Assert.Empty(history.Menus);
		}

		[Fact]
		public void AReadOnlyHistoryRecordsNothing()
		{
			var history = new PlacementHistory(readOnly: true);

			history.Record(Roads, "Small Road");

			Assert.Empty(history.Menus);
			Assert.False(history.IsDirty);
		}

		[Fact]
		public void RestoreKeepsOnlyWhatIsWellFormed()
		{
			var history = new PlacementHistory();
			history.Restore(
				Roads,
				new[]
				{
					Count("Small Road", 2f), Count("Medium Road", 1f), Count("Negative", -1f), Count("Nothing", 0f),
					Count("NaN", float.NaN), Count("Endless", float.PositiveInfinity), Count(" ", 3f),
				},
				"Gone Road",
				new[] { "Medium Road", "Medium Road", "Gone Road", "Small Road", "Negative" });

			var roads = history.Menus[Roads];

			Assert.Equal(new[] { "Medium Road", "Small Road" }, roads.Counts.Keys.OrderBy(name => name, StringComparer.Ordinal));
			Assert.Null(roads.Latest);
			Assert.Equal(new[] { "Small Road", "Medium Road" }, roads.Held);
			Assert.False(history.IsDirty);
		}
	}
}
