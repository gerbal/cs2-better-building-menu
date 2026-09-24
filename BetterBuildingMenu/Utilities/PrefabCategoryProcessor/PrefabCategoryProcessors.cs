using BetterBuildingMenu.Domain.Interfaces;

using Game.Prefabs;
using Game.UI;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
	/// <summary>Every category processor, in the order an index pass runs them.</summary>
	/// <remarks>
	/// Written out rather than found by reflection, so every build runs them in
	/// this order. Two processors can claim the same prefab, and the later one's
	/// entry then replaces the earlier one's; a full pass logs each such pair as
	/// [PROCESSOR-OVERLAP]. MenuPlaced goes last: it claims only what nothing
	/// above it did. A test fails if a processor is missing from this list.
	/// </remarks>
	public static class PrefabCategoryProcessors
	{
		/// <summary>What a processor may be built with.</summary>
		/// <param name="IsIndexed">Whether the index a pass is filling already holds a prefab
		/// entity's index, for the processor that claims only what the others left.</param>
		public sealed record Dependencies(EntityManager EntityManager, ImageSystem ImageSystem, PrefabSystem PrefabSystem, Func<int, bool> IsIndexed);

		/// <summary>Each processor's type, and how to build it, in run order.</summary>
		/// <remarks>The type is read without building anything, so a test can check the list
		/// against the assembly without the game's systems.</remarks>
		public static readonly IReadOnlyList<(Type Type, Func<Dependencies, IPrefabCategoryProcessor> Build)> InRunOrder = new[]
		{
			Of(_ => new BridgesPrefabCategoryProcessor()),
			Of(dependencies => new DecalsPrefabCategoryProcessor(dependencies.EntityManager)),
			Of(_ => new FencePrefabCategoryProcessor()),
			Of(_ => new IntersectionsPrefabCategoryProcessor()),
			Of(dependencies => new LanesPrefabCategoryProcessor(dependencies.EntityManager)),
			Of(dependencies => new MiscBuildingPrefabCategoryProcessor(dependencies.EntityManager)),
			Of(_ => new PathsPrefabCategoryProcessor()),
			Of(dependencies => new PillarPrefabCategoryProcessor(dependencies.EntityManager)),
			Of(dependencies => new PropPrefabCategoryProcessor(dependencies.EntityManager)),
			Of(_ => new RoadsPrefabCategoryProcessor()),
			Of(dependencies => new RoundaboutPrefabCategoryProcessor(dependencies.EntityManager)),
			Of(dependencies => new ServiceBuildingPrefabCategoryProcessor(dependencies.EntityManager)),
			Of(dependencies => new ShrubPrefabCategoryProcessor(dependencies.EntityManager)),
			Of(dependencies => new SportPropPrefabCategoryProcessor(dependencies.EntityManager)),
			Of(_ => new SurfacePrefabCategoryProcessor()),
			Of(dependencies => new TerraformingPrefabCategoryProcessor(dependencies.EntityManager)),
			Of(_ => new TracksPrefabCategoryProcessor()),
			Of(_ => new TransportLinePrefabCategoryProcessor()),
			Of(dependencies => new TreePrefabCategoryProcessor(dependencies.EntityManager)),
			Of(_ => new UtilityNetworksPrefabCategoryProcessor()),
			Of(_ => new WaterwaysPrefabCategoryProcessor()),
			Of(dependencies => new ZonePrefabCategoryProcessor(dependencies.EntityManager)),
			Of(dependencies => new ZonedBuildingPrefabCategoryProcessor(dependencies.EntityManager, dependencies.ImageSystem, dependencies.PrefabSystem)),
			Of(dependencies => new MenuPlacedPrefabCategoryProcessor(dependencies.EntityManager, dependencies.IsIndexed)),
		};

		public static IPrefabCategoryProcessor[] Create(Dependencies dependencies) =>
			InRunOrder.Select(entry => entry.Build(dependencies)).ToArray();

		private static (Type, Func<Dependencies, IPrefabCategoryProcessor>) Of<T>(Func<Dependencies, T> build)
			where T : IPrefabCategoryProcessor => (typeof(T), dependencies => build(dependencies));
	}
}
