using Colossal.Json;

namespace BetterBuildingMenu.Domain
{
	/// <summary>The key names BBM's settings file held, which the upgrader test reads.</summary>
	/// <remarks>
	/// From the fragments the game parsed the file into, else from the file's text, whose first
	/// line names the setting and whose rest is the JSON. See docs/design-notes.md, "Who is an
	/// upgrader".
	/// </remarks>
	public static class SettingsFileKeys
	{
		/// <summary>The top-level keys of every fragment that is a JSON object.</summary>
		public static IReadOnlyCollection<string> Of(IEnumerable<Variant?> fragments)
		{
			var keys = new HashSet<string>(StringComparer.Ordinal);

			foreach (var fragment in fragments)
			{
				if (fragment is ProxyObject json)
				{
					foreach (var key in json.Keys)
					{
						keys.Add(key);
					}
				}
			}

			return keys;
		}

		/// <summary>The keys in a settings file's text, or none for text that holds no settings.</summary>
		public static IReadOnlyCollection<string> FromFileText(string? text)
		{
			var newline = text?.IndexOf('\n') ?? -1;

			if (text is null || newline < 0)
			{
				return Array.Empty<string>();
			}

			try
			{
				return Of(new[] { JSON.Load(text.Substring(newline + 1)) });
			}
			catch (Exception)
			{
				// Colossal.Json throws a different exception for each way text is not JSON.
				return Array.Empty<string>();
			}
		}

		/// <summary>The first read that finds keys; a read that throws counts as finding none.</summary>
		/// <remarks>An unreadable file is no reason to skip the migration, which then runs on no keys.</remarks>
		public static IReadOnlyCollection<string> FirstFound(params Func<IReadOnlyCollection<string>>[] reads)
		{
			foreach (var read in reads)
			{
				try
				{
					var keys = read();

					if (keys.Count > 0)
					{
						return keys;
					}
				}
				catch (Exception)
				{
					// Another read may still answer.
				}
			}

			return Array.Empty<string>();
		}
	}
}
