using System;
using System.Collections.Generic;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The payload behind the replaced extension picker: the catalog entries for
	/// the upgrades a selected building supports, in the order vanilla lists them.
	/// </summary>
	/// <remarks>
	/// Vanilla's own binding decides WHAT is listed and whether each row is
	/// locked or built. This only supplies presentation — the entry behind each
	/// name — so it must never invent a row, and a name it cannot resolve is
	/// simply absent. The UI notices the gap and leaves the panel to vanilla.
	/// </remarks>
	public sealed class BuildingExtensionMenuTests
	{
		private static BuildingCatalogEntry Entry(string prefabName) => new(
			Id: prefabName.Length,
			PrefabName: prefabName,
			Name: $"The {prefabName}",
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
			PdxModsId: "");

		private static Func<string, BuildingCatalogEntry?> Catalog(params string[] known)
		{
			var set = new HashSet<string>(known, StringComparer.Ordinal);
			return name => set.Contains(name) ? Entry(name) : null;
		}

		[Fact]
		public void KeepsVanillasOrder()
		{
			var menu = BuildingExtensionMenu.Build(
				"Crematorium",
				new[] { "Columbarium", "HearseGarage", "Chapel" },
				Catalog("HearseGarage", "Chapel", "Columbarium"));

			Assert.Equal("Crematorium", menu.BuildingName);
			Assert.Equal(new[] { "Columbarium", "HearseGarage", "Chapel" }, Array.ConvertAll(menu.Entries, e => e.PrefabName));
		}

		[Fact]
		public void ANameTheCatalogCannotResolveIsAbsentNotInvented()
		{
			var menu = BuildingExtensionMenu.Build(
				"Crematorium",
				new[] { "HearseGarage", "Columbarium" },
				Catalog("HearseGarage"));

			Assert.Equal(new[] { "HearseGarage" }, Array.ConvertAll(menu.Entries, e => e.PrefabName));
		}

		[Fact]
		public void ABuildingWithNoUpgradesIsEmpty()
		{
			var menu = BuildingExtensionMenu.Build("Shed", Array.Empty<string>(), Catalog("HearseGarage"));

			Assert.Equal("Shed", menu.BuildingName);
			Assert.Empty(menu.Entries);
		}

		[Fact]
		public void NoSelectionIsTheEmptyMenu()
		{
			Assert.Equal(string.Empty, BuildingExtensionMenu.Empty.BuildingName);
			Assert.Empty(BuildingExtensionMenu.Empty.Entries);
		}
	}
}
