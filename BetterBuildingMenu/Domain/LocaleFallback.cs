using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>A translation with English filled in where the Options screen needs it.</summary>
	/// <remarks>
	/// Only the Options screen reads our keys with no fallback of its own, so only its keys
	/// are filled. Elsewhere a gap must fall through, to the code's own English or to the
	/// game's translated name.
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
