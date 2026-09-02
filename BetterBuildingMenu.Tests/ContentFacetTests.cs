using Colossal.PSI.Common;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;

using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The Content facet, which now covers only what the game's own row cannot.
	/// </summary>
	/// <remarks>
	/// This file replaces AssetPackFacetTests, whose subject no longer exists.
	/// The rail used to offer packs; it does not, because vanilla's tool-options
	/// panel is on screen WHILE THE LENS IS OPEN and already holds Theme and
	/// Pack. Measured live at 720p in the Zones menu, that panel's Pack row
	/// carried 12 controls against the 10 options this group drew — so ours was
	/// not the wider reach an older comment claimed, just a second control for
	/// state the game owns.
	///
	/// What survives is the part vanilla cannot express: a DLC shipping no
	/// creator pack. Its Pack row has nothing to represent such a DLC with, so
	/// DlcIds is the only way to reach San Francisco Set and Landmark Buildings —
	/// 163 assets between them.
	/// </remarks>
	public class ContentFacetTests
	{
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
			IsUniqueMesh: false,
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
			// The rule this file exists for. Two assets carrying two registered
			// packs and nothing else: under the old code this group held
			// "pack:4211:1" and "pack:4212:3", which is precisely the control the
			// game draws a few hundred pixels away.
			AssetPackRegistry.Clear();
			AssetPackRegistry.Record(4211, 1, "Bridges And Ports Asset Pack");
			AssetPackRegistry.Record(4212, 3, "Dragon Gate Pack");
			BuildingCatalogAdapter.ToolbarSelection = VanillaToolbarSelection.None;

			var group = ContentGroup(Entry(1, 4211), Entry(2, 4212));

			// Nothing left to say, so the group does not draw at all.
			Assert.Null(group);
		}

		[Fact]
		public void ADlcWithNoPackIsStillOffered()
		{
			// Vanilla's Pack row is built from packs, so a DLC that ships none is
			// unreachable there. This is the whole remaining job of the group.
			AssetPackRegistry.Clear();
			BuildingCatalogAdapter.ToolbarSelection = VanillaToolbarSelection.None;

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
			// duplicate the game's Pack row entry for the same content, which is
			// the duplication this change removed — so it appears there, not here.
			AssetPackRegistry.Clear();
			AssetPackRegistry.Record(4211, 1, "Bridges And Ports Asset Pack");
			BuildingCatalogAdapter.ToolbarSelection = VanillaToolbarSelection.None;

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
			// Kept from the merged group: "show me only what needs no DLC" is the
			// same question the DLC options answer, and it reads first the way it
			// does in the game's own row.
			AssetPackRegistry.Clear();
			BuildingCatalogAdapter.ToolbarSelection = VanillaToolbarSelection.None;

			var vanilla = Base with { Id = 1, PrefabName = "V", DlcId = DlcId.BaseGame.id.ToString(System.Globalization.CultureInfo.InvariantCulture) };
			var sanFrancisco = Base with { Id = 2, PrefabName = "SF", DlcId = "1" };

			var group = ContentGroup(vanilla, sanFrancisco);

			Assert.NotNull(group);
			Assert.Equal("vanilla", group!.Options[0].Id);
		}
	}
}
