using BetterBuildingMenu.Domain;

using Colossal.Json;

using System.Globalization;
using System.Reflection;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Every setting the settings class stores, on a plain object, for the migration and Reset to run on.</summary>
	/// <remarks>
	/// Its initializers are the settings class's, which SettingsShapeTests holds together by
	/// reading Setting.cs. A record, so two loads' values compare whole.
	/// </remarks>
	internal sealed record FakeSettings : ISettingsValues
	{
		public int SettingsVersion { get; set; }

		public bool Upgrader { get; set; }

		public float AssetMenuHeight { get; set; } = Domain.AssetMenuHeight.Default;

		public float AssetMenuCatalogWidth { get; set; } = Domain.AssetMenuCatalogWidth.Default;

		public int AssetMenuWidthStep { get; set; } = WidthSteps.DefaultStep;

		public bool ControlPaneShown { get; set; } = SettingsDefaults.ControlPaneShown;

		public string AssetMenuViewMode { get; set; } = Domain.AssetMenuViewMode.None;

		public bool ReplaceVanillaBuildMenu { get; set; } = SettingsDefaults.ReplaceVanillaBuildMenu;

		public bool AutoWidenSearch { get; set; }

		public int AssetMenuTileSize { get; set; } = SettingsDefaults.TileSize;

		public int DevSlotMargin { get; set; } = Tuning.SlotMarginPercent;
	}

	/// <summary>A settings file as a load reads it: the values, the key names, and how many keys no property reads.</summary>
	internal sealed record SettingsFile(FakeSettings Values, IReadOnlyCollection<string> Keys, int UnknownKeys)
	{
		/// <summary>The values a file can set, by key: every one the migration and Reset reach.</summary>
		private static readonly IReadOnlyDictionary<string, PropertyInfo> Readable = typeof(ISettingsValues).GetProperties()
			.ToDictionary(property => property.Name, property => typeof(FakeSettings).GetProperty(property.Name)!, StringComparer.Ordinal);

		/// <summary>The game's format: the setting's name on the first line, then its JSON.</summary>
		public static string Text(string json) => "BetterBuildingMenu\r\n" + json + "\r\n";

		/// <summary>Loads a file as the game loads it into the settings class; null is no file.</summary>
		public static SettingsFile Read(string? text)
		{
			var values = new FakeSettings();
			var keys = SettingsFileKeys.FromFileText(text);
			var unknown = 0;

			if (text is not null && keys.Count > 0)
			{
				var json = (ProxyObject)JSON.Load(text.Substring(text.IndexOf('\n') + 1));

				foreach (var key in keys)
				{
					if (Readable.TryGetValue(key, out var property))
					{
						property.SetValue(values, FromJson(json[key], property.PropertyType));
					}
					else if (typeof(BetterBuildingMenuSettings).GetProperty(key) is null)
					{
						// Read by no setting: the game drops those at the next save.
						unknown++;
					}
				}
			}

			return new SettingsFile(values, keys, unknown);
		}

		/// <summary>A JSON value as the setting's own type, boxed as that type, so an int stays an int.</summary>
		private static object FromJson(Variant value, Type type)
		{
			if (type == typeof(bool))
			{
				return value.ToBoolean(CultureInfo.InvariantCulture);
			}

			if (type == typeof(int))
			{
				return (int)value.ToDouble(CultureInfo.InvariantCulture);
			}

			if (type == typeof(float))
			{
				return (float)value.ToDouble(CultureInfo.InvariantCulture);
			}

			return type == typeof(string)
				? value.ToString(CultureInfo.InvariantCulture)
				: throw new NotSupportedException("No fixture reads a " + type.Name);
		}
	}

	/// <summary>
	/// What the game's save writes, by its rule: every key the file held, at its current value, and
	/// every other value that differs from the default object's.
	/// </summary>
	/// <remarks>The game's own diff needs an assembly the test run does not load, so this states its rule for the values the migration and Reset touch.</remarks>
	internal static class GameSave
	{
		public static string Write(IReadOnlyCollection<string> fileKeys, FakeSettings values)
		{
			var defaults = new FakeSettings();
			var written = typeof(ISettingsValues).GetProperties()
				.Where(property => fileKeys.Contains(property.Name) || !Equals(property.GetValue(values), property.GetValue(defaults)))
				.Select(property => $"\"{property.Name}\": {Json(property.GetValue(values))}");

			return SettingsFile.Text("{" + string.Join(", ", written) + "}");
		}

		private static string Json(object? value) => value switch
		{
			bool flag => flag ? "true" : "false",
			float number => number.ToString(CultureInfo.InvariantCulture),
			int number => number.ToString(CultureInfo.InvariantCulture),
			string text => "\"" + text.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"",
			_ => throw new NotSupportedException("The save writes no " + value?.GetType().Name),
		};
	}

	/// <summary>Settings files like those earlier releases left, each named for what it holds.</summary>
	internal static class SettingsFixtures
	{
		/// <summary>0.2.4 with the pane shown and the width never dragged, after a build that stored the height 155.</summary>
		public static readonly string Height155Width0PaneShown = SettingsFile.Text(
			"{\n    \"AssetMenuHeight\": 155,\n    \"ReplaceVanillaBuildMenu\": true,\n    \"ControlPaneShown\": true,\n    \"AssetMenuCatalogWidth\": 0\n}");

		/// <summary>0.2.4 with the right edge dragged to its narrowest, and the default height.</summary>
		public static readonly string Width735Height420 = SettingsFile.Text(
			"{\n    \"AssetMenuCatalogWidth\": 735,\n    \"ControlPaneShown\": true,\n    \"AssetMenuHeight\": 420\n}");

		/// <summary>The same file once 0.2.5 stepped its version.</summary>
		public static readonly string Width735Height420Version1 = SettingsFile.Text(
			"{\n    \"AssetMenuCatalogWidth\": 735,\n    \"SettingsVersion\": 1,\n    \"ControlPaneShown\": true,\n    \"AssetMenuHeight\": 420\n}");

		/// <summary>A development build's file from before 0.1.0: two keys no release declared, three 0.1.x keys.</summary>
		public static readonly string DevelopmentBuild = SettingsFile.Text(
			"{\n    \"ApplyMimic\": {\n        \"m_Path\": \"<Mouse>/rightButton\"\n    },\n    \"BuildingLensPanelHeight\": 450.5,\n    \"ReplaceVanillaBuildMenu\": true,\n    \"DefaultAlignmentStyle\": \"Center\",\n    \"ShowCoverageOverlay\": true\n}");

		/// <summary>0.2.5 for a player who changed nothing.</summary>
		public static readonly string Version1Only = SettingsFile.Text("{\"SettingsVersion\": 1}");

		/// <summary>0.2.5 for a player who picked List.</summary>
		public static readonly string Version1ViewList = SettingsFile.Text("{\"SettingsVersion\": 1, \"AssetMenuViewMode\": \"list\"}");

		/// <summary>The one key every release declares, at each value.</summary>
		public static readonly string ReplaceOn = SettingsFile.Text("{\"ReplaceVanillaBuildMenu\": true}");

		public static readonly string ReplaceOff = SettingsFile.Text("{\"ReplaceVanillaBuildMenu\": false}");

		/// <summary>0.2.4 with the pane hidden and the width never dragged.</summary>
		public static readonly string PaneHiddenWidth0 = SettingsFile.Text("{\"ControlPaneShown\": false, \"AssetMenuCatalogWidth\": 0}");

		/// <summary>0.2.4 with only the tile size moved.</summary>
		public static readonly string TileSizeOnly = SettingsFile.Text("{\"AssetMenuTileSize\": 100}");

		/// <summary>A width a hand edit left below zero.</summary>
		public static readonly string NegativeWidth = SettingsFile.Text("{\"AssetMenuCatalogWidth\": -5}");

		/// <summary>A player's own height and width, other choices, and a key no release declares.</summary>
		public static readonly string PlayerChoices = SettingsFile.Text(
			"{\"AssetMenuHeight\": 300, \"AssetMenuCatalogWidth\": 1200, \"AssetMenuTileSize\": 120, \"AutoWidenSearch\": false, \"MenuLook\": \"neon\"}");

		/// <summary>0.2.4 with the pane hidden and the width dragged to the end of the room.</summary>
		public static readonly string FullWidthPaneHidden = SettingsFile.Text("{\"AssetMenuCatalogWidth\": 1476, \"ControlPaneShown\": false}");

		/// <summary>Already migrated, at the new default, and at a height chosen afterwards.</summary>
		public static readonly string MigratedHeight149 = SettingsFile.Text("{\"SettingsVersion\": 2, \"AssetMenuHeight\": 149}");

		public static readonly string MigratedHeight420 = SettingsFile.Text("{\"SettingsVersion\": 2, \"AssetMenuHeight\": 420}");

		/// <summary>A later release's version.</summary>
		public static readonly string LaterVersion = SettingsFile.Text("{\"SettingsVersion\": 7, \"AssetMenuHeight\": 420}");

		/// <summary>0.2.4 with only a height.</summary>
		public static string Height(float height) =>
			SettingsFile.Text("{\"AssetMenuHeight\": " + height.ToString(CultureInfo.InvariantCulture) + "}");
	}
}
