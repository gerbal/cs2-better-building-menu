using Colossal.Json;

using System.Globalization;

namespace BetterBuildingMenu.Domain.Placement
{
	public enum PlacementHistoryReadState
	{
		/// <summary>A history this release reads.</summary>
		Read,

		/// <summary>Not a history: the file is set aside.</summary>
		Corrupt,

		/// <summary>A history in a later format: kept as it is, and nothing is counted.</summary>
		Newer,
	}

	public readonly record struct PlacementHistoryRead(PlacementHistoryReadState State, PlacementHistory History);

	/// <summary>history.json's text, version 1: <c>{ "version": 1, "menus": { menu: { latest, held, counts } } }</c>.</summary>
	/// <remarks>
	/// Read by walking Colossal.Json's values rather than decoding into a class, which needs an
	/// assembly the test run does not have.
	/// </remarks>
	public static class PlacementHistoryJson
	{
		public static string Write(PlacementHistory history)
		{
			var menus = new ProxyObject();

			foreach (var menu in history.Menus.OrderBy(pair => pair.Key, StringComparer.Ordinal))
			{
				var entry = new ProxyObject();

				if (menu.Value.Latest is { } latest)
				{
					entry.Add("latest", new ProxyString(latest));
				}

				var held = new ProxyArray();

				foreach (var prefab in menu.Value.Held)
				{
					held.Add(new ProxyString(prefab));
				}

				entry.Add("held", held);

				var counts = new ProxyObject();

				foreach (var count in menu.Value.Counts.OrderByDescending(pair => pair.Value).ThenBy(pair => pair.Key, StringComparer.Ordinal))
				{
					counts.Add(count.Key, new ProxyNumber(count.Value));
				}

				entry.Add("counts", counts);
				menus.Add(menu.Key, entry);
			}

			var root = new ProxyObject();
			root.Add("version", new ProxyNumber(PlacementHistory.Version));
			root.Add("menus", menus);

			return JSON.Dump(root);
		}

		public static PlacementHistoryRead Read(string json)
		{
			try
			{
				if (JSON.Load(json) is not ProxyObject root
					|| !root.TryGetValue("version", out var version)
					|| version is not ProxyNumber)
				{
					return Corrupt();
				}

				var format = version.ToDouble(CultureInfo.InvariantCulture);

				if (format > PlacementHistory.Version)
				{
					return new PlacementHistoryRead(PlacementHistoryReadState.Newer, new PlacementHistory(readOnly: true));
				}

				if (format != PlacementHistory.Version)
				{
					return Corrupt();
				}

				var history = new PlacementHistory();

				if (root.TryGetValue("menus", out var menus) && menus is ProxyObject menuObject)
				{
					foreach (var menu in menuObject)
					{
						if (menu.Value is ProxyObject entry)
						{
							history.Restore(menu.Key, Counts(entry), Text(entry, "latest"), Names(entry, "held"));
						}
					}
				}

				return new PlacementHistoryRead(PlacementHistoryReadState.Read, history);
			}
			catch (Exception)
			{
				// Colossal.Json throws a different exception for each way text is not JSON.
				return Corrupt();
			}
		}

		private static PlacementHistoryRead Corrupt() =>
			new(PlacementHistoryReadState.Corrupt, new PlacementHistory());

		private static IEnumerable<KeyValuePair<string, float>> Counts(ProxyObject entry)
		{
			if (!entry.TryGetValue("counts", out var counts) || counts is not ProxyObject countObject)
			{
				yield break;
			}

			foreach (var count in countObject)
			{
				if (count.Value is ProxyNumber)
				{
					yield return new KeyValuePair<string, float>(count.Key, count.Value.ToSingle(CultureInfo.InvariantCulture));
				}
			}
		}

		private static string? Text(ProxyObject entry, string key) =>
			entry.TryGetValue(key, out var value) && value is ProxyString ? value.ToString(CultureInfo.InvariantCulture) : null;

		private static IEnumerable<string> Names(ProxyObject entry, string key)
		{
			if (!entry.TryGetValue(key, out var names) || names is not ProxyArray nameArray)
			{
				yield break;
			}

			foreach (var name in nameArray)
			{
				if (name is ProxyString)
				{
					yield return name.ToString(CultureInfo.InvariantCulture);
				}
			}
		}
	}
}
