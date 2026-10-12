using BetterBuildingMenu.Domain;

using Colossal.Json;

using System.Globalization;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The settings the migration reads and writes, on a plain object.</summary>
	/// <remarks>
	/// Its initializers are the settings class's, which SettingsMigrationTests holds together by
	/// reading Setting.cs. A record, so two loads' values compare whole.
	/// </remarks>
	internal sealed record FakeSettings : ISettingsValues
	{
		public int SettingsVersion { get; set; }

		public bool Upgrader { get; set; }

		public float AssetMenuHeight { get; set; } = Domain.AssetMenuHeight.Default;

		public float AssetMenuCatalogWidth { get; set; } = Domain.AssetMenuCatalogWidth.Default;

		public int AssetMenuWidthStep { get; set; } = WidthSteps.DefaultStep;
	}

	/// <summary>A settings file as a load reads it: the values, the key names, and how many keys no property reads.</summary>
	internal sealed record SettingsFile(FakeSettings Values, IReadOnlyCollection<string> Keys, int UnknownKeys)
	{
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
					var value = json[key];

					switch (key)
					{
						case nameof(ISettingsValues.SettingsVersion):
							values.SettingsVersion = (int)value.ToDouble(CultureInfo.InvariantCulture);
							break;
						case nameof(ISettingsValues.Upgrader):
							values.Upgrader = value.ToBoolean(CultureInfo.InvariantCulture);
							break;
						case nameof(ISettingsValues.AssetMenuHeight):
							values.AssetMenuHeight = (float)value.ToDouble(CultureInfo.InvariantCulture);
							break;
						case nameof(ISettingsValues.AssetMenuCatalogWidth):
							values.AssetMenuCatalogWidth = (float)value.ToDouble(CultureInfo.InvariantCulture);
							break;
						case nameof(ISettingsValues.AssetMenuWidthStep):
							values.AssetMenuWidthStep = (int)value.ToDouble(CultureInfo.InvariantCulture);
							break;
						default:
							// Read by another setting, or by none: the game drops those at the next save.
							if (typeof(BetterBuildingMenuSettings).GetProperty(key) is null)
							{
								unknown++;
							}

							break;
					}
				}
			}

			return new SettingsFile(values, keys, unknown);
		}
	}

	/// <summary>
	/// What the game's save writes, by its rule: every key the file held, at its current value, and
	/// every other value that differs from the default object's.
	/// </summary>
	/// <remarks>The game's own diff needs an assembly the test run does not load, so this states its rule for the values the migration touches.</remarks>
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
			_ => "null",
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
