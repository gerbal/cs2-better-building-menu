using System;

using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class IconLookupTests
	{
		[Fact]
		public void HandsBackWhatTheLookupFound()
		{
			Assert.Equal("Media/Game/Icons/Police.svg",
				IconLookup.OrNull(() => "Media/Game/Icons/Police.svg", _ => throw new InvalidOperationException("not called")));
		}

		[Fact]
		public void AThrowingLookupCostsOnlyTheIcon()
		{
			// The game's thumbnail lookup throws when a prefab's icon names an
			// asset-database file that is missing. One such asset must not take its
			// row, or for a zone the whole index, down with it.
			Exception? reported = null;
			var missing = new InvalidOperationException("Asset not found");

			Assert.Null(IconLookup.OrNull(() => throw missing, ex => reported = ex));
			Assert.Same(missing, reported);
		}
	}
}
