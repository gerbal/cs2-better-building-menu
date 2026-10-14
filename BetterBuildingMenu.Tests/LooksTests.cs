using BetterBuildingMenu.Domain;

using System.Text.RegularExpressions;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The Look as the settings keep it: the finished looks, what any other value reads as, and the one pick VIEW and Options share.</summary>
	public sealed class LooksTests
	{
		[Theory]
		[InlineData("standard", "standard")]
		[InlineData("plates", "plates")]
		[InlineData("glass", "standard")]
		[InlineData("cards", "standard")]
		[InlineData("Plates", "standard")]
		[InlineData("", "standard")]
		[InlineData(null, "standard")]
		public void ALookIsAFinishedOneAndAnythingElseReadsAsStandard(string? value, string read)
		{
			Assert.Equal(read, Looks.Sanitize(value));
		}

		[Fact]
		public void TheFinishedLooksAreStandardThenPlates()
		{
			Assert.Equal(new[] { Looks.Standard, Looks.Plates }, Looks.Shipped);
		}

		[Fact]
		public void TheUiOffersTheLooksCSharpKeeps()
		{
			var looks = ModSource.Text("UI/src/domain/looks.ts");
			var entries = Regex.Matches(looks, @"\{ id: ""(\w+)"", released: (true|false)").Select(match => (Id: match.Groups[1].Value, Released: match.Groups[2].Value == "true")).ToList();

			Assert.Equal(new[] { Looks.Standard, Looks.Glass, Looks.Plates, Looks.Line, Looks.Cards }, entries.Select(entry => entry.Id));
			Assert.Equal(Looks.Shipped, entries.Where(entry => entry.Released).Select(entry => entry.Id));
		}

		[Fact]
		public void ALookPickIsKeptPublishedAndSavedOnlyWhenItChanges()
		{
			var pick = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.AssetMenuSize.cs"), "private void SetAssetMenuLook(");

			Assert.Contains("var look = Looks.Sanitize(picked); _AssetMenuLook.Value = look;", pick);
			Assert.Contains("if (string.Equals(Mod.Settings.MenuLook, look, StringComparison.Ordinal)) { return; }", pick);
			Assert.Contains("Mod.Settings.MenuLook = look; Mod.Settings.ApplyAndSave();", pick);
		}

		[Fact]
		public void TheLookFollowsOptionsAtOnce()
		{
			Assert.Contains(
				"_AssetMenuLook.Value = Looks.Sanitize(Mod.Settings.MenuLook);",
				ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private void OnSettingsApplied("));
		}
	}
}
