using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The game's tooltips bind a fraction as a whole percentage, so the index
	/// converts before it states one.
	/// </summary>
	public sealed class PercentTests
	{
		[Fact]
		public void AFractionBecomesTheWholePercentageTheGameShows()
		{
			Assert.Equal(60, Percent.FromFraction(0.6f));
			Assert.Equal(120, Percent.FromFraction(1.2f));
			Assert.Equal(0, Percent.FromFraction(0.004f));
		}
	}
}
