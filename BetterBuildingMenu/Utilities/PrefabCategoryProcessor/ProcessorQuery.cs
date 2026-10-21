using System;
using System.Collections.Generic;
using System.Linq;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities.PrefabCategoryProcessor
{
	/// <summary>The prefabs a processor reads: one or more descriptions, any of which a prefab may match.</summary>
	/// <remarks>Immutable and made of component types, so each entity query gets descriptions of its
	/// own, and a test can read the spec without the game's type registry.</remarks>
	public sealed class ProcessorQuery
	{
		private ProcessorQuery(IReadOnlyList<Description> descriptions)
		{
			Descriptions = descriptions;
		}

		public IReadOnlyList<Description> Descriptions { get; }

		/// <summary>Prefabs carrying every one of these components.</summary>
		public static ProcessorQuery All(params Type[] components) =>
			new(Array.AsReadOnly(new[] { new Description(components, Array.Empty<Type>()) }));

		/// <summary>The prefabs this query matches that carry none of these components.</summary>
		public ProcessorQuery None(params Type[] components) =>
			new(Array.AsReadOnly(Descriptions.Select(description => new Description(description.All, description.None.Concat(components))).ToArray()));

		/// <summary>The prefabs this query matches, and those the other one does.</summary>
		public ProcessorQuery Or(ProcessorQuery other) =>
			new(Array.AsReadOnly(Descriptions.Concat(other.Descriptions).ToArray()));

		/// <summary>New entity query descriptions, every component read-only.</summary>
		public EntityQueryDesc[] ToDescs() =>
			Descriptions
				.Select(description => new EntityQueryDesc
				{
					All = description.All.Select(ComponentType.ReadOnly).ToArray(),
					None = description.None.Select(ComponentType.ReadOnly).ToArray(),
				})
				.ToArray();

		/// <summary>Prefabs carrying all of one set of components and none of another.</summary>
		public sealed class Description
		{
			internal Description(IEnumerable<Type> all, IEnumerable<Type> none)
			{
				All = Array.AsReadOnly(all.ToArray());
				None = Array.AsReadOnly(none.ToArray());
			}

			public IReadOnlyList<Type> All { get; }

			public IReadOnlyList<Type> None { get; }
		}
	}
}
