using BetterBuildingMenu.Domain;

namespace BetterBuildingMenu.Tests
{
	/// <summary>What the UI reads of the developer knobs, and that a knob moved in Options reaches it.</summary>
	public sealed class TuningValuesTests
	{
		[Fact]
		public void TheUiReadsDeveloperModeAndEachKnobItUses()
		{
			var writer = new RecordingJsonWriter();

			new TuningValues(DeveloperMode: true, InterfaceStyles: false, TabNames: true).Write(writer);

			Assert.Equal(new[] { "developerMode", "interfaceStyles", "tabNames" }, writer.PropertyNames);
			Assert.Equal(
				new[] { "Write:Boolean:True", "Write:Boolean:False", "Write:Boolean:True" },
				writer.Tokens.Where(token => token.StartsWith("Write:", StringComparison.Ordinal)));
		}

		[Fact]
		public void AKnobMovedInOptionsReachesTheUiAtOnce()
		{
			var applied = ModSource.Member(ModSource.Text("Systems/BuildingMenuUISystem.cs"), "private void OnSettingsApplied(");

			Assert.Contains("_AssetMenuTuning.Value = CurrentTuning();", applied);
		}

		[Fact]
		public void TheTabNamesKnobShipsOnAndIsReadThroughTheOneRule()
		{
			Assert.True(Tuning.TabNames);
			Assert.Contains(
				"Knobs.Value(settings => settings.DevTabNames, Tuning.TabNames)",
				ModSource.Text("Systems/BuildingMenuUISystem.cs"));
		}
	}
}
