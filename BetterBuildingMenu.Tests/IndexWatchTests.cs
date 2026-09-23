using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The panel's side of an index change: it asks for one republish per change, while open.
	/// </summary>
	public sealed class IndexWatchTests
	{
		[Fact]
		public void AsksOncePerChange()
		{
			var watch = new IndexWatch();
			watch.Published(1);

			Assert.True(watch.ShouldRefresh(panelOpen: true, generation: 2));
			Assert.False(watch.ShouldRefresh(panelOpen: true, generation: 2));
		}

		[Fact]
		public void AsksNothingForTheGenerationItPublished()
		{
			// A unique built mid-refresh bumps the generation before the publish reads it; the
			// publish already shows that change, so the next frame has nothing to ask for.
			var watch = new IndexWatch();
			watch.Published(5);

			Assert.False(watch.ShouldRefresh(panelOpen: true, generation: 5));
		}

		[Fact]
		public void AsksNothingWhileClosed()
		{
			var watch = new IndexWatch();
			watch.Published(1);

			Assert.False(watch.ShouldRefresh(panelOpen: false, generation: 2));
			Assert.False(watch.ShouldRefresh(panelOpen: false, generation: 3));
		}

		[Fact]
		public void AsksAgainForEachChangeInABurst()
		{
			// Each ask reschedules the debounce, so a run of partial passes is still one refresh.
			var watch = new IndexWatch();
			watch.Published(1);

			Assert.True(watch.ShouldRefresh(panelOpen: true, generation: 2));
			Assert.True(watch.ShouldRefresh(panelOpen: true, generation: 3));
			Assert.True(watch.ShouldRefresh(panelOpen: true, generation: 4));
		}

		[Fact]
		public void AChangeWhileClosedIsLeftToTheOpeningPublish()
		{
			// Opening the panel publishes, which records the generation; nothing is owed after.
			var watch = new IndexWatch();
			watch.Published(1);

			Assert.False(watch.ShouldRefresh(panelOpen: false, generation: 4));
			watch.Published(4);

			Assert.False(watch.ShouldRefresh(panelOpen: true, generation: 4));
		}
	}
}
