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

		/// <summary>The language our own strings are written in, and the one the game fills every other language's gaps from.</summary>
		public const string EnglishLocaleId = "en-US";

		/// <summary>The keys of ours the active language has no translation of, in ordinal order: none in English.</summary>
		/// <remarks>
		/// The game fills a language's gaps from English, so our English key answers in every
		/// language and the UI cannot tell from the string alone. Where it can use the game's own
		/// words instead, this list says to. A blank translation counts as none, as in Merge.
		/// </remarks>
		public static string[] UntranslatedKeys(
			string? localeId,
			IReadOnlyDictionary<string, string> english,
			IReadOnlyDictionary<string, string>? translation)
		{
			if (string.Equals(localeId, EnglishLocaleId, StringComparison.Ordinal))
			{
				return Array.Empty<string>();
			}

			var untranslated = new List<string>();

			foreach (var key in english.Keys)
			{
				if (translation is null || !translation.TryGetValue(key, out var text) || string.IsNullOrWhiteSpace(text))
				{
					untranslated.Add(key);
				}
			}

			untranslated.Sort(StringComparer.Ordinal);

			return untranslated.ToArray();
		}

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
