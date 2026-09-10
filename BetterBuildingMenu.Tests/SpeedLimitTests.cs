using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The component the index reads holds metres per second while the prefab and
	/// the sign posts speak km/h. The catalog states km/h, so it converts back the
	/// way the signs do.
	/// </summary>
	public sealed class SpeedLimitTests
	{
		[Fact]
		public void TheComponentsMetresPerSecondBecomeTheSignsKilometresPerHour()
		{
			Assert.Equal(80f, SpeedLimit.KilometresPerHour(80f / 3.6f), 3);
			Assert.Equal(20f, SpeedLimit.KilometresPerHour(20f / 3.6f), 3);
		}
	}
}
