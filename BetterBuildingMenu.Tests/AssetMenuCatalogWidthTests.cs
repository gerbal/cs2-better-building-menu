using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The build menu's width setting, which C# only keeps well-formed: the UI
	/// resolves the width it draws, since that depends on the control pane.
	/// </summary>
	public sealed class AssetMenuCatalogWidthTests
	{
		[Theory]
		[InlineData(float.NaN)]
		[InlineData(float.PositiveInfinity)]
		[InlineData(float.NegativeInfinity)]
		[InlineData(0f)]
		[InlineData(-5f)]
		public void AnythingThatIsNotAWidthIsFill(float width)
		{
			Assert.Equal(AssetMenuCatalogWidth.Fill, AssetMenuCatalogWidth.Sanitize(width));
		}

		[Fact]
		public void AWidthBelowTheMinimumIsTheMinimum()
		{
			Assert.Equal(AssetMenuCatalogWidth.Min, AssetMenuCatalogWidth.Sanitize(100f));
		}

		[Theory]
		[InlineData(735f)]
		[InlineData(900f)]
		[InlineData(99999f)]
		public void AnyOtherWidthIsKeptForTheUiToFit(float width)
		{
			Assert.Equal(width, AssetMenuCatalogWidth.Sanitize(width));
		}

		[Fact]
		public void TheNarrowestMenuAndThePaneFitInTheBand()
		{
			// If this fails, a menu at its minimum pushes the pane past the band.
			Assert.True(AssetMenuCatalogWidth.Min + AssetMenuWidth.ControlPane <= AssetMenuWidth.Max);
		}
	}
}
