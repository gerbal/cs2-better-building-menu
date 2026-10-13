using BetterBuildingMenu.Domain;

using Game.Settings;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The view 0.2.5 kept, as the settings file holds it for the migration to read.</summary>
	public sealed class AssetMenuViewModeTests
	{
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

		[Fact]
		public void EveryKindTheInterimKeptBecomesABody()
		{
			Assert.All(AssetMenuViewMode.Kinds, kind => Assert.Contains(BodyViews.FromRemembered(kind), BodyViews.Kinds));
		}

		[Fact]
		public void SanitizeReadsTheKindsRatherThanSpellingThem()
		{
			// Kinds is the list tied to the UI above; a second spelling in Sanitize could drift from it.
			var source = ModSource.Text("Domain/AssetMenuViewMode.cs");
			var start = source.IndexOf("public static string Sanitize", StringComparison.Ordinal);
			var body = source.Substring(start, source.IndexOf(';', start) - start);

			Assert.Contains("Kinds", body);

			foreach (var kind in AssetMenuViewMode.Kinds)
			{
				Assert.DoesNotContain($"\"{kind}\"", body);
			}
		}

		[Fact]
		public void TheSettingIsHidden()
		{
			var property = typeof(BetterBuildingMenuSettings).GetProperty(nameof(BetterBuildingMenuSettings.AssetMenuViewMode));

			Assert.NotNull(property);
			Assert.True(property!.IsDefined(typeof(SettingsUIHiddenAttribute), inherit: false));
		}
	}
}
