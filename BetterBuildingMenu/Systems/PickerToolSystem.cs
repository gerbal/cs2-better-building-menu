using Colossal.Entities;

using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Utilities;
using Game.Areas;
using Game.Buildings;
using Game.Common;
using Game.Input;
using Game.Net;
using Game.Prefabs;
using Game.SceneFlow;
using Game.Tools;

using System.Linq;

using Unity.Collections;
using Unity.Entities;
using Unity.Jobs;

namespace BetterBuildingMenu.Systems
{
    public partial class PickerToolSystem : ToolBaseSystem
	{
		private PrefabSystem _prefabSystem;
		private BuildingMenuUISystem _menuUISystem;
		private EntityQuery _highlightedQuery;
		private ProxyAction _applyAction;
		private ToolOutputBarrier _toolOutputBarrier;

		public override string toolID => "BetterBuildingMenu.Picker";

		public PickerFlags Flags { get; set; } = PickerFlags.Default;
		public PrefabBase HoveredPrefab { get; private set; }

		protected override void OnCreate()
		{
			base.OnCreate();

			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_menuUISystem = World.GetOrCreateSystemManaged<BuildingMenuUISystem>();

			_highlightedQuery = GetEntityQuery(ComponentType.ReadOnly<Highlighted>());

			_applyAction = Mod.Settings.GetAction(nameof(BetterBuildingMenu) + "Apply");

			var builtInApplyAction = InputManager.instance.FindAction(InputManager.kToolMap, "Apply");
			var mimicApplyBinding = _applyAction.bindings.FirstOrDefault(b => b.device == InputManager.DeviceType.Mouse);
			var builtInApplyBinding = builtInApplyAction.bindings.FirstOrDefault(b => b.device == InputManager.DeviceType.Mouse);

			mimicApplyBinding.path = builtInApplyBinding.path;
			mimicApplyBinding.modifiers = builtInApplyBinding.modifiers;

			InputManager.instance.SetBinding(mimicApplyBinding, out _);

			_toolOutputBarrier = World.GetOrCreateSystemManaged<ToolOutputBarrier>();
		}

		public override void InitializeRaycast()
		{
			base.InitializeRaycast();

			m_ToolRaycastSystem.areaTypeMask = default;
			m_ToolRaycastSystem.typeMask = default;
			m_ToolRaycastSystem.raycastFlags = default;
			m_ToolRaycastSystem.netLayerMask = default;
			m_ToolRaycastSystem.iconLayerMask = default;
			m_ToolRaycastSystem.utilityTypeMask = default;
			m_ToolRaycastSystem.collisionMask = CollisionMask.Overground | CollisionMask.OnGround | CollisionMask.Underground;

			if (Flags.HasFlag(PickerFlags.Networks))
			{
				m_ToolRaycastSystem.netLayerMask |= Layer.All;
				m_ToolRaycastSystem.typeMask |= TypeMask.Net | TypeMask.Lanes;
				m_ToolRaycastSystem.utilityTypeMask |= UtilityTypes.Fence | UtilityTypes.HighVoltageLine | UtilityTypes.LowVoltageLine;
			}

			if (Flags.HasFlag(PickerFlags.Buildings))
			{
				m_ToolRaycastSystem.typeMask |= TypeMask.StaticObjects;
				m_ToolRaycastSystem.areaTypeMask |= AreaTypeMask.Lots;
				m_ToolRaycastSystem.raycastFlags |= RaycastFlags.BuildingLots;
			}

			if (Flags.HasFlag(PickerFlags.Props))
			{
				m_ToolRaycastSystem.typeMask |= TypeMask.StaticObjects | TypeMask.MovingObjects;
				m_ToolRaycastSystem.raycastFlags |= RaycastFlags.Decals | RaycastFlags.PartialSurface;
			}

			if (Flags.HasFlag(PickerFlags.Surfaces))
			{
				m_ToolRaycastSystem.typeMask |= TypeMask.Areas;
				m_ToolRaycastSystem.areaTypeMask |= AreaTypeMask.Spaces | AreaTypeMask.Surfaces;
				m_ToolRaycastSystem.raycastFlags |= RaycastFlags.SubElements | RaycastFlags.PartialSurface;
			}

			if (Flags.HasFlag(PickerFlags.SubObjects))
			{
				m_ToolRaycastSystem.raycastFlags |= RaycastFlags.SubElements | RaycastFlags.SubBuildings;
			}
		}

		protected override void OnStartRunning()
		{
			base.OnStartRunning();

			_applyAction.shouldBeEnabled = true;
		}

		protected override void OnStopRunning()
		{
			base.OnStopRunning();

			_applyAction.shouldBeEnabled = false;

			EntityManager.RemoveComponent<Highlighted>(_highlightedQuery);
			EntityManager.AddComponent<BatchesUpdated>(_highlightedQuery);
		}

