using System;

namespace BetterBuildingMenu.Domain
{
	/// <summary>A search as typed, folded once (<see cref="SearchFold"/>) and split into words.</summary>
	/// <remarks>Built once per query run, not per entry: every entry's own fields are folded already.</remarks>
	public sealed class SearchTerms
	{
		public static readonly SearchTerms None = new(Array.Empty<string>());

		private SearchTerms(string[] words)
		{
			Words = words;
			Text = string.Join(" ", words);
			SpacedText = " " + Text;
		}

		/// <summary>The words, folded. Every one must appear for an entry to match.</summary>
		public string[] Words { get; }

		/// <summary>The words joined by single spaces: the whole query, as a phrase.</summary>
		public string Text { get; }

		/// <summary><see cref="Text"/> after a space: the phrase at the start of a word.</summary>
		public string SpacedText { get; }

		public bool IsEmpty => Words.Length == 0;

		public static SearchTerms From(string? typed)
		{
			if (string.IsNullOrWhiteSpace(typed))
			{
				return None;
			}

			return new SearchTerms(SearchFold.Fold(typed)
				.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
		}

		/// <summary>Whether every word appears in the entry's name, prefab name or Paradox Mods id.</summary>
		/// <remarks>A word may come from any of the three: "police 158589" finds a police station from
		/// that mod. "station police" finds Police Station, as Find It's search does.</remarks>
		public bool FoundIn(BuildingCatalogEntry entry)
		{
			foreach (var word in Words)
			{
				if (entry.SearchName.IndexOf(word, StringComparison.Ordinal) < 0
					&& entry.SearchPrefabName.IndexOf(word, StringComparison.Ordinal) < 0
					&& entry.SearchPdxModsId.IndexOf(word, StringComparison.Ordinal) < 0)
				{
					return false;
				}
			}

			return true;
		}

		/// <summary>Whether every word appears in this one folded text.</summary>
		public bool AllIn(string folded)
		{
			foreach (var word in Words)
			{
				if (folded.IndexOf(word, StringComparison.Ordinal) < 0)
				{
					return false;
				}
			}

			return true;
		}
	}
}
