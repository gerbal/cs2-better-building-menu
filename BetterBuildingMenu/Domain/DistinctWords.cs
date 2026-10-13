namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The word that tells a row apart from its nearest look-alike: the row sharing the most leading words
	/// with it, which in name order is a neighbour, and the row's word is the one after those it shares.
	/// "Pedestrian" against Covered Bicycle Bridge, "2" for Four-Lane Road 2.
	/// </summary>
	/// <remarks>
	/// Over the whole view, beside <see cref="DuplicateNameNumbering"/>, whose numbers it reads: the UI
	/// sees a window, and a look-alike past it still decides which word a cut name must keep. One pass
	/// over the rows' words and no sort. See docs/design-notes.md, "Names".
	/// </remarks>
	public static class DistinctWords
	{
		/// <summary>Each row's word by its id; a row with no look-alike, or that is all of what it shares, has none.</summary>
		public static IReadOnlyDictionary<int, string> Of(IReadOnlyList<BuildingCatalogEntry> rows)
		{
			var found = new Dictionary<int, string>();

			if (rows is null || rows.Count < 2)
			{
				return found;
			}

			var words = new string[rows.Count][];
			// How many leading words each row shares with the row nearest it.
			var shared = new int[rows.Count];
			// Each run of leading words some row starts with, by the run before it and its last word,
			// to the first row that starts with it.
			var runs = new Dictionary<(int Before, string Word), int>(rows.Count * 2, new RunComparer());
			var firstRow = new List<int>(rows.Count * 2);

			for (var row = 0; row < rows.Count; row++)
			{
				words[row] = Words(rows[row]?.Name);
				var before = -1;
				// Once a row starts a run of its own, no earlier row starts with any longer run of its words.
				var alone = false;

				for (var depth = 0; depth < words[row].Length; depth++)
				{
					int run;

					if (!alone && runs.TryGetValue((before, words[row][depth]), out run))
					{
						// An earlier row starts with these words too: the two share at least this many.
						shared[row] = depth + 1;
						shared[firstRow[run]] = Math.Max(shared[firstRow[run]], depth + 1);
					}
					else
					{
						alone = true;
						run = firstRow.Count;
						firstRow.Add(row);
						runs.Add((before, words[row][depth]), run);
					}

					before = run;
				}
			}

			for (var row = 0; row < rows.Count; row++)
			{
				if (shared[row] > 0 && shared[row] < words[row].Length)
				{
					found[rows[row].Id] = words[row][shared[row]];
				}
			}

			return found;
		}

		private static string[] Words(string? name) =>
			(name ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);

		/// <summary>Runs of words match whatever their case.</summary>
		private sealed class RunComparer : IEqualityComparer<(int Before, string Word)>
		{
			public bool Equals((int Before, string Word) one, (int Before, string Word) other) =>
				one.Before == other.Before && StringComparer.OrdinalIgnoreCase.Equals(one.Word, other.Word);

			public int GetHashCode((int Before, string Word) run) =>
				unchecked((run.Before * 397) ^ StringComparer.OrdinalIgnoreCase.GetHashCode(run.Word));
		}
	}
}
