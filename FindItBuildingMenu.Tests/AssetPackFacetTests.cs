using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Services;

using System.Linq;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The pack facet, which is a view onto the GAME's selection.
	/// </summary>
	/// <remarks>
	/// Packs are the one axis vanilla already owns: it draws a Pack row, holds
	/// the selection in toolbar.selectedAssetPacks, and the lens filters on it
	/// through VanillaToolbarFilter. The rail used to keep a second field, so
	/// two controls narrowed the same set from two different states — and
	/// measured in game they did not even offer the same packs.
	/// </remarks>
	public class AssetPackFacetTests
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
			IsFavorited: false,
			PdxModsId: "");

		private static BuildingCatalogEntry Entry(int id, params int[] packs) =>
			Base with { Id = id, PrefabName = $"Entry{id}", AssetPackIndices = packs };

		private static BuildingCatalogFacetGroup? PackGroup(params BuildingCatalogEntry[] entries) =>
			BuildingCatalogAdapter
				.BuildFacetState(entries, new BuildingCatalogQuery())
				.Groups
				.FirstOrDefault(group => group.Id == "assetPack");

		[Fact]
		public void OptionsAreKeyedByEntitySoTheyCanBeWrittenBack()
		{
			AssetPackRegistry.Clear();
			AssetPackRegistry.Record(4211, 1, "Bridges And Ports Asset Pack");
			AssetPackRegistry.Record(4212, 3, "Dragon Gate Pack");
			BuildingCatalogAdapter.ToolbarSelection = VanillaToolbarSelection.None;

			var group = PackGroup(Entry(1, 4211), Entry(2, 4212));

			Assert.NotNull(group);
			// "index:version". Vanilla's setter takes entities, and an index
			// alone cannot be turned back into one.
			Assert.Equal(new[] { "4211:1", "4212:3" }, group!.Options.Select(option => option.Id).ToArray());
			Assert.Equal(
				new[] { "Bridges And Ports Asset Pack", "Dragon Gate Pack" },
				group.Options.Select(option => option.Label).ToArray());
			Assert.All(group.Options, option => Assert.False(option.Selected));
		}

		[Fact]
		public void TicksComeFromTheGamesSelectionRatherThanOurOwnField()
		{
			AssetPackRegistry.Clear();
			AssetPackRegistry.Record(4211, 1, "Bridges And Ports Asset Pack");
			AssetPackRegistry.Record(4212, 3, "Dragon Gate Pack");

			BuildingCatalogAdapter.ToolbarSelection = new VanillaToolbarSelection(
				selectedThemes: null,
				selectedPacks: new[] { 4212 },
				vanillaSelected: false,
				modsSelected: false);

			var group = PackGroup(Entry(1, 4211), Entry(2, 4212));

			Assert.NotNull(group);
			Assert.False(Assert.Single(group!.Options, option => option.Id == "4211:1").Selected);
			Assert.True(Assert.Single(group.Options, option => option.Id == "4212:3").Selected);

			BuildingCatalogAdapter.ToolbarSelection = VanillaToolbarSelection.None;
		}

		[Fact]
		public void TheGroupIsCountedBeforeThePackFilterSoAnotherPackStaysReachable()
		{
			// The pack filter runs upstream of InScope, so a group built from
			// the visible set collapses to whatever is already picked: measured
			// in game, choosing Bridges & Ports left the rail offering Bridges &
			// Ports alone, and the only move left was to clear it. The adapter
			// therefore counts this one group over a pack-unfiltered scope.
			AssetPackRegistry.Clear();
			AssetPackRegistry.Record(4211, 1, "Bridges And Ports Asset Pack");
			AssetPackRegistry.Record(4212, 3, "Dragon Gate Pack");

			BuildingCatalogAdapter.ToolbarSelection = new VanillaToolbarSelection(
				selectedThemes: null,
				selectedPacks: new[] { 4211 },
				vanillaSelected: false,
				modsSelected: false);

			// What the view holds once the pack filter has run, beside what it
			// would hold without it.
			var visible = new[] { Entry(1, 4211) };
			var everything = new[] { Entry(1, 4211), Entry(2, 4212) };

			var group = BuildingCatalogAdapter
				.BuildFacetState(visible, new BuildingCatalogQuery(), everything)
				.Groups
				.FirstOrDefault(facet => facet.Id == "assetPack");

			Assert.NotNull(group);
			Assert.Equal(new[] { "4211:1", "4212:3" }, group!.Options.Select(option => option.Id).ToArray());
			Assert.True(Assert.Single(group.Options, option => option.Id == "4211:1").Selected);
			Assert.False(Assert.Single(group.Options, option => option.Id == "4212:3").Selected);

			BuildingCatalogAdapter.ToolbarSelection = VanillaToolbarSelection.None;
		}

		[Fact]
		public void APackTheIndexerNeverRecordedIsNotOffered()
		{
			// It could not be written back to the game, so the tick would do
			// nothing — worse than the pack simply not being there.
			AssetPackRegistry.Clear();
			AssetPackRegistry.Record(4211, 1, "Bridges And Ports Asset Pack");
			BuildingCatalogAdapter.ToolbarSelection = VanillaToolbarSelection.None;

			var group = PackGroup(Entry(1, 4211), Entry(2, 9999));

			// One known pack left, and one value cannot split anything.
			Assert.Null(group);
		}
	}
}
