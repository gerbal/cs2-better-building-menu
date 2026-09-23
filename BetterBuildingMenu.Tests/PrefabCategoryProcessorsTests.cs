using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Interfaces;
using BetterBuildingMenu.Utilities.PrefabCategoryProcessor;

using System.Collections.Generic;
using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The processors an index pass runs, and the report of prefabs two of them claimed.
	/// </summary>
	public sealed class PrefabCategoryProcessorsTests
	{
		private static List<System.Type> Listed() =>
			PrefabCategoryProcessors.InRunOrder.Select(entry => entry.Type).ToList();

		[Fact]
		public void ListsEveryProcessorInTheAssemblyOnce()
		{
			// The list replaced discovery by reflection. A processor written and
			// left off it would index nothing, silently.
			var defined = typeof(IPrefabCategoryProcessor).Assembly.GetTypes()
				.Where(type => typeof(IPrefabCategoryProcessor).IsAssignableFrom(type) && !type.IsAbstract && !type.IsInterface)
				.Select(type => type.FullName)
				.OrderBy(name => name)
				.ToList();

			var listed = Listed().Select(type => type.FullName).ToList();

			Assert.Equal(listed.Count, listed.Distinct().Count());
			Assert.Equal(defined, listed.OrderBy(name => name).ToList());
		}

		[Fact]
		public void RunsTheMenuPlacedCatchAllLast()
		{
			// It claims only what nothing else did, so anything after it could take
			// a prefab it had already given a placeholder category.
			Assert.Equal(typeof(MenuPlacedPrefabCategoryProcessor), Listed().Last());
		}

		[Fact]
		public void ReportsNothingWhenNoPrefabIsClaimedTwice()
		{
			var claims = new Dictionary<string, List<int>>
			{
				["Roads"] = new() { 1, 2 },
				["Props"] = new() { 3 },
			};

			Assert.Empty(ProcessorOverlap.Find(new[] { "Roads", "Props" }, claims));
		}

		[Fact]
		public void NamesThePairOnceWithHowManyPrefabsItShared()
		{
			var claims = new Dictionary<string, List<int>>
			{
				["Props"] = new() { 1, 2, 3 },
				["SportProps"] = new() { 2, 3, 4 },
			};

			var pair = Assert.Single(ProcessorOverlap.Find(new[] { "Props", "SportProps" }, claims));

			Assert.Equal(new ProcessorOverlap.Pair("Props", "SportProps", 2, 2), pair);
		}

		[Fact]
		public void TakesEarlierAndLaterFromTheRunOrder()
		{
			// The census is a dictionary with no order of its own; only the order
			// the pass ran the processors says whose entry stands.
			var claims = new Dictionary<string, List<int>>
			{
				["SportProps"] = new() { 7 },
				["Props"] = new() { 7 },
			};

			var pair = Assert.Single(ProcessorOverlap.Find(new[] { "Props", "SportProps" }, claims));

			Assert.Equal(("Props", "SportProps"), (pair.Earlier, pair.Later));
		}

		[Fact]
		public void FollowsAPrefabThroughEachProcessorThatReplacedIt()
		{
			var claims = new Dictionary<string, List<int>>
			{
				["A"] = new() { 9 },
				["B"] = new() { 9 },
				["C"] = new() { 9 },
			};

			var pairs = ProcessorOverlap.Find(new[] { "A", "B", "C", "Unused" }, claims)
				.Select(pair => (pair.Earlier, pair.Later))
				.ToList();

			Assert.Equal(new[] { ("A", "B"), ("B", "C") }, pairs);
		}
	}
}
