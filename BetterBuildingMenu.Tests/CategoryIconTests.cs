using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class CategoryIconTests
	{
		[Fact]
		public void KeepsAVanillaCategoryIcon()
		{
			Assert.Equal("Media/Game/Icons/Police.svg",
				CategoryIcon.Resolve("Media/Game/Icons/Police.svg", "something/else.svg"));
		}

		[Fact]
		public void SkipsAContentHashTheToolButtonCannotDraw()
		{
			// Asset UI Manager's runtime categories carry one of these; the game's
			// own tab bar resolves it, an img src does not.
			Assert.Equal("Media/Game/Icons/Police.svg",
				CategoryIcon.Resolve("assetdb://global/b0bf5f452d231f5eaf5f60c537352cbe", "Media/Game/Icons/Police.svg"));
		}

		[Fact]
		public void FallsBackToTheImageSystemWhenThePrefabHasNoIcon()
		{
			Assert.Equal("coui://ail/Police.svg", CategoryIcon.Resolve(null, "coui://ail/Police.svg"));
			Assert.Equal("coui://ail/Police.svg", CategoryIcon.Resolve(" ", "coui://ail/Police.svg"));
		}

		[Fact]
		public void PrefersAnAssetDatabasePathOverAContentHash()
		{
			// The game's own icon lookup hands back a path into the mod's archive,
			// which draws; the prefab's own field holds the hash, which does not.
			Assert.Equal(
				"assetdb://user/Mods/AssetUIManager/Asset%20UI%20Manager.cok@Icons/Prisons.svg",
				CategoryIcon.Resolve(
					"assetdb://global/2de3e193e05bcb956df54c75445d9c5c",
					"assetdb://user/Mods/AssetUIManager/Asset%20UI%20Manager.cok@Icons/Prisons.svg"));
		}

		[Fact]
		public void KeepsTheHashWhenThereIsNothingBetter()
		{
			Assert.Equal("assetdb://global/abc", CategoryIcon.Resolve("assetdb://global/abc", "assetdb://global/def"));
		}

		[Fact]
		public void IsEmptyWhenNeitherSideOffersOne()
		{
			Assert.Equal(string.Empty, CategoryIcon.Resolve(null, null));
		}

		[Theory]
		// The address the game's own tab bar draws for a mod's category, which the page loads.
		[InlineData("assetdb://Global/119d34108770f515c464a0227a3c854a", true)]
		[InlineData("Media/Game/Icons/Roads.svg", true)]
		// The exact prefix ResolveUri still resolves: not yet an address the page can load.
		[InlineData("assetdb://global/119d34108770f515c464a0227a3c854a", false)]
		[InlineData("", false)]
		[InlineData("   ", false)]
		[InlineData(null, false)]
		public void APictureCanBeDrawnWhenTheGameWouldPublishItAsItIs(string? icon, bool drawn)
		{
			Assert.Equal(drawn, CategoryIcon.IsResolvable(icon));
		}

		[Fact]
		public void KeepsTheIconTheGamesOwnTabDraws()
		{
			// A mod's category whose icon is an asset-database address the game passes through as it
			// is: the game's tab bar draws that picture, so BBM's tab draws it too.
			const string published = "assetdb://Global/119d34108770f515c464a0227a3c854a";

			Assert.Equal(published, CategoryIcon.Resolve(published, published));
			Assert.Equal(published, CategoryIcon.Chain(published, "Media/Game/Icons/Roads.svg"));
		}

		[Theory]
		[InlineData("Media/Game/Icons/Ship.svg", "Media/Game/Icons/Transportation.svg", "Media/Game/Icons/Ship.svg")]
		[InlineData("assetdb://global/2de3e193e05bcb956df54c75445d9c5c", "Media/Game/Icons/Transportation.svg", "Media/Game/Icons/Transportation.svg")]
		[InlineData("", "Media/Game/Icons/Transportation.svg", "Media/Game/Icons/Transportation.svg")]
		[InlineData(null, "assetdb://global/abc", CategoryIcon.Placeholder)]
		public void ATabDrawsItsOwnIconThenItsMenusThenTheGamesPlaceholder(string? own, string? menu, string drawn)
		{
			Assert.Equal(drawn, CategoryIcon.Chain(own, menu));
		}
	}
}
