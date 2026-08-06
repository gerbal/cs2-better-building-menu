using System.Collections.Generic;
using FindItBuildingMenu.Domain;
using Game.Prefabs;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The dimensions Building Lens could filter on but the root FindIt asset
	/// grid could not: placement flags, extensions and role.
	/// </summary>
	/// <remarks>
	/// The predicates are pure functions over the indexed values rather than
	/// methods on <see cref="Filters"/>, because <c>PrefabIndex</c> requires a
	/// live <c>PrefabBase</c> and cannot be constructed in a test.
	/// </remarks>
	public sealed class FindItFilterLensTests
	{
		[Fact]
		public void PlacementFlagsDoNotFilterUntilOneIsChosen()
		{
			Assert.True(FindItFilterPredicates.MatchesAnyPlacementFlag(BuildingFlags.RequireRoad, null));
			Assert.True(FindItFilterPredicates.MatchesAnyPlacementFlag(null, null));
		}

		[Fact]
		public void NarrowsToPrefabsCarryingTheChosenFlag()
		{
			Assert.True(FindItFilterPredicates.MatchesAnyPlacementFlag(
				BuildingFlags.RequireRoad | BuildingFlags.CanBeRoadSide,
				BuildingFlags.RequireRoad));
			Assert.False(FindItFilterPredicates.MatchesAnyPlacementFlag(
				BuildingFlags.NoRoadConnection,
				BuildingFlags.RequireRoad));
		}

		[Fact]
		public void AcceptsAnyChosenFlagRatherThanRequiringAllOfThem()
		{
			// Widening two flags must widen the result set, the way it does for
			// role and theme. This asserted the opposite until the rail made the
			// inconsistency visible: identical controls, opposite meaning.
			var selected = BuildingFlags.RequireRoad | BuildingFlags.HasWaterNode;

			Assert.True(FindItFilterPredicates.MatchesAnyPlacementFlag(
				BuildingFlags.RequireRoad | BuildingFlags.HasWaterNode,
				selected));
			Assert.True(FindItFilterPredicates.MatchesAnyPlacementFlag(
				BuildingFlags.RequireRoad | BuildingFlags.CanBeRoadSide,
				selected));
			Assert.False(FindItFilterPredicates.MatchesAnyPlacementFlag(
				BuildingFlags.CanBeRoadSide,
				selected));
		}

		[Fact]
		public void ExcludesPrefabsWithNoFlagsAtAllWhenAFlagIsChosen()
		{
			// BuildingFlagsValue is nullable, and a null must not be read as
			// "satisfies everything".
			Assert.False(FindItFilterPredicates.MatchesAnyPlacementFlag(null, BuildingFlags.RequireRoad));
		}

		[Fact]
		public void MatchesAnyOfTheChosenExtensions()
		{
			var extensions = new[] { "Hospital01Wing", "Hospital01Helipad" };

			Assert.True(FindItFilterPredicates.MatchesAnyExtension(
				extensions,
				new List<string> { "Hospital01Helipad" }));
			Assert.False(FindItFilterPredicates.MatchesAnyExtension(
				extensions,
				new List<string> { "School01Gym" }));
		}

		[Fact]
		public void PrefabsWithNoExtensionsDropOutWhenExtensionsAreChosen()
		{
			Assert.False(FindItFilterPredicates.MatchesAnyExtension(null, new List<string> { "School01Gym" }));
			Assert.False(FindItFilterPredicates.MatchesAnyExtension(
				new string[0],
				new List<string> { "School01Gym" }));
		}

		[Fact]
		public void MatchesTheChosenRolesCaseInsensitively()
		{
			Assert.True(FindItFilterPredicates.MatchesAnyRole("Hospital", new List<string> { "hospital" }));
			Assert.False(FindItFilterPredicates.MatchesAnyRole("School", new List<string> { "hospital" }));
		}

		[Fact]
		public void TreatsSeveralRolesAsAUnion()
		{
			var selected = new List<string> { "Hospital", "School" };

			Assert.True(FindItFilterPredicates.MatchesAnyRole("Hospital", selected));
			Assert.True(FindItFilterPredicates.MatchesAnyRole("School", selected));
			Assert.False(FindItFilterPredicates.MatchesAnyRole("Prison", selected));
		}

		[Fact]
		public void DropsPrefabsWithNoRoleWhenRolesAreChosen()
		{
			Assert.False(FindItFilterPredicates.MatchesAnyRole(null, new List<string> { "Hospital" }));
			Assert.False(FindItFilterPredicates.MatchesAnyRole("", new List<string> { "Hospital" }));
		}

		[Fact]
		public void EmptySelectionsAreTreatedAsNoFilterRatherThanMatchNothing()
		{
			// An empty list arriving from the UI must not blank the grid.
			Assert.True(FindItFilterPredicates.MatchesAnyRole(null, new List<string>()));
			Assert.True(FindItFilterPredicates.MatchesAnyExtension(null, new List<string>()));
			Assert.True(FindItFilterPredicates.MatchesAnyRole(null, null));
			Assert.True(FindItFilterPredicates.MatchesAnyExtension(null, null));
		}
	}
}
