using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>A translation with English filled in where the Options screen needs it.</summary>
	/// <remarks>
	/// The translations cover a fraction of the English keys. Only the Options screen reads
	/// ours with no fallback of its own, so only its keys are filled. Everywhere else the code
	/// supplies English itself, and some lookups ask for our key first precisely so a gap
	/// falls through to the game's own translated name.
	/// </remarks>
	public static class LocaleFallback
	{
		public const string OptionsPrefix = "Options.";

		public static Dictionary<string, string> Merge(
			IReadOnlyDictionary<string, string> english,
			IReadOnlyDictionary<string, string>? translation)
		{
			var merged = new Dictionary<string, string>();

			foreach (var entry in english)
			{
				if (entry.Key.StartsWith(OptionsPrefix, StringComparison.Ordinal))
				{
					merged[entry.Key] = entry.Value;
				}
			}

			if (translation is null)
			{
				return merged;
			}

			foreach (var entry in translation)
			{
				if (!string.IsNullOrWhiteSpace(entry.Value))
				{
					merged[entry.Key] = entry.Value;
				}
			}

			return merged;
		}
	}
}
