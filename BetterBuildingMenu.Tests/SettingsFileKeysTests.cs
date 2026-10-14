using BetterBuildingMenu.Domain;

using Colossal.Json;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The key names BBM's settings file held, which say whether an earlier release wrote it.</summary>
	public sealed class SettingsFileKeysTests
	{
		private static string[] Sorted(IEnumerable<string> keys) => keys.OrderBy(key => key, StringComparer.Ordinal).ToArray();

		[Fact]
		public void ReadsTheKeysOfTheParsedFile()
		{
			var keys = SettingsFileKeys.Of(new[] { JSON.Load("{\"AssetMenuHeight\": 155, \"ControlPaneShown\": true}") });

			Assert.Equal(new[] { "AssetMenuHeight", "ControlPaneShown" }, Sorted(keys));
		}

		[Fact]
		public void JoinsTheKeysOfEveryFragment()
		{
			var keys = SettingsFileKeys.Of(new[]
			{
				JSON.Load("{\"AssetMenuHeight\": 155}"),
				JSON.Load("{\"AssetMenuHeight\": 420, \"SettingsVersion\": 1}"),
			});

			Assert.Equal(new[] { "AssetMenuHeight", "SettingsVersion" }, Sorted(keys));
		}

		[Fact]
		public void AFragmentThatIsMissingOrNotAnObjectHoldsNoKeys()
		{
			Assert.Empty(SettingsFileKeys.Of(new Variant?[] { null, JSON.Load("[1, 2]"), JSON.Load("7") }));
		}

		[Fact]
		public void ReadsTheFileTextAfterTheLineThatNamesTheSetting()
		{
			// As the game writes it: the setting's name, then the JSON; a nested value is one key.
			const string Text = "BetterBuildingMenu\r\n{\n    \"AssetMenuCatalogWidth\": 735,\n    \"ApplyMimic\": {\n        \"m_Path\": \"<Mouse>/rightButton\"\n    },\n    \"SettingsVersion\": 1\n}\r\n";

			Assert.Equal(new[] { "ApplyMimic", "AssetMenuCatalogWidth", "SettingsVersion" }, Sorted(SettingsFileKeys.FromFileText(Text)));
		}

		[Theory]
		[InlineData(null)]
		[InlineData("")]
		[InlineData("BetterBuildingMenu")]
		[InlineData("BetterBuildingMenu\r\n")]
		[InlineData("BetterBuildingMenu\r\n{ broken")]
		[InlineData("BetterBuildingMenu\r\n[1, 2]")]
		[InlineData("{\"AssetMenuHeight\": 155}")]
		public void TextThatHoldsNoSettingsGivesNoKeys(string? text)
		{
			Assert.Empty(SettingsFileKeys.FromFileText(text));
		}
	}
}
