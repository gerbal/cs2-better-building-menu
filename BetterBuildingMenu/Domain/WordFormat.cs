using System.Text;
using System.Text.RegularExpressions;

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
		/// Turkish one turns "industrial" into "İndustrial".</remarks>
		public static string FormatWords(this string str) =>
			Regex.Replace(
				Regex.Replace(str, @"([a-z])([A-Z])", x => $"{x.Groups[1].Value} {x.Groups[2].Value}"),
				@"(\b)(?<!')([a-z])", x => $"{x.Groups[1].Value}{x.Groups[2].Value.ToUpperInvariant()}");

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
