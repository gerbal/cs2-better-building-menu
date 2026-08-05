using Game;
using Game.Objects;
using Game.Prefabs;
using Game.Rendering;
using Game.Tools;

using Unity.Collections;
using Unity.Entities;
using Unity.Mathematics;

using Color = UnityEngine.Color;
using Transform = Game.Objects.Transform;

namespace FindItBuildingMenu.Systems
{
	/// <summary>
	/// Draws the service radius of the building on the tool, on the terrain.
	/// </summary>
	/// <remarks>
	/// "Will it reach the neighbourhood that needs it" is a spatial question,
	/// and the panel could only ever answer it with a number. A ring under the
	/// ghost answers it in the coordinate system the player is already looking
	/// at, at the only moment it can still change the decision — while they are
	/// choosing where, before they commit.
	///
	/// The radius comes from the prefab's own <see cref="CoverageData"/>, and the
	/// position from the temp preview entity the object tool creates, so nothing
	/// here raycasts or duplicates the tool's placement logic.
	/// </remarks>
	public partial class ServiceCoverageOverlaySystem : GameSystemBase
	{
		private OverlayRenderSystem _overlayRenderSystem = null!;
		private ToolSystem _toolSystem = null!;
		private PrefabSystem _prefabSystem = null!;
		private EntityQuery _ghostQuery;

		protected override void OnCreate()
		{
			base.OnCreate();

			_overlayRenderSystem = World.GetOrCreateSystemManaged<OverlayRenderSystem>();
			_toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();

			// The object tool's preview object: a Temp entity with a Transform.
			// Reading it avoids re-implementing the raycast and snapping the
			// tool has already done.
			_ghostQuery = GetEntityQuery(
				ComponentType.ReadOnly<Temp>(),
				ComponentType.ReadOnly<Transform>(),
				ComponentType.ReadOnly<PrefabRef>());

			RequireForUpdate(_ghostQuery);
		}

		protected override void OnUpdate()
		{
			if (!Mod.Settings.ShowCoverageOverlay)
			{
				return;
			}

			var prefab = _toolSystem.activePrefab;
			if (prefab is null)
			{
				return;
			}

			var prefabEntity = _prefabSystem.GetEntity(prefab);
			if (!EntityManager.HasComponent<CoverageData>(prefabEntity))
			{
				return;
			}

			var coverage = EntityManager.GetComponentData<CoverageData>(prefabEntity);
			if (coverage.m_Range <= 0f)
			{
				// Most buildings have no coverage at all; drawing a zero-radius
				// ring would be noise on every placement.
				return;
			}

			if (!TryGetGhostPosition(prefabEntity, out var position))
			{
				return;
			}

			var buffer = _overlayRenderSystem.GetBuffer(out var dependencies);
			// One circle per frame is not worth a job; completing here keeps the
			// draw on the main thread and the system readable.
			dependencies.Complete();

			var fill = new Color(0.35f, 0.75f, 1f, 0.10f);
			var outline = new Color(0.45f, 0.85f, 1f, 0.75f);

			buffer.DrawCircle(
				outline,
				fill,
				OutlineWidth,
				OverlayRenderSystem.StyleFlags.Projected,
				new float2(0f, 1f),
				position,
				coverage.m_Range * 2f);

			_overlayRenderSystem.AddBufferWriter(Dependency);
		}

		private const float OutlineWidth = 6f;

		/// <summary>
		/// Where the tool's preview object currently sits.
		/// </summary>
		/// <remarks>
		/// Matched by prefab so a stale temp entity from another tool cannot
		/// drag the ring somewhere the player is not looking.
		/// </remarks>
		private bool TryGetGhostPosition(Entity prefabEntity, out float3 position)
		{
			position = default;

			var entities = _ghostQuery.ToEntityArray(Allocator.Temp);

			try
			{
				foreach (var entity in entities)
				{
					if (!EntityManager.HasComponent<PrefabRef>(entity)
						|| EntityManager.GetComponentData<PrefabRef>(entity).m_Prefab != prefabEntity)
					{
						continue;
					}

					if (EntityManager.HasComponent<Transform>(entity))
					{
						position = EntityManager.GetComponentData<Transform>(entity).m_Position;

						return true;
					}
				}
			}
			finally
			{
				entities.Dispose();
			}

			return false;
		}
	}
}
