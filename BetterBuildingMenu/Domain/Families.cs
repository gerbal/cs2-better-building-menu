using System.Text;

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
	/// view, beside <see cref="DistinctWords"/>: the UI sees a window, and a family runs past it. It sorts
	/// nothing: one loop over the rows, one over those that end in a token. See docs/design-notes.md, "Names".
	/// </remarks>
	public static class Families
	{
		/// <summary>The fewest rows that make a family.</summary>
		public const int Least = 3;

		/// <summary>A family member's own word, which its pill says, and its family's key, which a later grouping reads.</summary>
		public readonly record struct Member(string Token, string Key);

		/// <summary>Each family member by its id; a row in no family has none.</summary>
		public static IReadOnlyDictionary<int, Member> Of(IReadOnlyList<BuildingCatalogEntry> rows)
		{
			var found = new Dictionary<int, Member>();

			if (rows is null || rows.Count < Least)
			{
				return found;
			}

			// Each stem, whatever its case, to its place in `keys` (the stem as its first row spells it) and
			// `counts`; each row that ends in a token, by its place, with its stem's place and where its token sits.
			var stems = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
			var keys = new List<string>();
			var counts = new List<int>();
			var split = new List<(int Row, int Stem, int From, int To)>();

			for (var row = 0; row < rows.Count; row++)
			{
				var name = rows[row]?.Name;

				if (name is null || !TrySplitAt(name, out var stemEnd, out var tokenStart, out var tokenEnd))
				{
					continue;
				}

				var stem = Joined(name, stemEnd);

				if (!stems.TryGetValue(stem, out var at))
				{
					at = keys.Count;
					stems.Add(stem, at);
					keys.Add(stem);
					counts.Add(0);
				}

				counts[at]++;
				split.Add((row, at, tokenStart, tokenEnd));
			}

			// Only a member's token is built.
			foreach (var (row, stem, from, to) in split)
			{
				if (counts[stem] >= Least)
				{
					found[rows[row].Id] = new Member(rows[row].Name.Substring(from, to - from), keys[stem]);
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

			if (name is null || !TrySplitAt(name, out var stemEnd, out var tokenStart, out var tokenEnd))
			{
				return false;
			}

			stem = Joined(name, stemEnd);
			token = name.Substring(tokenStart, tokenEnd - tokenStart);
			return true;
		}

		/// <summary>
		/// Where a name's stem ends, from its first word, and where its token sits. Read character by
		/// character, with no regular expression and no string built: a search over every building splits
		/// each matching name on each keystroke, and most end in no token.
		/// </summary>
		private static bool TrySplitAt(string name, out int stemEnd, out int tokenStart, out int tokenEnd)
		{
			stemEnd = 0;
			tokenStart = 0;
			tokenEnd = name.Length;

			while (tokenEnd > 0 && char.IsWhiteSpace(name[tokenEnd - 1]))
			{
				tokenEnd--;
			}

			// The last word.
			var start = tokenEnd;

			while (start > 0 && !char.IsWhiteSpace(name[start - 1]))
			{
				start--;
			}

			if (start == tokenEnd)
			{
				return false;
			}

			if (IsToken(name, start, tokenEnd))
			{
				var head = start;

				while (head > 0 && char.IsWhiteSpace(name[head - 1]))
				{
					head--;
				}

				if (head > 0)
				{
					stemEnd = head;
					tokenStart = start;
					return true;
				}
			}

			return TryClosing(name, start, tokenEnd, out stemEnd, out tokenStart);
		}

		private static bool IsDigit(char c) => c >= '0' && c <= '9';

		private static bool IsAsciiLetter(char c) => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');

		/// <summary>A whole word that is a token: a number with an optional letter, a single letter, or a size ("2x", "1x1").</summary>
		private static bool IsToken(string name, int start, int end)
		{
			if (end - start == 1 && IsAsciiLetter(name[start]))
			{
				return true;
			}

			var at = start;

			while (at < end && IsDigit(name[at]))
			{
				at++;
			}

			if (at == start)
			{
				return false;
			}

			if (at == end || (at == end - 1 && IsAsciiLetter(name[at])))
			{
				return true;
			}

			if (name[at] != 'x' && name[at] != 'X')
			{
				return false;
			}

			for (at++; at < end; at++)
			{
				if (!IsDigit(name[at]))
				{
					return false;
				}
			}

			return true;
		}

		/// <summary>
		/// Digits, with an optional letter, closing a word that starts with a letter and holds no other digit;
		/// its stem ends on the letter before them, leaving out any mark between ("Mk-2": "Mk").
		/// </summary>
		private static bool TryClosing(string name, int start, int end, out int stemEnd, out int tokenStart)
		{
			stemEnd = start;
			tokenStart = end;
			var digitsEnd = IsAsciiLetter(name[end - 1]) ? end - 1 : end;
			var at = digitsEnd;

			while (at > start && IsDigit(name[at - 1]))
			{
				at--;
			}

			if (at == digitsEnd || !char.IsLetter(name[start]))
			{
				return false;
			}

			tokenStart = at;
			var letter = at;

			while (letter > start && !char.IsLetter(name[letter - 1]))
			{
				letter--;
			}

			for (var each = start; each < at; each++)
			{
				if (IsDigit(name[each]))
				{
					return false;
				}
			}

			stemEnd = letter;
			return true;
		}

		/// <summary>The name's words up to `end`, one space between each, however many part them in the name.</summary>
		private static string Joined(string name, int end)
		{
			var from = 0;

			while (from < end && char.IsWhiteSpace(name[from]))
			{
				from++;
			}

			var plain = true;

			for (var at = from; at < end && plain; at++)
			{
				plain = !char.IsWhiteSpace(name[at]) || (name[at] == ' ' && !char.IsWhiteSpace(name[at - 1]));
			}

			if (plain)
			{
				return name.Substring(from, end - from);
			}

			var joined = new StringBuilder(end - from);

			for (var at = from; at < end; at++)
			{
				if (!char.IsWhiteSpace(name[at]))
				{
					joined.Append(name[at]);
				}
				else if (!char.IsWhiteSpace(name[at - 1]))
				{
					joined.Append(' ');
				}
			}

			return joined.ToString();
		}
	}
}
