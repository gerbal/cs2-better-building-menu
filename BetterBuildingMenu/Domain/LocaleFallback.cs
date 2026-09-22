using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>A translation with the English table underneath it.</summary>
	/// <remarks>
	/// The translations cover a fraction of the English keys. Registering each one whole means
	/// a gap reads as English whatever the game does with a key the active language lacks.
	/// </remarks>
	public static class LocaleFallback
	{
		public static Dictionary<string, string> Merge(
			IReadOnlyDictionary<string, string> english,
			IReadOnlyDictionary<string, string>? translation)
		{
			var merged = new Dictionary<string, string>(english.Count);

			foreach (var entry in english)
			{
				merged[entry.Key] = entry.Value;
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
