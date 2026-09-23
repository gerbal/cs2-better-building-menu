using BetterBuildingMenu.Domain;

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The ids and numbers C# and the UI both use, owned here and generated into the UI.
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
			var path = Path.Combine(RepoRoot(), GeneratedPath);
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

		private static void AppendUnion(StringBuilder ts, string name, IEnumerable<string> values) =>
			ts.Append($"export type {name} = {string.Join(" | ", values.Select(Quote))};\n");

		private static string Quote(string value) =>
			"\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";

		private static string RepoRoot()
		{
			var dir = new DirectoryInfo(Directory.GetCurrentDirectory());

			while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "BetterBuildingMenu")))
			{
				dir = dir.Parent;
			}

			Assert.NotNull(dir);

			return dir!.FullName;
		}
	}
}
