using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>How well an entry answers a search.</summary>
	/// <remarks>
	/// Tiers, highest first: the query as a phrase in the name, exactly, as a prefix, at a word start
	/// or anywhere; then every word somewhere in the name, in any order; then a hit on the prefab
	/// name or the pdx id, or words spread across the fields, which never outranks a display-name
	/// hit. Those three fields are what the search filter matches (<see cref="SearchTerms.FoundIn"/>),
	/// so they are all a score reads. Text is compared folded (<see cref="SearchFold"/>), so case and
	/// accents never count.
	/// </remarks>
	public static class BuildingCatalogRelevance
	{
		public const int Exact = 1000;
		public const int Prefix = 800;
		public const int WordStart = 600;
		public const int Substring = 400;
		public const int AllWords = 300;
		public const int Field = 200;

		public static int Score(BuildingCatalogEntry? entry, string? rawQuery) =>
			Score(entry, SearchTerms.From(rawQuery));

		public static int Score(BuildingCatalogEntry? entry, SearchTerms terms)
		{
			if (terms.IsEmpty || entry is null)
			{
				return 0;
			}

			var name = entry.SearchName;
			var direct = ScoreText(name, terms);

			if (direct > 0)
			{
				return direct;
			}

			if (terms.Words.Length > 1 && terms.AllIn(name))
			{
				return AllWords;
			}

			var prefab = entry.SearchPrefabName;

			if (prefab.Length > 0 && ScoreText(prefab, terms) > 0)
			{
				return Field;
			}

			var pdx = entry.SearchPdxModsId;

			if (pdx.Length > 0 && ScoreText(pdx, terms) > 0)
			{
				return Field;
			}

			return terms.Words.Length > 1 && terms.FoundIn(entry) ? Field : 0;
		}

		private static int ScoreText(string text, SearchTerms terms)
		{
			var query = terms.Text;

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
			if (text.IndexOf(terms.SpacedText, StringComparison.Ordinal) >= 0)
			{
				return WordStart;
			}

			return text.IndexOf(query, StringComparison.Ordinal) >= 0 ? Substring : 0;
		}
	}
}
