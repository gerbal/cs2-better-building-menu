using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Turns an identifier into words, for names the game gives no string of its own.</summary>
	public static class WordFormat
	{
		/// <summary>"GarbageAccumulation" becomes "Garbage Accumulation", and "big park" "Big Park".</summary>
		/// <remarks>Upper-cased invariantly. Mono's culture is the OS's, not the game's language, and a
		/// Turkish one turns "industrial" into "İndustrial".</remarks>
		public static string FormatWords(this string str) =>
			Regex.Replace(
				Regex.Replace(str, @"([a-z])([A-Z])", x => $"{x.Groups[1].Value} {x.Groups[2].Value}"),
				@"(\b)(?<!')([a-z])", x => $"{x.Groups[1].Value}{x.Groups[2].Value.ToUpperInvariant()}");
	}
}
