using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The upgrades a building SUPPORTS, which is not whether the building IS one:
	/// ExtensionIds answers only the second, and a non-empty Extensions means "drop
	/// this from every menu", so supported upgrades need a field of their own.
	/// </summary>
	public sealed class SupportedUpgradesTests
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
			ZoneType: ZoneTypeFilter.Any,
			HasParking: false,
			IsVanilla: true,
			PdxModsId: "");

		private static BuildingCatalogEntry InMenu(int id, string name) =>
			Base with
			{
				Id = id,
				PrefabName = $"P{id}",
				Name = name,
				UiMenu = "Signatures",
				UiCategory = "SignaturesResidential",
			};

		[Fact]
		public void ASupportedUpgradeDoesNotMakeTheBuildingItselfAnUpgrade()
		{
			// MatchesVanillaMenuTree drops any entry whose Extensions is non-empty,
			// since vanilla's FilterOutUpgrades hides upgrades from every menu;
			// reusing that field would remove the tower from the menu showing towers.
			var tower = InMenu(1, "Waveform Tower") with
			{
				SupportedUpgrades = new[] { "SignatureTowerParking01" },
			};

			var page = BuildingCatalogQueryEngine.Query(
				new[] { tower },
				new BuildingCatalogQuery(UiMenu: "Signatures"));

			var entry = Assert.Single(page.Items);
			Assert.Equal(1, entry.Id);
			Assert.Equal(new[] { "SignatureTowerParking01" }, entry.SupportedUpgrades);
		}

		[Fact]
		public void AnAssetThatIsItselfAnUpgradeIsStillHiddenFromTheMenu()
		{
			// The other half of the same rule: this is vanilla's behaviour, and the
			// reason the exclusion exists.
			var wing = InMenu(2, "Hospital Wing") with
			{
				Extensions = new[] { "HospitalWing01" },
			};

			var page = BuildingCatalogQueryEngine.Query(
				new[] { wing },
				new BuildingCatalogQuery(UiMenu: "Signatures"));

			Assert.Empty(page.Items);
		}

	}
}
