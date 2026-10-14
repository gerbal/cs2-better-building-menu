using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class MenuToolsTests
	{
		[Theory]
		[InlineData("RoadBuilderTool", true)]
		[InlineData("MoveItTool", true)]
		// The game keeps its own menu up under a terraforming brush, and so does this one.
		[InlineData("Terrain Tool", false)]
		// Picking a zone arms the Zone tool, which must not close the Zones menu.
		[InlineData("Zone Tool", false)]
		[InlineData("Object Tool", false)]
		[InlineData("Net Tool", false)]
		public void OnlyAToolWithAScreenOfItsOwnClosesTheMenu(string toolId, bool takes)
		{
			Assert.Equal(takes, MenuTools.TakesTheScreen(toolId));
		}

		[Fact]
		public void TheToolChangeAsksTheRuleAndNamesNoSuchToolItself()
		{
			var handler = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.Placement.cs"), "private void OnToolChanged(ToolBaseSystem tool)");

			Assert.Contains("MenuTools.TakesTheScreen(tool.toolID)", handler);
			Assert.DoesNotContain("\"Terrain Tool\"", handler);
			Assert.DoesNotContain("\"RoadBuilderTool\"", handler);
		}
	}
}
