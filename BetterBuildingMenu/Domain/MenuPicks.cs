using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>One menu's own pick: its VIEW or its GROUP.</summary>
	/// <param name="Menu">The game's menu, by its UIAssetMenuPrefab name, as the catalog's rows carry it.</param>
	public sealed record MenuPick(string Menu, string Value) : IJsonWritable
	{
		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("menu");
			writer.Write(Menu);
			writer.PropertyName("value");
			writer.Write(Value);
			writer.TypeEnd();
		}
	}

	/// <summary>
	/// Each menu's own picks as a setting stores them: one "Menu=value" line per menu that has one.
	/// </summary>
	/// <remarks>
	/// One string, not an array, as every setting BBM stores is a plain value. A line splits on its
	/// last "=", since menu names hold spaces and "&amp;". Pure, so the settings class only reads and
	/// writes the text. See docs/design-notes.md, "Each menu's own view and group".
	/// </remarks>
	public static class MenuPicks
	{
		/// <summary>Nothing picked: every menu draws its default.</summary>
		public const string None = "";

		/// <summary>Every menu's pick, in the stored order; a line with no menu, no value or no "=" is skipped.</summary>
		public static IReadOnlyList<MenuPick> Parse(string? stored)
		{
			var picks = new List<MenuPick>();

			foreach (var raw in (stored ?? None).Split('\n'))
			{
				// A hand edit on Windows ends each line with a carriage return.
				var line = raw.TrimEnd('\r');
				var at = line.LastIndexOf('=');

				if (at <= 0 || at == line.Length - 1)
				{
					continue;
				}

				var menu = line.Substring(0, at);
				picks.RemoveAll(pick => string.Equals(pick.Menu, menu, StringComparison.Ordinal));
				picks.Add(new MenuPick(menu, line.Substring(at + 1)));
			}

			return picks;
		}

		/// <summary>A menu's pick, or <see cref="None"/>; the menu is read by its trimmed name, as the state stores it.</summary>
		public static string Get(string? stored, string? menu) =>
			Parse(stored).FirstOrDefault(pick => string.Equals(pick.Menu, menu?.Trim(), StringComparison.Ordinal))?.Value ?? None;

		/// <summary>The stored text with one menu's pick set, or taken away for <see cref="None"/>; the others keep their order.</summary>
		/// <remarks>A pick that would not read back as its own line, one with a line break or a value holding "=", is not stored.</remarks>
		public static string With(string? stored, string? menu, string? value)
		{
			var picks = Parse(stored).Where(pick => !string.Equals(pick.Menu, menu, StringComparison.Ordinal)).ToList();

			if (!string.IsNullOrEmpty(menu) && !string.IsNullOrEmpty(value) && menu!.IndexOf('\n') < 0 && value!.IndexOf('\n') < 0 && value.IndexOf('=') < 0)
			{
				picks.Add(new MenuPick(menu, value));
			}

			return string.Join("\n", picks.Select(pick => pick.Menu + "=" + pick.Value));
		}

		/// <summary>A GROUP pick as stored: the menu's default takes the menu's own pick away, so the menu draws it unmarked.</summary>
		public static string WithGroup(string? stored, string? menu, string? picked, string menuDefault) =>
			With(stored, menu, string.Equals(picked, menuDefault, StringComparison.Ordinal) ? None : picked);
	}
}
