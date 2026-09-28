using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Services;

using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// Which filter dimensions the current view is worth offering.
	/// </summary>
	public class AssetMenuFacetRelevanceTests
	{
		// The record is positional and wide, so the fixture is built by `with` off
		// one minimal instance rather than a constructor call per case.
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
		public void NeitherUnlockModalityIsOfferedAsAFilter()
		{
			// Development restates the strip's own tab row and collides with Role in
			// the same words; progression asks a question nobody asks of a build menu.
			// Both stay GROUP BY dimensions, which arrange the set instead of hiding it.
			var entries = new[]
			{
				Entry(1, "Hospital", "BaseGame") with
				{
					UnlockMilestone = 0,
					DevTreeBranch = "Healthcare",
				},
				Entry(2, "Deathcare Facility", "BaseGame") with
				{
					UnlockMilestone = 4,
					DevTreeBranch = "Crematorium",
				},
			};

			var ids = BuildingCatalogAdapter
				.BuildFacetState(entries, new BuildingCatalogQuery())
				.Groups
				.Select(group => group.Id)
				.ToArray();

			// stripTab genuinely splits this fixture, so that assertion bites.
			// milestone cannot be produced at all, so its assertion guards the id
			// rather than the split.
			Assert.DoesNotContain("milestone", ids);
			Assert.DoesNotContain("stripTab", ids);
			Assert.Contains("buildingType", ids);
		}

		[Fact]
		public void DensityIsNotOfferedAsAFilterEither()
		{
			// Every type+density tier is a category with its own tab in the top bar,
			// so a Density dropdown in the rail restates the tabs above it. Density
			// stays a group dimension and a sort column.
			var entries = new[]
			{
				Entry(1, "Low Residential", "BaseGame") with
				{
					ZoneType = Domain.Enums.ZoneTypeFilter.Low,
				},
				Entry(2, "High Residential", "BaseGame") with
				{
					ZoneType = Domain.Enums.ZoneTypeFilter.High,
				},
			};

			var ids = BuildingCatalogAdapter
				.BuildFacetState(entries, new BuildingCatalogQuery())
				.Groups
				.Select(group => group.Id)
				.ToArray();

			Assert.DoesNotContain("zone", ids);
		}

		[Fact]
		public void ADimensionWithOneValueIsNotOffered()
		{
			// Every entry already has it, so selecting it changes nothing. It
			// still costs a slot in the rail and a decision from the reader.
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
