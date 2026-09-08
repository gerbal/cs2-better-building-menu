using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The game's tooltip binds a fraction as a whole percentage — purification is
	/// Mathf.RoundToInt(100f * m_Purification), comfort (int)math.round(100f *
	/// m_ComfortFactor). The index passed the raw fraction, so a 60 % plant read
	/// "1 %" once rounded, or nothing when the fraction rounded to zero.
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
