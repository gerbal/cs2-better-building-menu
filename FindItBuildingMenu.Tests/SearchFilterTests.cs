using FindItBuildingMenu.Utilities;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// Filtering the search set: what it keeps, and what it costs.
	/// </summary>
	/// <remarks>
	/// This walked the list calling List.RemoveAt on every non-match, which
	/// shifts every later element — an O(n^2) shape. It is NOT why search was
	/// slow: measured, the in-place form costs 13ms over 25,000 items, while
	/// the search that prompted the change took 2.7s, all of it in the
	/// predicate (cm-yfd5). These tests pin the behaviour, not a speed.
	/// </remarks>
	public sealed class SearchFilterTests
	{
		// A stand-in for PrefabIndex, which can only be built from a Unity
		// PrefabBase. ApplyFilters is generic precisely so this rule can be
		// tested without the engine.
		private sealed record Item(int Id, string Name);

		private static Item Prefab(int id, string name) => new(id, name);

		private static List<Func<Item, bool>> Filters(params Func<Item, bool>[] filters) =>
			filters.ToList();

		[Fact]
		public void KeepsWhatPassesEveryFilter()
		{
			var prefabs = new[] { Prefab(1, "Hospital"), Prefab(2, "Clinic"), Prefab(3, "Hospice") };

			var kept = FindItUtil.ApplyFilters(
				prefabs,
				Filters(p => p.Name.StartsWith("Hos", StringComparison.Ordinal)),
				CancellationToken.None);

			Assert.Equal(new[] { 1, 3 }, kept.Select(p => p.Id).ToArray());
		}

		[Fact]
		public void RequiresEveryFilterRatherThanAny()
		{
			var prefabs = new[] { Prefab(1, "Hospital"), Prefab(2, "Hospice") };

			var kept = FindItUtil.ApplyFilters(
				prefabs,
				Filters(
					p => p.Name.StartsWith("Hos", StringComparison.Ordinal),
					p => p.Name.EndsWith("tal", StringComparison.Ordinal)),
				CancellationToken.None);

			Assert.Equal(1, Assert.Single(kept).Id);
		}

		[Fact]
		public void PreservesTheOrderItWasGiven()
		{
			// The caller hands over the index's own order and the catalog sorts
			// afterwards; reordering here would be an invisible second opinion.
			var prefabs = Enumerable.Range(1, 20).Select(i => Prefab(i, "P" + i)).ToArray();

			var kept = FindItUtil.ApplyFilters(prefabs, Filters(p => p.Id % 2 == 0), CancellationToken.None);

			Assert.Equal(Enumerable.Range(1, 20).Where(i => i % 2 == 0).ToArray(), kept.Select(p => p.Id).ToArray());
		}

		[Fact]
		public void LeavesTheSourceCollectionAlone()
		{
			// The in-place form mutated its input. A caller that reuses the list
			// — and CategorizedPrefabs hands out a shared one — would have seen
			// its contents quietly deleted.
			var prefabs = new List<Item> { Prefab(1, "A"), Prefab(2, "B"), Prefab(3, "C") };

			FindItUtil.ApplyFilters(prefabs, Filters(p => false), CancellationToken.None);

			Assert.Equal(3, prefabs.Count);
		}

		[Fact]
		public void StopsWhenTheSearchIsSuperseded()
		{
			// The player typed another character. Whatever is collected so far is
			// returned and discarded by the caller; the point is not to finish.
			var prefabs = Enumerable.Range(1, 10_000).Select(i => Prefab(i, "P" + i)).ToArray();
			using var source = new CancellationTokenSource();
			var seen = 0;

			var kept = FindItUtil.ApplyFilters(
				prefabs,
				Filters(p =>
				{
					if (++seen == 50)
					{
						source.Cancel();
					}

					return true;
				}),
				source.Token);

			Assert.True(seen < prefabs.Length, "cancellation did not stop the walk");
			Assert.True(kept.Count < prefabs.Length);
		}

	}
}
