using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class DevTreeNodeNameTests
	{
		[Fact]
		public void TheKeyIsTheOneTheDevTreeReads()
		{
			// As Locale.cok carries it: Progression.NODE_NAME[BasicRoadServiceNode].
			Assert.Equal("Progression.NODE_NAME[PoliceHeadquartersNode]", DevTreeNodeName.Key("PoliceHeadquartersNode"));
		}

		[Fact]
		public void TheLocalizedNameWins()
		{
			Assert.Equal("Polizeihauptquartier", DevTreeNodeName.Resolve("Polizeihauptquartier\r\n", "Police Headquarters Node"));
		}

		[Theory]
		[InlineData(null)]
		[InlineData("")]
		[InlineData("  ")]
		public void WithoutOneTheFallbackLosesItsNode(string? localized)
		{
			Assert.Equal("Police Headquarters", DevTreeNodeName.Resolve(localized, "Police Headquarters Node"));
		}

		[Theory]
		[InlineData("Space Center", "Space Center")]
		[InlineData("Node", "Node")]
		[InlineData("Nodes Node", "Nodes")]
		public void OnlyATrailingWordNodeIsDropped(string fallback, string expected)
		{
			Assert.Equal(expected, DevTreeNodeName.Resolve(null, fallback));
		}
	}
}
