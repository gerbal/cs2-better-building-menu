using BetterBuildingMenu.Domain;

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The ids, numbers and triggers C# and the UI both use, owned here and generated into the UI.
	/// </summary>
	/// <remarks>
	/// The UI reads them from sharedContracts.generated.ts, which this test writes from the C#
	/// constants. It fails while the committed file and the C# disagree; run it with
	/// CS2_WRITE_CONTRACTS=1 to write the file, then commit it.
	/// </remarks>
	public sealed class SharedContractsTests
	{
		private const string GeneratedPath = "BetterBuildingMenu/UI/src/domain/sharedContracts.generated.ts";

		[Fact]
		public void TheUiCopyIsGeneratedFromTheCSharp()
		{
			var path = Path.Combine(TestPaths.RepoRoot(), GeneratedPath);
			var expected = RenderTypeScript();

			if (Environment.GetEnvironmentVariable("CS2_WRITE_CONTRACTS") == "1")
			{
				File.WriteAllText(path, expected);
			}

			Assert.True(File.Exists(path), $"{GeneratedPath} is missing; run the tests with CS2_WRITE_CONTRACTS=1");
			Assert.True(
				expected == File.ReadAllText(path).Replace("\r\n", "\n"),
				$"{GeneratedPath} is out of date with the C#; run the tests with CS2_WRITE_CONTRACTS=1 and commit it");
		}

		[Fact]
		public void TheTriggerReaderFindsEveryTriggerWithTheArgumentsCSharpReads()
		{
			var triggers = TriggerRegistrations.Read().ToDictionary(trigger => trigger.Name, trigger => string.Join(", ", trigger.Arguments));

			Assert.True(triggers.Count > 20, $"the reader found {triggers.Count} triggers");
			Assert.Equal("", triggers["SearchEverything"]);
			Assert.Equal("string", triggers["SearchChanged"]);
			Assert.Equal("number", triggers["SetAssetMenuHeight"]);
			Assert.Equal("string, string, boolean, boolean", triggers["SetVanillaToolbarSelection"]);
			// Read/write bindings: the setter takes the binding's type, from the field it is assigned to.
			Assert.Equal("boolean", triggers["SetBuildingCatalogSortDescending"]);
			Assert.Equal("number", triggers["SetAssetMenuSchoolTier"]);
			// A setting binding makes its read/write binding in a lambda: the setter takes what its callback takes.
			Assert.Equal("string", triggers["SetAssetMenuViewMode"]);
		}

		[Fact]
		public void ARegistrationTheReaderCannotTypeStopsTheGenerator()
		{
			// Each would otherwise leave a trigger out of the UI's table, or give it the wrong arguments.
			Assert.Throws<InvalidOperationException>(() => TriggerRegistrations.Parse("CreateTrigger(TriggerName, Handler);"));
			Assert.Throws<InvalidOperationException>(() => TriggerRegistrations.Parse("CreateTrigger<Entity>(\"Pick\", Handler);"));
			Assert.Throws<InvalidOperationException>(() => TriggerRegistrations.Parse("CreateBinding(\"Value\", \"SetValue\", 0, SetValue);"));
			Assert.Throws<InvalidOperationException>(() => TriggerRegistrations.Parse("CreateTrigger(\"Twice\", A); CreateTrigger(\"Twice\", B);"));
			// A read/write binding whose trigger is not named by a literal.
			Assert.Throws<InvalidOperationException>(() => TriggerRegistrations.Parse("CreateBinding<int>(\"X\", nameof(SetX), 0, SetX);"));
			Assert.Throws<InvalidOperationException>(() => TriggerRegistrations.Parse("CreateBinding<int>(\"X\", SetXTrigger, 0, SetX);"));
		}

		[Fact]
		public void AValueBindingRegistersNoTrigger()
		{
			// Two arguments, a name and a first value, whatever that value is.
			Assert.Empty(TriggerRegistrations.Parse("ValueBindingHelper<string> _ViewMode; _ViewMode = CreateBinding(\"ViewMode\", \"grid\");"));
			Assert.Empty(TriggerRegistrations.Parse("_CurrentSearch = CreateBinding(\"CurrentSearch\", \"\");"));
			Assert.Empty(TriggerRegistrations.Parse("_Counts = CreateBinding(\"Counts\", new Dictionary<string, int>());"));
		}

		[Fact]
		public void AReadWriteBindingIsReadByItsTopLevelArguments()
		{
			var triggers = TriggerRegistrations.Parse("CreateBinding(\"Pick\", \"SetPick\", Math.Max(0, start), SetPick); void SetPick(int pick) { }");

			Assert.Equal(new[] { "SetPick: number" }, triggers.Select(trigger => $"{trigger.Name}: {string.Join(", ", trigger.Arguments)}"));
		}

		[Fact]
		public void TheReaderSkipsComments()
		{
			Assert.Equal(new[] { "Real" }, TriggerRegistrations.Parse("// CreateTrigger registers it\nCreateTrigger(\"Real\", A);").Select(trigger => trigger.Name));
			Assert.Equal(
				new[] { "Real" },
				TriggerRegistrations.Parse("// CreateTrigger(\"Old\", A);\n/* CreateTrigger<int>(\"Older\", B); */\nCreateTrigger(\"Real\", A);").Select(trigger => trigger.Name));
			// A comment marker inside a string is text, and hides nothing after it.
			Assert.Equal(new[] { "Real" }, TriggerRegistrations.Parse("var url = \"a // b\"; CreateTrigger(\"Real\", A);").Select(trigger => trigger.Name));
		}

		[Fact]
		public void EveryFacetTheAdapterEmitsIsOneAToggleActsOn()
		{
			// The rail sends back the id it was given. An id the toggle does not
			// know leaves the query as it was, so the click does nothing, silently.
			var query = new BuildingCatalogQuery();

			foreach (var facet in FacetIds.All)
			{
				var option = facet switch
				{
					FacetIds.Availability => BuildingCatalogFacetSelection.Availability.Locked,
					FacetIds.Content => ContentOption.Dlc + "1",
					_ => "Anything",
				};

				Assert.True(
					BuildingCatalogFacetSelection.Toggle(query, facet, option) != query,
					$"toggling {facet} changed nothing");
			}
		}

		private static string RenderTypeScript()
		{
			var ts = new StringBuilder();

			ts.Append("// Generated from the C# that owns these values, by SharedContractsTests in\n");
			ts.Append("// BetterBuildingMenu.Tests. Do not edit: change the C#, then run\n");
			ts.Append("//   CS2_WRITE_CONTRACTS=1 ./build.sh test\n");
			ts.Append("// and commit the result. CI fails while this file and the C# disagree.\n");

			ts.Append("\n/** BuildingCatalogQuery.OfferedSortColumns, in the picker's order. */\n");
			AppendArray(ts, "SORT_COLUMNS", BuildingCatalogQuery.OfferedSortColumns);
			ts.Append("\nexport type SortColumn = (typeof SORT_COLUMNS)[number];\n");

			ts.Append("\n/** BuildingCatalogGrouping.Dimensions, in the picker's order. */\n");
			AppendArray(ts, "GROUP_DIMENSION_IDS", BuildingCatalogGrouping.Dimensions);
			ts.Append("\nexport type GroupDimensionId = (typeof GROUP_DIMENSION_IDS)[number];\n");

			ts.Append("\n/** FacetIds.All: every filter dimension the backend can emit. */\n");
			AppendUnion(ts, "FacetId", FacetIds.All);

			ts.Append("\n/** BuildingCatalogFacetSelection.Availability.All: the states every asset is in one of. */\n");
			AppendUnion(ts, "AvailabilityOption", BuildingCatalogFacetSelection.Availability.All);

			ts.Append("\n/** BuildingCatalogQuery.WindowStep: how many rows one Load more adds. */\n");
			ts.Append($"export const CATALOG_WINDOW_STEP = {BuildingCatalogQuery.WindowStep};\n");

			ts.Append("\n/** AssetMenuHeight: the catalog height the player drags between, and where it starts. */\n");
			AppendNumber(ts, "ASSET_MENU_MIN_HEIGHT", AssetMenuHeight.Min);
			AppendNumber(ts, "ASSET_MENU_MAX_HEIGHT", AssetMenuHeight.Max);
			AppendNumber(ts, "ASSET_MENU_DEFAULT_HEIGHT", AssetMenuHeight.Default);

			ts.Append("\n/** AssetMenuWidth.Max: the band the build menu and its control pane may fill. */\n");
			AppendNumber(ts, "ASSET_MENU_MAX_WIDTH", AssetMenuWidth.Max);

			ts.Append("\n/** AssetMenuCatalogWidth: the build menu's narrowest width, the value that means the default, and how near the room a drag must end to fill it. */\n");
			AppendNumber(ts, "ASSET_MENU_CATALOG_MIN_WIDTH", AssetMenuCatalogWidth.Min);
			AppendNumber(ts, "ASSET_MENU_CATALOG_DEFAULT", AssetMenuCatalogWidth.Default);
			AppendNumber(ts, "ASSET_MENU_CATALOG_FILL_SNAP", AssetMenuCatalogWidth.FillSnap);

			ts.Append("\n/** Every trigger the mod's systems register, with the arguments C# reads; domain/commands builds from it. */\n");
			ts.Append("export interface TriggerArgs {\n");

			foreach (var trigger in TriggerRegistrations.Read())
			{
				ts.Append($"  {trigger.Name}: [{string.Join(", ", trigger.Arguments)}];\n");
			}

			ts.Append("}\n");

			return ts.ToString();
		}

		private static void AppendArray(StringBuilder ts, string name, IEnumerable<string> values)
		{
			ts.Append($"export const {name} = [\n");

			foreach (var value in values)
			{
				ts.Append($"  {Quote(value)},\n");
			}

			ts.Append("] as const;\n");
		}

		private static void AppendNumber(StringBuilder ts, string name, float value) =>
			ts.Append($"export const {name} = {value.ToString(CultureInfo.InvariantCulture)};\n");

		private static void AppendUnion(StringBuilder ts, string name, IEnumerable<string> values) =>
			ts.Append($"export type {name} = {string.Join(" | ", values.Select(Quote))};\n");

		private static string Quote(string value) =>
			"\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
	}
}