		protected override JobHandle OnUpdate(JobHandle inputDeps)
		{
			var picked = false;
			var raycastHit = GetRaycastResult(out var entity, out RaycastHit hit);
			var entities = _highlightedQuery.ToEntityArray(Allocator.Temp);
			var barrier = _toolOutputBarrier.CreateCommandBuffer();

			if (raycastHit && IsValidPrefab(ref entity)
				&& EntityManager.TryGetComponent<PrefabRef>(entity, out var prefabRef)
				&& _prefabSystem.TryGetPrefab<PrefabBase>(prefabRef, out var prefab))
			{
				HoveredPrefab = prefab;

				if (_applyAction.WasPressedThisFrame())
				{
					if (Mod.Settings.OpenPanelOnPicker)
					{
						_menuUISystem.ClearSearch();

						if (BuildingMenuUtil.Find(prefab, out var id))
						{
							// Since phase 2 the build menu lives in the game's
							// own asset-menu slot, so it exists only while the
							// toolbar has a menu open. "Show me this building"
							// therefore means "open the menu it lives in" — and
							// the player lands in that menu rather than in an
							// unscoped grid of everything, which is the better
							// answer anyway.
							//
							// When the game places it in NO menu — props,
							// vegetation and vehicles, most of the index — there
							// is nothing to open, and that is the right answer
							// rather than a gap. This mod extends vanilla's build
							// menu; an asset vanilla never offers has no menu to
							// be revealed in, and inventing an unscoped grid of
							// everything to hold it would be adding a surface
							// vanilla does not have.
							//
							// It used to open the legacy FindIt grid here. That
							// grid stopped rendering in 365e761, and what replaced
							// it cannot hold these assets anyway: unscoped, the
							// catalog is buildings only by construction
							// (BuildingCatalogAdapter.cs:358). So the fallback had
							// been opening a panel that excluded the very thing
							// the player picked (cm-h8fe).
							//
							// The tool is still armed either way, which is what
							// vanilla's own picker does and the whole of what was
							// asked for.
							_menuUISystem.RequestVanillaMenu(id);
							_menuUISystem.TryActivatePrefabTool(id);
						}
						else
						{
							m_ToolSystem.ActivatePrefabTool(prefab);
						}
					}
					else
					{
						m_ToolSystem.ActivatePrefabTool(prefab);
					}

					picked = true;
				}
				else if (!EntityManager.HasComponent<Highlighted>(entity))
				{
					barrier.AddComponent<Highlighted>(entity);
					barrier.AddComponent<BatchesUpdated>(entity);

					if (EntityManager.HasComponent<Game.Buildings.Lot>(entity))
					{
						if (EntityManager.TryGetBuffer<Game.Objects.SubObject>(entity, true, out var subObjects))
						{
							foreach (var item in subObjects)
							{
								barrier.AddComponent<Highlighted>(item.m_SubObject);
								barrier.AddComponent<BatchesUpdated>(item.m_SubObject);
							}
						}

						if (EntityManager.TryGetBuffer<Game.Net.SubLane>(entity, true, out var subLanes))
						{
							foreach (var item in subLanes)
							{
								barrier.AddComponent<Highlighted>(item.m_SubLane);
								barrier.AddComponent<BatchesUpdated>(item.m_SubLane);
							}
						}

						if (EntityManager.TryGetBuffer<Game.Areas.SubArea>(entity, true, out var subAreas))
						{
							foreach (var item in subAreas)
							{
								if (EntityManager.HasComponent<Batch>(item.m_Area))
								{
									barrier.AddComponent<Highlighted>(item.m_Area);
									barrier.AddComponent<BatchesUpdated>(item.m_Area);
								}
							}
						}
					}
				}
			}

			for (var i = 0; i < entities.Length; i++)
			{
				if (!picked && raycastHit && (entity == entities[i] || (EntityManager.TryGetComponent<Owner>(entities[i], out var owner) && owner.m_Owner == entity)))
				{
					continue;
				}

				barrier.RemoveComponent<Highlighted>(entities[i]);
				barrier.AddComponent<BatchesUpdated>(entities[i]);
			}

			return base.OnUpdate(inputDeps);
		}

		private bool IsValidPrefab(ref Entity entity)
		{
			var isOwner = !EntityManager.TryGetComponent<Owner>(entity, out var owner);
			var isSurface = EntityManager.HasComponent<Area>(entity);

			if (Flags.HasFlag(PickerFlags.Surfaces) && isSurface)
			{
				return true;
			}

			if (!Flags.HasFlag(PickerFlags.SubObjects) && !isOwner)
			{
				entity = owner.m_Owner;
			}

			var isBuilding = EntityManager.HasComponent<Building>(entity);

			if (!Flags.HasFlag(PickerFlags.Buildings) && isBuilding)
			{
				return false;
			}

			if (!Flags.HasFlag(PickerFlags.Props) && Flags.HasFlag(PickerFlags.Buildings) && !isBuilding)
			{
				return false;
			}

			return true;
		}

		public override bool TrySetPrefab(PrefabBase prefab)
		{
			return false;
		}

		public override PrefabBase GetPrefab()
		{
			return default;
		}
	}
}
