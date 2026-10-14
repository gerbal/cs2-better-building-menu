using Colossal.Json;

namespace BetterBuildingMenu.Domain.Placement
{
	/// <summary>A pick log line as JSON, on one line: picks.jsonl holds one per event.</summary>
	/// <remarks>The seconds are rounded so every runtime writes the same digits. See docs/design-notes.md, "The pick logger".</remarks>
	public static class PickLogJson
	{
		public static string Line(PickEvent pick)
		{
			var line = new ProxyObject();
			AddNumber(line, "t", Math.Round(pick.Seconds, 2));
			line.Add("event", new ProxyString(EventName(pick)));
			line.Add("menu", new ProxyString(Clean(pick.Menu)));
			line.Add("prefab", new ProxyString(Clean(pick.Prefab)));

			switch (pick)
			{
				case PickArm arm:
					line.Add("source", new ProxyString(arm.Source == PickSource.Bbm ? "bbm" : "game"));
					break;
				case PickSwap swap:
					line.Add("from", new ProxyString(Clean(swap.From)));
					break;
				case PickPlace place:
					AddNumber(line, "x", place.At.X);
					AddNumber(line, "y", place.At.Y);
					line.Add("cameraMoved", new ProxyBoolean(place.CameraMoved));
					line.Add("box", new ProxyString(place.Box == BoxState.Open ? "open" : "closed"));
					line.Add("tabSwitches", new ProxyNumber(place.TabSwitches));
					line.Add("sinceArm", new ProxyNumber(place.SinceArm));
					break;
			}

			return JSON.Dump(line, EncodeOptions.CompactPrint);
		}

		/// <summary>A lone surrogate escapes to text strict JSON readers reject, so it becomes U+FFFD.</summary>
		private static string Clean(string text)
		{
			var chars = text.ToCharArray();

			for (var i = 0; i < chars.Length; i++)
			{
				if (char.IsHighSurrogate(chars[i]) && i + 1 < chars.Length && char.IsLowSurrogate(chars[i + 1]))
				{
					i++;
				}
				else if (char.IsSurrogate(chars[i]))
				{
					chars[i] = '\uFFFD';
				}
			}

			return new string(chars);
		}

		/// <summary>NaN and infinity are not JSON, so a field that holds one is left out and the line stays valid.</summary>
		private static void AddNumber(ProxyObject line, string name, double value)
		{
			if (!double.IsNaN(value) && !double.IsInfinity(value))
			{
				line.Add(name, new ProxyNumber(value));
			}
		}

		private static string EventName(PickEvent pick) => pick switch
		{
			PickArm => "arm",
			PickSwap => "swap",
			PickPlace => "place",
			_ => throw new ArgumentOutOfRangeException(nameof(pick), pick.GetType().Name, "Not a pick log event"),
		};
	}
}
