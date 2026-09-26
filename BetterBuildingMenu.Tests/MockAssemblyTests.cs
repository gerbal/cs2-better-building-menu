using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The mock game assemblies load the game's Unity-derived types.
	/// </summary>
	/// <remarks>
	/// Refasmer gives Unity's internal calls a body, which the mocks must have cleared: the
	/// runtime refuses to load a type holding one, so no prefab type would load and no test
	/// could build an index entry. See docs/ci.md, "The mock assemblies".
	/// </remarks>
	public sealed class MockAssemblyTests
	{
		[Fact]
		public void AnIndexEntryBuildsAroundAPrefab()
		{
			var prefab = TestPrefabs.Prefab();

			var entry = new PrefabIndex(prefab);

			Assert.Same(prefab, entry.Prefab);
			// Initializers ran, unlike an entry made without its constructor.
			Assert.Empty(entry.ServiceFacts);
			Assert.Empty(entry.ServiceTextFacts);
		}
	}
}
