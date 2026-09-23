using Colossal.PSI.Common;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;

using System;
using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The Content facet, which covers only what the game's own row cannot.
	/// </summary>
	/// <remarks>
	/// Vanilla's tool-options panel is on screen while the lens is open and already
	/// holds Theme and Pack, so packs are not offered here. What is left is the part
	/// it cannot express: a DLC shipping no creator pack, reachable only by DlcId.
	/// </remarks>
	public class ContentFacetTests : IDisposable
	{
		private readonly VanillaToolbarSelection _previousSelection = BuildingCatalogAdapter.ToolbarSelection;

		// Every test here reads the facet with nothing picked in the game's own row. The
		// selection is process-wide, so Dispose puts it back, pass or fail.
		public ContentFacetTests() => BuildingCatalogAdapter.ToolbarSelection = VanillaToolbarSelection.None;

		public void Dispose() => BuildingCatalogAdapter.ToolbarSelection = _previousSelection;

		private static readonly BuildingCatalogEntry Base = new(
			Id: 0,
			PrefabName: "Base",
			Name: "Base",
			Category: "ServiceBuildings",
			SubCategory: "Any",
			Thumbnail: "",
			LotWidth: 1,
			LotDepth: 1,
			BuildingLevel: 1,
			ZoneType: Domain.Enums.ZoneTypeFilter.Any,
			HasParking: false,
			IsVanilla: true,
			PdxModsId: "");

		private static BuildingCatalogEntry Entry(int id, params int[] packs) =>
			Base with { Id = id, PrefabName = $"Entry{id}", AssetPackIndices = packs };

		private static BuildingCatalogFacetGroup? ContentGroup(params BuildingCatalogEntry[] entries) =>
			BuildingCatalogAdapter
				.BuildFacetState(entries, new BuildingCatalogQuery())
				.Groups
				.FirstOrDefault(group => group.Id == "content");

		[Fact]
		public void NoPackIsEverOffered()
		{
			// The rule this file exists for: two assets carrying packs and nothing
			// else describe the control the game already draws.
			var group = ContentGroup(Entry(1, 4211), Entry(2, 4212));

			// Nothing left to say, so the group does not draw at all.
			Assert.Null(group);
		}

		[Fact]
		public void ADlcWithNoPackIsStillOffered()
		{
			// Vanilla's Pack row is built from packs, so a DLC that ships none is
			// unreachable there. This is the whole remaining job of the group.
			var sanFrancisco = Base with { Id = 1, PrefabName = "SF", DlcId = "1" };
			var landmarks = Base with { Id = 2, PrefabName = "LM", DlcId = "2" };

			var group = ContentGroup(sanFrancisco, landmarks);

			Assert.NotNull(group);
			var ids = group!.Options.Select(option => option.Id).ToArray();
			Assert.Contains("dlc:1", ids);
			Assert.Contains("dlc:2", ids);
			Assert.DoesNotContain(ids, id => id.StartsWith("pack:"));
		}

		[Fact]
		public void ADlcAPackSpeaksForIsLeftToTheGamesOwnRow()
		{
			// Bridges & Ports has both a pack and a DLC id. Offering it here would
			// duplicate the game's Pack row entry for the same content.
			var bridges = Entry(1, 4211) with { DlcId = "77" };
			var sanFrancisco = Base with { Id = 2, PrefabName = "SF", DlcId = "1" };
			// A second pack-less DLC, because one option is not a choice and the
			// group drops itself — which would pass this test for the wrong
			// reason, by there being no group to find dlc:77 in.
			var landmarks = Base with { Id = 3, PrefabName = "LM", DlcId = "2" };

			var group = ContentGroup(bridges, sanFrancisco, landmarks);

			Assert.NotNull(group);
			var ids = group!.Options.Select(option => option.Id).ToArray();
			Assert.Contains("dlc:1", ids);
			Assert.Contains("dlc:2", ids);
			Assert.DoesNotContain("dlc:77", ids);
			Assert.DoesNotContain(ids, id => id.StartsWith("pack:"));
		}

		[Fact]
		public void BaseGameLeadsWhenSomethingNeedsNoDlc()
		{
			// "Show me only what needs no DLC" is the same question the DLC options
			// answer, and it reads first the way it does in the game's own row.
			var vanilla = Base with { Id = 1, PrefabName = "V", DlcId = GameDlcIds.BaseGame.ToString(System.Globalization.CultureInfo.InvariantCulture) };
			var sanFrancisco = Base with { Id = 2, PrefabName = "SF", DlcId = "1" };

			var group = ContentGroup(vanilla, sanFrancisco);

			Assert.NotNull(group);
			Assert.Equal("vanilla", group!.Options[0].Id);
		}
	}
}
