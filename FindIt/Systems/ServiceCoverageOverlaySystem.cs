using Game;
using Game.Net;
using Game.Prefabs;
using Game.Tools;

using System;
using System.Collections.Generic;

using Unity.Collections;
using Unity.Entities;
using Unity.Mathematics;


namespace FindItBuildingMenu.Systems
{
	/// <summary>
	/// Shows the city's own coverage map while a service building is on the tool.
	/// </summary>
	/// <remarks>
	/// "Will it reach the neighbourhood that needs it" is a spatial question the
	/// panel could only ever answer with a number, so the answer belongs on the
	/// terrain, at the moment it can still change the decision.
	///
	/// This drew a radius ring first. It worked, and was the wrong design: an
	/// elementary school's range is 2000, so the ring spanned 4000 units — wider
	/// than the viewport at play zoom, and a ring whose edges you cannot see
	/// answers nothing. Coverage in this game is also a falloff rather than a
	/// boundary, so a crisp circle misrepresents it.
	///
	/// The game already draws coverage properly, as terrain colouring in its own
	/// infoview. So this activates that instead of competing with it, and puts
	/// the player's previous infoview back when they put the tool down — leaving
	/// someone stuck in a view they never chose would be worse than showing them
	/// nothing.
	/// </remarks>
	public partial class ServiceCoverageOverlaySystem : GameSystemBase
	{
		private ToolSystem _toolSystem = null!;
		private PrefabSystem _prefabSystem = null!;
		private EntityQuery _infoviewQuery;

		// What the player was looking at before we changed it, so it can be put
		// back. Only set when we are the ones who changed it.
		private InfoviewPrefab? _restoreInfoview;
		private bool _weChangedInfoview;

		protected override void OnCreate()
		{
			base.OnCreate();

			_toolSystem = World.GetOrCreateSystemManaged<ToolSystem>();
			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();

			_infoviewQuery = GetEntityQuery(ComponentType.ReadOnly<InfoviewData>());
		}

		protected override void OnUpdate()
		{
			if (!Mod.Settings.ShowCoverageOverlay)
			{
				Restore();

				return;
			}

			var prefab = _toolSystem.activePrefab;
			if (prefab is null)
			{
				Restore();

				return;
			}

			var prefabEntity = _prefabSystem.GetEntity(prefab);

			if (!EntityManager.HasComponent<CoverageData>(prefabEntity))
			{
				// No coverage, but a heavy polluter is still a placement whose
				// consequence is spatial — a coal plant or landfill has no
				// service radius and every reason to be sited carefully. Falls
				// through to nothing for a park bench.
				ShowPollutionOrRestore(prefabEntity);

				return;
			}

			var coverage = EntityManager.GetComponentData<CoverageData>(prefabEntity);
			var infoview = ResolveByName(InfoviewAliases[coverage.m_Service]);
			if (infoview is null || ReferenceEquals(_toolSystem.infoview, infoview))
			{
				return;
			}

			if (!_weChangedInfoview)
			{
				_restoreInfoview = _toolSystem.infoview;
				_weChangedInfoview = true;
			}

			_toolSystem.infoview = infoview;
		}

		protected override void OnDestroy()
		{
			Restore();

			base.OnDestroy();
		}

		private void Restore()
		{
			if (!_weChangedInfoview)
			{
				return;
			}

			_toolSystem.infoview = _restoreInfoview;
			_restoreInfoview = null;
			_weChangedInfoview = false;
		}

		/// <summary>
		/// Switches to the pollution view for a building that fouls its
		/// surroundings, or restores if it does not.
		/// </summary>
		/// <remarks>
		/// Coverage wins when a building has both: the service is why you are
		/// placing it, and the pollution is a side effect. Only meaningful
		/// pollution counts — nearly every building emits a little noise, and
		/// switching the map for a bus shelter would be noise of another kind.
		/// </remarks>
		private void ShowPollutionOrRestore(Entity prefabEntity)
		{
			if (!EntityManager.HasComponent<PollutionData>(prefabEntity))
			{
				Restore();

				return;
			}

			var pollution = EntityManager.GetComponentData<PollutionData>(prefabEntity);
			var worst = math.max(
				math.max(pollution.m_GroundPollution, pollution.m_AirPollution),
				pollution.m_NoisePollution);

			if (worst < PollutionThreshold)
			{
				Restore();

				return;
			}

			var infoview = ResolveByName(PollutionAliases);
			if (infoview is null || ReferenceEquals(_toolSystem.infoview, infoview))
			{
				return;
			}

			if (!_weChangedInfoview)
			{
				_restoreInfoview = _toolSystem.infoview;
				_weChangedInfoview = true;
			}

			_toolSystem.infoview = infoview;
		}

		/// <summary>
		/// Below this, the emission is incidental rather than a siting concern.
		/// </summary>
		private const float PollutionThreshold = 20f;

		private static readonly string[] PollutionAliases = { "Pollution" };

		/// <summary>
		/// Aliases per coverage service, matched against the real infoview prefab
		/// names at runtime rather than assumed, because the two vocabularies do
		/// not line up: the service is "Park", the infoview "ParksAndRecreation".
		/// </summary>
		private static readonly Dictionary<CoverageService, string[]> InfoviewAliases = new()
		{
			[CoverageService.Healthcare] = new[] { "Healthcare", "Health" },
			[CoverageService.FireRescue] = new[] { "FireRescue", "Fire" },
			[CoverageService.Police] = new[] { "Police" },
			[CoverageService.Park] = new[] { "ParksAndRecreation", "Parks", "Park" },
			[CoverageService.PostService] = new[] { "PostService", "Post", "Mail" },
			[CoverageService.Education] = new[] { "Education" },
			[CoverageService.EmergencyShelter] = new[] { "Disaster", "EmergencyShelter", "Hazard" },
			[CoverageService.Welfare] = new[] { "Welfare", "Health" },
		};

		private InfoviewPrefab? ResolveByName(string[] aliases)
		{
			var entities = _infoviewQuery.ToEntityArray(Allocator.Temp);

			try
			{
				// Exact match first, so "Health" cannot claim "Healthcare" out
				// from under a later alias.
				foreach (var alias in aliases)
				{
					foreach (var entity in entities)
					{
						if (_prefabSystem.TryGetPrefab<InfoviewPrefab>(entity, out var candidate)
							&& string.Equals(candidate?.name, alias, StringComparison.OrdinalIgnoreCase))
						{
							return candidate;
						}
					}
				}
			}
			finally
			{
				entities.Dispose();
			}

			return null;
		}
	}
}
