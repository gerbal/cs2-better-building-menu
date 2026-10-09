using BetterBuildingMenu.Domain;

using Game.Settings;

using System.IO;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The view the player picked in the control pane, as the settings file keeps it.</summary>
	public sealed class AssetMenuViewModeTests
	{
		private static string RepoFile(string relative, [CallerFilePath] string testFile = "") =>
			Path.GetFullPath(Path.Combine(Path.GetDirectoryName(testFile)!, "..", relative));

		[Theory]
		[InlineData("grid")]
		[InlineData("list")]
		[InlineData("cards")]
		[InlineData("table")]
		public void KeepsTheFourKinds(string kind)
		{
			Assert.Equal(kind, AssetMenuViewMode.Sanitize(kind));
		}

		[Theory]
		[InlineData(null)]
		[InlineData("")]
		[InlineData("tiles")]
		[InlineData("Grid")]
		[InlineData(" list")]
		public void ReadsAnythingElseAsNoPick(string? value)
		{
			Assert.Equal(AssetMenuViewMode.None, AssetMenuViewMode.Sanitize(value));
		}

		[Theory]
		[InlineData("list", "list", false)]
		[InlineData("", "", false)]
		[InlineData("list", "grid", true)]
		[InlineData("", "cards", true)]
		[InlineData("list", "", true)]
		[InlineData("tiles", "", true)]
		public void SavesOnlyWhenThePickChangesWhatIsStored(string stored, string picked, bool save)
		{
			Assert.Equal(save, AssetMenuViewMode.ShouldSave(stored, picked));
		}

		[Fact]
		public void TheKindsAreTheViewsTheUiDraws()
		{
			var source = File.ReadAllText(RepoFile("BetterBuildingMenu/UI/src/mods/GroupedResults/GroupedResults.tsx"));
			var union = Regex.Match(source, @"export type CatalogViewMode = ([^;]+);").Groups[1].Value;
			var uiKinds = Regex.Matches(union, "\"(\\w+)\"").Select(match => match.Groups[1].Value);

			Assert.Equal(uiKinds.OrderBy(kind => kind, StringComparer.Ordinal), AssetMenuViewMode.Kinds.OrderBy(kind => kind, StringComparer.Ordinal));
		}

		[Fact]
		public void SanitizeReadsTheKindsRatherThanSpellingThem()
		{
			// Kinds is the list tied to the UI above; a second spelling in Sanitize could drift from it.
			var source = File.ReadAllText(RepoFile("BetterBuildingMenu/Domain/AssetMenuViewMode.cs"));
			var start = source.IndexOf("public static string Sanitize", StringComparison.Ordinal);
			var body = source.Substring(start, source.IndexOf(';', start) - start);

			Assert.Contains("Kinds", body);

			foreach (var kind in AssetMenuViewMode.Kinds)
			{
				Assert.DoesNotContain($"\"{kind}\"", body);
			}
		}

		[Fact]
		public void TheSettingIsHiddenStartsUnpickedAndSetDefaultsForgetsThePick()
		{
			var property = typeof(BetterBuildingMenuSettings).GetProperty(nameof(BetterBuildingMenuSettings.AssetMenuViewMode));

			Assert.NotNull(property);
			Assert.True(property!.IsDefined(typeof(SettingsUIHiddenAttribute), inherit: false));

			var source = File.ReadAllText(RepoFile("BetterBuildingMenu/Setting.cs"));

			Assert.Contains("public string AssetMenuViewMode { get; set; } = Domain.AssetMenuViewMode.None;", source);
			Assert.Contains(
				"AssetMenuViewMode = Domain.AssetMenuViewMode.None;",
				source.Substring(source.IndexOf("public override void SetDefaults()", StringComparison.Ordinal)));
		}
	}
}
