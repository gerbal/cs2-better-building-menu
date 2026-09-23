namespace BetterBuildingMenu.Domain
{
	/// <summary>Prefabs that more than one category processor claimed in the same pass.</summary>
	/// <remarks>
	/// The index keeps one entry per prefab, so when two processors claim one the
	/// later one's entry replaces the earlier one's, category and all. Nothing
	/// fails when that happens; this is how it gets seen.
	/// </remarks>
	public static class ProcessorOverlap
	{
		/// <summary>One pair of processors that claimed the same prefabs.</summary>
		/// <param name="Earlier">The processor whose entries were replaced.</param>
		/// <param name="Later">The processor whose entries stand.</param>
		/// <param name="Count">How many prefabs both claimed.</param>
		/// <param name="ExampleId">The first such prefab, to look up by name.</param>
		public readonly record struct Pair(string Earlier, string Later, int Count, int ExampleId);

		/// <param name="runOrder">Processor names, in the order the pass ran them.</param>
		/// <param name="claims">The prefab ids each processor claimed.</param>
		/// <returns>Each pair once, in the order its first shared prefab was met.</returns>
		public static IReadOnlyList<Pair> Find(IEnumerable<string> runOrder, IReadOnlyDictionary<string, List<int>> claims)
		{
			var claimedBy = new Dictionary<int, string>();
			var pairs = new List<Pair>();

			foreach (var processor in runOrder)
			{
				if (!claims.TryGetValue(processor, out var ids))
				{
					continue;
				}

				foreach (var id in ids)
				{
					if (claimedBy.TryGetValue(id, out var earlier) && earlier != processor)
					{
						var at = pairs.FindIndex(pair => pair.Earlier == earlier && pair.Later == processor);

						if (at < 0)
						{
							pairs.Add(new Pair(earlier, processor, 1, id));
						}
						else
						{
							pairs[at] = pairs[at] with { Count = pairs[at].Count + 1 };
						}
					}

					claimedBy[id] = processor;
				}
			}

			return pairs;
		}
	}
}
