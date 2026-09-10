using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// PrefabUISystem.RequiredResourceBinder's rule for a water building: ground
	/// water when that flag is set, surface water otherwise, and nothing at all
	/// when the component allows no type.
	/// </summary>
	public sealed class WaterSourceTests
	{
		[Fact]
		public void GroundWaterWinsWhenBothAreAllowed()
		{
			Assert.Equal("GroundWater", WaterSource.Describe(groundwater: true, surfaceWater: true));
		}

		[Fact]
		public void SurfaceWaterWhenOnlyThatIsAllowed()
		{
			Assert.Equal("SurfaceWater", WaterSource.Describe(groundwater: false, surfaceWater: true));
		}

		[Fact]
		public void NothingWhenNoTypeIsAllowed()
		{
			Assert.Null(WaterSource.Describe(groundwater: false, surfaceWater: false));
		}
	}
}
