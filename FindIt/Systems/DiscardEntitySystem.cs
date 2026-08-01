using FindItBuildingMenu.Utilities;
using Game;
using Game.Common;
using Game.Prefabs;

using System.Reflection;

using Unity.Collections;
using Unity.Entities;

namespace FindItBuildingMenu.Systems
{
    public partial class DiscardEntitySystem : GameSystemBase
	{
		private EntityQuery query;
		private ComponentType? roadBuilderDiscarded;

		protected override void OnCreate()
		{
			base.OnCreate();

			query = GetEntityQuery(new EntityQueryDesc
			{
				All = new[] { ComponentType.ReadOnly<PrefabData>() },
				Any = new[] { ComponentType.ReadOnly<Deleted>(), ComponentType.ReadOnly<Updated>() }
			});

			RequireForUpdate(query);
		}

		protected override void OnUpdate()
		{
			var entities = query.ToEntityArray(Allocator.Temp);

			for (var i = 0; i < entities.Length; i++)
			{
				var entity = entities[i];

				if (Mod.IsRoadBuilderEnabled)
				{
					roadBuilderDiscarded ??= new ComponentType(Assembly.Load("RoadBuilder").GetType("RoadBuilder.Domain.Components.DiscardedRoadBuilderPrefab"), ComponentType.AccessMode.ReadOnly);

					if (EntityManager.HasComponent(entity, roadBuilderDiscarded.Value))
					{
						FindItUtil.RemoveItem(entity);
					}
				}

				if (EntityManager.HasComponent<Deleted>(entity))
				{
					FindItUtil.RemoveItem(entity);
				}
			}
		}
	}
}
