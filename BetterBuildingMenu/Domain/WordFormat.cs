using System.Globalization;
using System.Text;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Turns an identifier into words, for names the game gives no string of its own.</summary>
	public static class WordFormat
	{
		/// <summary>A string from the game's locale, without the whitespace around it, or null when it
		/// has no words at all.</summary>
		/// <remarks>Some entries carry it: "Small Roads" ends in a line break, which would otherwise
		/// reach its Development heading and every comparison of the label.</remarks>
		public static string? GameText(string? text) =>
			text?.Trim() is { Length: > 0 } trimmed ? trimmed : null;

		/// <summary>"GarbageAccumulation" becomes "Garbage Accumulation", and "big park" "Big Park".</summary>
		/// <remarks>Upper-cased invariantly. Mono's culture is the OS's, not the game's language, and a
		/// Turkish one turns "industrial" into "İndustrial". Loops rather than Mono's slow Regex, since
		/// every unlocalized name comes through here; LabelRegexParityTests holds the expressions it
		/// replaced.</remarks>
		public static string FormatWords(this string str)
		{
			var words = new StringBuilder(str.Length + 8);

			for (var index = 0; index < str.Length; index++)
			{
				if (index > 0 && str[index] is >= 'A' and <= 'Z' && str[index - 1] is >= 'a' and <= 'z')
				{
					words.Append(' ');
				}

				words.Append(str[index]);
			}

			// A lower-case letter starting a word is capitalised, except after an apostrophe: "don't".
			for (var index = 0; index < words.Length; index++)
			{
				if (words[index] is >= 'a' and <= 'z'
					&& (index == 0 || (!IsWordChar(words[index - 1]) && words[index - 1] != '\'')))
				{
					words[index] = char.ToUpperInvariant(words[index]);
				}
			}

			return words.ToString();
		}

		/// <summary>What Regex's \w matches: a letter, a decimal digit, a non-spacing mark or a connector
		/// such as the underscore.</summary>
		private static bool IsWordChar(char c) =>
			char.IsLetterOrDigit(c)
			|| CharUnicodeInfo.GetUnicodeCategory(c) is UnicodeCategory.NonSpacingMark or UnicodeCategory.ConnectorPunctuation;

		/// <summary>"HospitalWing01" becomes "Hospital Wing 01", and "EU_Commercial" "EU Commercial".</summary>
		/// <remarks>Splits at underscores, hyphens, case changes and digit boundaries, and keeps each
		/// letter's case, so an acronym stays one word. For labels with no string of their own: facet
		/// values, pack names, provenance, a category's fallback.</remarks>
		public static string SplitIdentifier(string value)
		{
			if (string.IsNullOrWhiteSpace(value))
			{
				return value;
			}

			var label = new StringBuilder(value.Length + 8);
			for (int index = 0; index < value.Length; index++)
			{
				char current = value[index];
				if (current == '_' || current == '-')
				{
					if (label.Length > 0 && label[label.Length - 1] != ' ')
					{
						label.Append(' ');
					}

					continue;
				}

				char previous = index > 0 ? value[index - 1] : '\0';
				bool startsNewWord = index > 0
					&& ((char.IsUpper(current)
						&& (char.IsLower(previous)
							|| char.IsDigit(previous)
							|| (index + 1 < value.Length && char.IsUpper(previous) && char.IsLower(value[index + 1]))))
						|| (char.IsDigit(current) && !char.IsDigit(previous))
						|| (char.IsLetter(current) && char.IsDigit(previous)));
				if (startsNewWord && label.Length > 0 && label[label.Length - 1] != ' ')
				{
					label.Append(' ');
				}

				label.Append(current);
			}

			return label.ToString().Trim();
		}
	}
}
