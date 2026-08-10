using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Services;

using System.Linq;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// Which filter dimensions the current view is worth offering.
	/// </summary>
	public class BuildingLensFacetRelevanceTests
	{
		// The record is positional with fifty parameters, so the fixture is built
		// by `with` off one minimal instance rather than by another constructor
		// call per case.
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

		private static BuildingCatalogEntry Entry(int id, string role, string provenance, bool locked = false) =>
			Base with
			{
				Id = id,
				PrefabName = $"Entry{id}",
				Name = $"Entry {id}",
				BuildingType = role,
				Provenance = provenance,
				IsLocked = locked,
			};

		[Fact]
		public void ADimensionWithOneValueIsNotOffered()
		{
			// Every entry already has it, so selecting it changes nothing. It
			// still costs a slot in the rail and a decision from the reader.
			// Measured inside Roads and Networks before this rule: Source
			// offered only "Base game", DLC only "No DLC required".
			var state = BuildingCatalogAdapter.BuildFacetState(
				new[] { Entry(1, "School", "BaseGame"), Entry(2, "Hospital", "BaseGame") },
				new BuildingCatalogQuery());

			Assert.Contains("buildingType", state.Groups.Select(group => group.Id));
			Assert.DoesNotContain("provenance", state.Groups.Select(group => group.Id));
		}

		[Fact]
		public void ADimensionAlreadyFilteredOnStaysEvenAtOneValue()
		{
			// Dropping it would strand the filter: applied, shrinking the
			// results, with nothing on screen saying so or able to undo it.
			var state = BuildingCatalogAdapter.BuildFacetState(
				new[] { Entry(1, "School", "BaseGame"), Entry(2, "Hospital", "BaseGame") },
				new BuildingCatalogQuery(Provenance: new[] { "BaseGame" }));

			Assert.Contains("provenance", state.Groups.Select(group => group.Id));
		}

		[Fact]
		public void FacetsIgnoreTheFacetSelectionsThemselves()
		{
			// Counting them in would let the first pick empty every other
			// dimension — choose one Role and the rest of the Roles vanish,
			// including the one that would widen the result again.
			var entries = new[]
			{
				Entry(1, "School", "BaseGame"),
				Entry(2, "Hospital", "Mod"),
			};

			var scoped = BuildingCatalogQueryEngine
				.InScope(entries, new BuildingCatalogQuery(BuildingTypes: new[] { "School" }))
				.ToArray();

			Assert.Equal(2, scoped.Length);
		}

		[Fact]
		public void ScopeStillApplies()
		{
			// InScope drops the facet selections, not the scope. A search is
			// part of what the view IS, so the facets follow it.
			var entries = new[]
			{
				Entry(1, "School", "BaseGame"),
				Entry(2, "Hospital", "Mod"),
			};

			var scoped = BuildingCatalogQueryEngine
				.InScope(entries, new BuildingCatalogQuery(SearchText: "Entry 1"))
				.ToArray();

			Assert.Single(scoped);
			Assert.Equal(1, scoped[0].Id);
		}
	}
}
