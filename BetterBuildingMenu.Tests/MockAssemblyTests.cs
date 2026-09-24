using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The mock game assemblies CI builds against load the game's Unity-derived types.
	/// </summary>
	/// <remarks>
	/// Refasmer leaves Unity's internal calls with a body unless FixNativeMethods.cs clears it,
	/// and the runtime refuses to load such a type, so no prefab type would load and no test
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
