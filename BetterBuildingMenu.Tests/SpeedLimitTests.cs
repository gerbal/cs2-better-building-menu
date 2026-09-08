using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The prefab is authored in km/h (RoadPrefab.m_SpeedLimit = 100f) but the
	/// component the index reads holds metres per second: NetInitializeSystem
	/// divides by 3.6 on the way in, and the sign posts multiply by 3.6 on the
	/// way out (SecondaryObjectSystem). The catalog states km/h, so it converts
	/// back the way the signs do.
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
