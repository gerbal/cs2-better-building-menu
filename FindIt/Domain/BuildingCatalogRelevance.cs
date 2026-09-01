using System;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// How well an entry answers a search — buildingSearchRank.ts's matchScore, moved.
	/// </summary>
	/// <remarks>
	/// The UI used to re-rank C#'s sorted page in the grid, the list and the
	/// cards but not the table — one query, two orders — and dropped any
	/// entry its own scoring gave 0, so a search by pdx mods id (which the
	/// backend matches) listed in the table and vanished from the grid. The
	/// engine orders by this within each group now, for every view.
	///
	/// Scores are the original tiers: an exact name, a prefix, a match at a
	/// word start, a substring anywhere; then a hit on the prefab name, the
	/// pdx id or the category text, which never outranks a display-name hit;
	/// then a subsequence (initials), lowest because it matches generously.
	/// </remarks>
	public static class BuildingCatalogRelevance
	{
		public const int Exact = 1000;
		public const int Prefix = 800;
		public const int WordStart = 600;
		public const int Substring = 400;
		public const int Field = 200;
		public const int Subsequence = 100;

		public static int Score(BuildingCatalogEntry? entry, string? rawQuery)
		{
			var query = (rawQuery ?? string.Empty).Trim().ToLowerInvariant();

			if (query.Length == 0 || entry is null)
			{
				return 0;
			}

			var name = (entry.Name ?? string.Empty).ToLowerInvariant();
			var direct = ScoreText(name, query);

			if (direct > 0)
			{
				return direct;
			}

			var prefab = (entry.PrefabName ?? string.Empty).ToLowerInvariant();

			if (prefab.Length > 0 && ScoreText(prefab, query) > 0)
			{
				return Field;
			}

			var pdx = (entry.PdxModsId ?? string.Empty).ToLowerInvariant();

			if (pdx.Length > 0 && ScoreText(pdx, query) > 0)
			{
				return Field;
			}

			var category = ((entry.Category ?? string.Empty) + " " + (entry.SubCategory ?? string.Empty)).ToLowerInvariant();

			if (category.Trim().Length > 0 && ScoreText(category, query) > 0)
			{
				return Field;
			}

			return IsSubsequence(name, query) ? Subsequence : 0;
		}

		private static int ScoreText(string text, string query)
		{
			if (text.Length == 0)
			{
				return 0;
			}

			if (text == query)
			{
				return Exact;
			}

			if (text.StartsWith(query, StringComparison.Ordinal))
			{
				return Prefix;
			}

			// A match at a word boundary reads as intentional; mid-word does not.
			if (text.Contains(" " + query))
			{
				return WordStart;
			}

			return text.Contains(query) ? Substring : 0;
		}

		/// <summary>True when every character of the query appears in the text, in order.</summary>
		private static bool IsSubsequence(string text, string query)
		{
			var at = 0;

			foreach (var ch in text)
			{
				if (ch == query[at])
				{
					at++;
				}

				if (at == query.Length)
				{
					return true;
				}
			}

			return false;
		}
	}
}
