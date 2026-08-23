using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Services;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The upgrades a building SUPPORTS, which is not the same question as
	/// whether the building IS one.
	/// </summary>
	/// <remarks>
	/// cm-2xvs.19. Both questions were being asked of ExtensionIds, which only
	/// ever answers the second: PrefabIndexingSystem tags a prefab with its own
	/// name when the prefab is itself an upgrade, so a signature building — not
	/// an upgrade — reads empty, and the hover card's "upgrades that can be
	/// attached later" row had nothing to draw for any of the 100 signatures.
	///
	/// The reason it needs a SECOND field rather than a wider reading of the
	/// first is the exclusion pinned below: a non-empty Extensions means "drop
	/// this from every menu", so filling it with supported upgrades would have
	/// deleted every upgradeable building from the build menus.
	/// </remarks>
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
			IsUniqueMesh: false,
			IsVanilla: true,
			IsFavorited: false,
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
			// The trap. MatchesVanillaMenuTree drops any entry whose Extensions
			// is non-empty, because vanilla's FilterOutUpgrades hides upgrades
			// from every menu — so reusing that field for "what can attach to
			// me" would have removed the tower from the menu that shows towers.
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
			// The other half of the same rule, so a later reading of one field
			// cannot quietly swallow the other. This is vanilla's behaviour and
			// the reason the exclusion exists.
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
