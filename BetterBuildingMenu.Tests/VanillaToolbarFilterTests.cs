using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Asserted against the decompiled ToolbarUISystem.FilterByThemes and
	/// FilterByPacks rather than against what the filter ought to do: a "nicer"
	/// rule is an asset menu that shows a different set from the menu it replaces.
	/// </summary>
	public class VanillaToolbarFilterTests
	{
		private static VanillaAssetFacts Ungated() => new(null, null, false, false);

		private static VanillaAssetFacts ThemedBy(params int[] themes) => new(themes, null, false, false);

		private static VanillaAssetFacts InPacks(params int[] packs) => new(null, packs, true, false);

		private const int European = 11;
		private const int NorthAmerican = 22;

		[Fact]
		public void AnUntouchedToolbarHidesNothing()
		{
			// The early out both halves carry. Without it the asset menu opens empty,
			// which is how a filter nobody has set would announce itself.
			Assert.True(VanillaToolbarFilter.IsVisible(ThemedBy(European), VanillaToolbarSelection.None));
			Assert.True(VanillaToolbarFilter.IsVisible(InPacks(5), VanillaToolbarSelection.None));
		}

		[Fact]
		public void TheDefaultSelectionIsNone()
		{
			// The adapter takes the selection as a struct argument, so a default one must
			// read as an untouched toolbar rather than as a pair of null lists.
			var selection = default(VanillaToolbarSelection);

			Assert.Empty(selection.SelectedThemes);
			Assert.Empty(selection.SelectedPacks);
			Assert.True(selection.IsEmpty);
			Assert.True(VanillaToolbarFilter.IsVisible(InPacks(5), selection));
		}

		[Fact]
		public void AThemedAssetShowsOnlyUnderItsOwnTheme()
		{
			var eu = new VanillaToolbarSelection(new[] { European }, null, false, false);

			Assert.True(VanillaToolbarFilter.IsVisible(ThemedBy(European), eu));
			Assert.False(VanillaToolbarFilter.IsVisible(ThemedBy(NorthAmerican), eu));
		}

		[Fact]
		public void AnAssetWithNoThemeRequirementIgnoresTheThemeToggle()
		{
			// The flag in vanilla only turns on when it sees ThemeData, so an
			// asset carrying no theme requirement is not theme-gated and stays
			// visible whatever is selected. Most of the catalog is this case.
			var eu = new VanillaToolbarSelection(new[] { European }, null, false, false);

			Assert.True(VanillaToolbarFilter.IsVisible(Ungated(), eu));
		}

		[Fact]
		public void OneMatchingThemeIsEnoughAmongSeveralRequirements()
		{
			var eu = new VanillaToolbarSelection(new[] { European }, null, false, false);

			Assert.True(VanillaToolbarFilter.IsVisible(ThemedBy(NorthAmerican, European), eu));
		}

		[Fact]
		public void APackAssetShowsOnlyWhileItsPackIsSelected()
		{
			var pack = new VanillaToolbarSelection(null, new[] { 7 }, false, false);

			Assert.True(VanillaToolbarFilter.IsVisible(InPacks(7), pack));
			Assert.False(VanillaToolbarFilter.IsVisible(InPacks(8), pack));
		}

		[Fact]
		public void PickingAPackHidesBaseGameAssetsUnlessVanillaIsAlsoSelected()
		{
			// The case that makes HasPackBuffer worth carrying separately from an
			// empty pack list: a base-game asset has NO buffer, and vanilla gates
			// exactly that on the Vanilla toggle.
			var packOnly = new VanillaToolbarSelection(null, new[] { 7 }, false, false);
			var packAndVanilla = new VanillaToolbarSelection(null, new[] { 7 }, true, false);

			Assert.False(VanillaToolbarFilter.IsVisible(Ungated(), packOnly));
			Assert.True(VanillaToolbarFilter.IsVisible(Ungated(), packAndVanilla));
		}

		[Fact]
		public void ModAssetsAnswerToTheModsToggleAlone()
		{
			var modAsset = new VanillaAssetFacts(null, new[] { 7 }, true, isModAsset: true);
			var modsOn = new VanillaToolbarSelection(null, null, false, true);
			var vanillaOn = new VanillaToolbarSelection(null, null, true, false);

			// Even though its pack is not selected: vanilla checks IsModAsset
			// first and never reaches the pack comparison.
			Assert.True(VanillaToolbarFilter.IsVisible(modAsset, modsOn));
			Assert.False(VanillaToolbarFilter.IsVisible(modAsset, vanillaOn));
		}

		[Fact]
		public void APackAssetWithNoPackSelectedIsHiddenEvenWhenVanillaIsOn()
		{
			// Vanilla's third branch: a pack asset with an empty selection is
			// removed outright. Selecting "Vanilla" does not rescue it, because
			// it is not a base-game asset.
			var vanillaOn = new VanillaToolbarSelection(null, null, true, false);

			Assert.False(VanillaToolbarFilter.IsVisible(InPacks(7), vanillaOn));
		}

		[Fact]
		public void ThemeAndPackFiltersBothHaveToPass()
		{
			var facts = new VanillaAssetFacts(new[] { European }, new[] { 7 }, true, false);

			Assert.True(VanillaToolbarFilter.IsVisible(
				facts, new VanillaToolbarSelection(new[] { European }, new[] { 7 }, false, false)));
			// Right pack, wrong theme.
			Assert.False(VanillaToolbarFilter.IsVisible(
				facts, new VanillaToolbarSelection(new[] { NorthAmerican }, new[] { 7 }, false, false)));
			// Right theme, wrong pack.
			Assert.False(VanillaToolbarFilter.IsVisible(
				facts, new VanillaToolbarSelection(new[] { European }, new[] { 8 }, false, false)));
		}

		[Fact]
		public void SelectingBothThemesShowsBoth()
		{
			var both = new VanillaToolbarSelection(new[] { European, NorthAmerican }, null, false, false);

			Assert.True(VanillaToolbarFilter.IsVisible(ThemedBy(European), both));
			Assert.True(VanillaToolbarFilter.IsVisible(ThemedBy(NorthAmerican), both));
		}
	}
}
