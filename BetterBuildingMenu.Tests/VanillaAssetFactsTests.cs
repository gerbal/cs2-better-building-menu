using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// What the toolbar filter row knows about an asset, from what the indexer read off its entity:
	/// ToolbarUISystem's theme, pack and mod tests.
	/// </summary>
	public sealed class VanillaAssetFactsTests
	{
		private static readonly (int Index, bool IsTheme)[] NoRequirements = System.Array.Empty<(int, bool)>();

		[Fact]
		public void OnlyARequirementThatIsAThemeCountsAsOne()
		{
			var facts = VanillaAssetFacts.From(new[] { (11, true), (12, false), (13, true) }, null, false);

			Assert.Equal(new[] { 11, 13 }, facts.ThemeRequirements);
		}

		[Fact]
		public void NoPackBufferIsNotAnEmptyOne()
		{
			// No buffer is a base-game asset, which the Vanilla toggle gates; an empty one is not.
			Assert.False(VanillaAssetFacts.From(NoRequirements, null, false).HasPackBuffer);

			var empty = VanillaAssetFacts.From(NoRequirements, System.Array.Empty<(int, bool)>(), false);
			Assert.True(empty.HasPackBuffer);
			Assert.Empty(empty.AssetPacks);
		}

		[Fact]
		public void AModAssetInAModPackAnswersToThePackFilter()
		{
			var facts = VanillaAssetFacts.From(NoRequirements, new[] { (7, false), (8, true) }, hasModPrerequisite: true);

			Assert.False(facts.IsModAsset);
			Assert.Equal(new[] { 7, 8 }, facts.AssetPacks);
		}

		[Fact]
		public void AModAssetInNoModPackIsAModAsset()
		{
			Assert.True(VanillaAssetFacts.From(NoRequirements, new[] { (7, false) }, hasModPrerequisite: true).IsModAsset);
			Assert.True(VanillaAssetFacts.From(NoRequirements, null, hasModPrerequisite: true).IsModAsset);
		}

		[Fact]
		public void AModPackDoesNotMakeABaseGameAssetAModAsset()
		{
			Assert.False(VanillaAssetFacts.From(NoRequirements, new[] { (8, true) }, hasModPrerequisite: false).IsModAsset);
		}
	}
}
