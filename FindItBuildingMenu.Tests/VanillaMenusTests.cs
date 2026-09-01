using FindItBuildingMenu.Domain;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class VanillaMenusTests
	{
		[Theory]
		[InlineData("Zones")]
		[InlineData("zones")]
		[InlineData("  Zones ")]
		public void RecognisesTheZonesMenuTheWayTheToolbarNamesIt(string menu)
		{
			Assert.True(VanillaMenus.IsZones(menu));
		}

		[Theory]
		[InlineData("Roads")]
		[InlineData("Signatures")]
		[InlineData("")]
		[InlineData(null)]
		public void EveryOtherMenuIsNotZones(string? menu)
		{
			Assert.False(VanillaMenus.IsZones(menu));
		}

		[Fact]
		public void TheRoadsNameIsTheOneTheNetworkExtensionAlreadyUses()
		{
			Assert.Equal(NetworkMenuExtension.RoadsMenu, VanillaMenus.Roads);
		}
	}
}
