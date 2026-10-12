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
			line.Add("t", new ProxyNumber(Math.Round(pick.Seconds, 2)));
			line.Add("event", new ProxyString(EventName(pick)));
			line.Add("menu", new ProxyString(pick.Menu));
			line.Add("prefab", new ProxyString(pick.Prefab));

			switch (pick)
			{
				case PickArm arm:
					line.Add("source", new ProxyString(arm.Source == PickSource.Bbm ? "bbm" : "game"));
					break;
				case PickSwap swap:
					line.Add("from", new ProxyString(swap.From));
					break;
				case PickPlace place:
					line.Add("x", new ProxyNumber(place.At.X));
					line.Add("y", new ProxyNumber(place.At.Y));
					line.Add("cameraMoved", new ProxyBoolean(place.CameraMoved));
					line.Add("box", new ProxyString(place.Box == BoxState.Open ? "open" : "closed"));
					line.Add("tabSwitches", new ProxyNumber(place.TabSwitches));
					line.Add("sinceArm", new ProxyNumber(place.SinceArm));
					break;
			}

			return JSON.Dump(line, EncodeOptions.CompactPrint);
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
