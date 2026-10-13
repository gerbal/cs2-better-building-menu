using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// The families in a view: names that differ only in a trailing variant token, where three rows or
	/// more share the stem before it. "Boulder 01" to "Boulder 08" are a family of eight, "05" each
	/// member's token and "Boulder" its key.
	/// </summary>
	/// <remarks>
	/// A variant token is a number with an optional letter ("05", "2b"), a single letter ("B"), or a size
	/// ("2x", "1x1"), as the name's last word or as digits closing it ("BeachRaft01"). Over the whole
	/// view, beside <see cref="DistinctWords"/>: the UI sees a window, and a family runs past it. One
	/// pass and no sort. See docs/design-notes.md, "Names".
	/// </remarks>
	public static class Families
	{
		/// <summary>The fewest rows that make a family.</summary>
		public const int Least = 3;

		/// <summary>A family member's own word, which its pill says, and its family's key, which a later grouping reads.</summary>
		public readonly record struct Member(string Token, string Key);

		private static readonly Regex Token = new Regex(@"^(\d+[A-Za-z]?|[A-Za-z]|\d+[xX]\d*)$", RegexOptions.CultureInvariant);

		/// <summary>Digits, with an optional letter, closing a word that starts with a letter.</summary>
		private static readonly Regex Closing = new Regex(@"^(\p{L}[^\d]*)(\d+[A-Za-z]?)$", RegexOptions.CultureInvariant);

		/// <summary>Each family member by its id; a row in no family has none.</summary>
		public static IReadOnlyDictionary<int, Member> Of(IReadOnlyList<BuildingCatalogEntry> rows)
		{
			var found = new Dictionary<int, Member>();

			if (rows is null || rows.Count < Least)
			{
				return found;
			}

			// Each stem, whatever its case, to the key its first row spells and the rows that end in a token after it.
			var stems = new Dictionary<string, (string Key, List<(int Id, string Token)> Rows)>(StringComparer.OrdinalIgnoreCase);

			foreach (var row in rows)
			{
				if (row is null || !TrySplit(row.Name, out var stem, out var token))
				{
					continue;
				}

				if (!stems.TryGetValue(stem, out var family))
				{
					family = (stem, new List<(int, string)>());
					stems.Add(stem, family);
				}

				family.Rows.Add((row.Id, token));
			}

			foreach (var family in stems.Values)
			{
				if (family.Rows.Count < Least)
				{
					continue;
				}

				foreach (var (id, token) in family.Rows)
				{
					found[id] = new Member(token, family.Key);
				}
			}

			return found;
		}

		/// <summary>
		/// A name's stem and its trailing variant token: its last word where that is one, else digits closing
		/// its last word. False where the name ends in neither, or the token is all of it.
		/// </summary>
		public static bool TrySplit(string? name, out string stem, out string token)
		{
			stem = string.Empty;
			token = string.Empty;
			var words = (name ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);

			if (words.Length == 0)
			{
				return false;
			}

			var head = string.Join(" ", words, 0, words.Length - 1);
			var last = words[words.Length - 1];

			if (head.Length > 0 && Token.IsMatch(last))
			{
				stem = head;
				token = last;
				return true;
			}

			var closing = Closing.Match(last);

			if (!closing.Success)
			{
				return false;
			}

			stem = head.Length == 0 ? closing.Groups[1].Value : head + " " + closing.Groups[1].Value;
			token = closing.Groups[2].Value;
			return true;
		}
	}
}
