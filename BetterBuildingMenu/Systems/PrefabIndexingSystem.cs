using Colossal.Core;
using Colossal.Entities;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.Mathematics;
using Colossal.PSI.Common;
using Colossal.Serialization.Entities;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Domain.Interfaces;
using BetterBuildingMenu.Utilities;

using Game;
using Game.City;
using Game.Common;
using Game.Companies;
using Game.Prefabs;
using Game.SceneFlow;
using Game.UI;
using Game.UI.InGame;

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;

using Unity.Collections;
using Unity.Entities;
using Unity.Mathematics;

namespace BetterBuildingMenu.Systems
{
	public partial class PrefabIndexingSystem : GameSystemBase
	{
		private PrefabSystem _prefabSystem;
		private ResourceSystem _resourceSystem;
		private ImageSystem _imageSystem;
		private PrefabUISystem _prefabUISystem;
		private BuildingMenuUISystem _menuUISystem;
		private HashSet<string> _blackList;
		private ComponentType? roadBuilderDiscarded;
		private static Dictionary<Entity, ZoneTypeFilter> _zoneTypeCache;

		/// <summary>Density per ZONE prefab: the zone's own tier, which adds Mixed and LowRent.</summary>
		/// <remarks>Kept apart from <see cref="_zoneTypeCache"/>, which classifies a zone so its
		/// buildings can be filtered; widening that one would reclassify thousands of buildings.</remarks>
		private static Dictionary<Entity, ZoneTypeFilter> _zoneDensityCache;

		/// <summary>The lot shapes each zone actually grows, by zone prefab.</summary>
		/// <remarks>Cached because IndexZones computes it before the processor loop that builds each
		/// zone's PrefabIndex, and the entry needs it there.</remarks>
		private static Dictionary<Entity, ZoneLotSizes> _zoneLotSizeCache;
		private EntityQuery _unlockEventQuery;
		// Prefabs the game created or changed this frame — the incremental
		// pass's own trigger. A field rather than a RequireForUpdate gate,
		// which would hold the system shut for unlock events too.
		private EntityQuery _changedPrefabQuery;
		// Guards against queueing a second pass while one is already pending:
		// the locale event fires more than once per change. See
		// OnActiveDictionaryChanged.
		private bool _localeChanged;
		// Set by the OnGameLoaded pass, cleared at preload, read at loading-
		// complete to decide whether a second full pass is owed. See there.
		private bool _indexedAtGameLoaded;
		/// <summary>
		/// Every assignable zone, grouped by family in the zoning hierarchy.
		/// </summary>
		private static List<ZoneCatalogEntry> _zoneCatalog = new();

		/// <summary>The vanilla toolbar's facts for each zone, keyed by entity index.</summary>
		/// <remarks>Beside the catalog rather than on <see cref="ZoneCatalogEntry"/>: that record is
		/// serialised to the UI, and this is backend-only data the UI has no use for.</remarks>
		private static Dictionary<int, VanillaAssetFacts> _zoneFacts = new();
		private static Dictionary<int, string> _assetMenuNames = new();
		// The reverse: menu prefab name -> its entity, so the picker can ask the
		// game to open the menu that holds the building it just picked.
		private static Dictionary<string, Entity> _assetMenuEntities = new();
		// Vanilla's second tier, keyed by menu name. See VanillaMenuCategory.
		private static Dictionary<string, List<VanillaMenuCategory>> _assetCategories = new();
		/// <summary>The vanilla build menus, in the game's own order.</summary>
		/// <remarks>Published so the lens can offer them as a filter: a bottom-bar icon is a shortcut
		/// to a menu, and the menu is a facet like any other.</remarks>
		private static IReadOnlyList<VanillaMenuCategory> _assetMenus = System.Array.Empty<VanillaMenuCategory>();
		// Where the vanilla build menu puts each asset, keyed by prefab entity
		// index. Built by IndexVanillaMenuPlacements; read by the coverage
		// report and by IsPlacedInVanillaMenu.
		private static Dictionary<int, VanillaMenuPlacement> _menuPlacements = new();
		// Milestone index -> the name the rest of the game calls it, resolved
		// once per index pass rather than per locked asset.
		private static Dictionary<int, string> _milestoneNames = new();
		private UniqueAssetTrackingSystem? _uniqueAssets;
		// This system, for the panel to reach without a system reference of its own.
		private static PrefabIndexingSystem? _instance;
		// Every indexed prefab the game flags Unique, rebuilt with the index. The
		// placed-unique rescan walks these rather than all 17k prefabs, so it can
		// afford to run on every catalog publish. See PlacedUniqueScan.
		private List<(int Id, PrefabBase Prefab)> _uniqueCandidates = new();
		// What the last log line said, so a rescan that found nothing stays quiet.
		private int _loggedUniqueCandidateCount = -1;
		// Node entity -> branch label, and service name -> its root's label.
		// Label AND icon together, keyed by node and by service: every service's
		// root is called "Basic", so a label-keyed icon would collide.
		private Dictionary<Entity, (string Label, string Icon, int Depth)> _devTreeBranches = new();
		private static Dictionary<string, (string Label, string Icon, int Depth)> _devTreeRoots = new();
		// Milestone index -> its progression-screen image. Safe to key by index
		// because a milestone index IS unique, unlike a branch label.
		private static Dictionary<int, string> _milestoneIcons = new();
		private readonly List<IPrefabCategoryProcessor> _prefabCategoryProcessors = new();

		/// <summary>Bumped whenever an indexed fact changes: a re-index, an unlock, a unique built or
		/// bulldozed. The catalog's snapshot cache is keyed on it, so a stale projection cannot outlive
		/// the change that staled it.</summary>
		public static int IndexGeneration { get; private set; } = 1;

		// Set when this system is created inside a running city: the game adds a
		// newly subscribed mod to a session after the save is deserialised, so
		// OnGameLoaded has already fired and would leave the menu empty until
		// loading-complete.
		private bool _indexOnFirstUpdate;

		protected override void OnCreate()
		{
			base.OnCreate();

			_instance = this;

			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_resourceSystem = World.GetOrCreateSystemManaged<ResourceSystem>();
			_imageSystem = World.GetOrCreateSystemManaged<ImageSystem>();
			_prefabUISystem = World.GetOrCreateSystemManaged<PrefabUISystem>();
			_menuUISystem = World.GetOrCreateSystemManaged<BuildingMenuUISystem>();

			GameManager.instance.localizationManager.onActiveDictionaryChanged += OnActiveDictionaryChanged;

			// The third availability state, kept live off the game's own tracker.
			// GetExisting rather than GetOrCreate: creating a second copy of a GAME
			// system would leave its OnUpdate dead while looking fine.
			_uniqueAssets = World.GetExistingSystemManaged<UniqueAssetTrackingSystem>();

			if (_uniqueAssets is not null)
			{
				// `+=`, NOT `=`. EventUniqueAssetStatusChanged is a settable PROPERTY
				// rather than a C# event, so assigning would drop whatever the game or
				// another mod had already put there.
				_uniqueAssets.EventUniqueAssetStatusChanged += OnUniqueAssetStatusChanged;
			}

			using var stream = typeof(Mod).Assembly.GetManifestResourceStream("BetterBuildingMenu.Resources.Blacklist.txt");
			using var reader = new StreamReader(stream);

			_blackList = new HashSet<string>(reader.ReadToEnd().Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries));

			foreach (var type in typeof(PrefabIndexingSystem).Assembly.GetTypes())
			{
				if (typeof(IPrefabCategoryProcessor).IsAssignableFrom(type) && !type.IsAbstract)
				{
					var constructor = type.GetConstructors()[0];
					var parameters = constructor.GetParameters();
					var objectParams = new object[parameters.Length];

					for (var i = 0; i < parameters.Length; i++)
					{
						if (parameters[i].ParameterType == typeof(EntityManager))
						{
							objectParams[i] = EntityManager;
						}
						else if (parameters[i].ParameterType == typeof(PrefabSystem))
						{
							objectParams[i] = _prefabSystem;
						}
						else if (parameters[i].ParameterType == typeof(ImageSystem))
						{
							objectParams[i] = _imageSystem;
						}
					}

					_prefabCategoryProcessors.Add((IPrefabCategoryProcessor)Activator.CreateInstance(type, objectParams));
				}
			}

			// The catch-all runs last: it claims only what the others left.
			_prefabCategoryProcessors.Sort((left, right) =>
				(left is Utilities.PrefabCategoryProcessor.MenuPlacedPrefabCategoryProcessor ? 1 : 0)
				- (right is Utilities.PrefabCategoryProcessor.MenuPlacedPrefabCategoryProcessor ? 1 : 0));

			// Unlock events are the second trigger: UnlockSystem.UnlockPrefab
			// disables Locked and raises an Unlock event without marking the prefab
			// Updated, so lock state would otherwise stay stale until the next load.
			_unlockEventQuery = GetEntityQuery(ComponentType.ReadOnly<Unlock>());
			_changedPrefabQuery = GetEntityQuery(new EntityQueryDesc
			{
				All = new[] { ComponentType.ReadOnly<PrefabData>() },
				Any = new[]
				{
					ComponentType.ReadOnly<Created>(),
					ComponentType.ReadOnly<Updated>(),
				}
			});

			Enabled = false;

			if (GameManager.instance.gameMode is GameMode.Game or GameMode.Editor && !GameManager.instance.isGameLoading)
			{
				_indexOnFirstUpdate = true;
				Enabled = true;
			}
		}

		protected override void OnGamePreload(Purpose purpose, GameMode mode)
		{
			base.OnGamePreload(purpose, mode);

			Enabled = false;
			_indexedAtGameLoaded = false;
		}

		/// <summary>The full pass, as soon as the save is deserialised.</summary>
		/// <remarks>Not at loading-complete: the city is playable, and vanilla's menu stands, for as
		/// long as the loading screen takes. See docs/indexing.md, "Load timing".</remarks>
		protected override void OnGameLoaded(Context serializationContext)
		{
			base.OnGameLoaded(serializationContext);

			if (serializationContext.purpose is not (Purpose.NewGame or Purpose.LoadGame or Purpose.NewMap or Purpose.LoadMap))
			{
				return;
			}

			Mod.Log.Info($"Full pass at OnGameLoaded (purpose={serializationContext.purpose})");
			RunIndex(true);
			Enabled = true;
			_indexedAtGameLoaded = true;
		}

		/// <summary>How many indexed prefabs hold a lock state that differs from the game's.</summary>
		/// <remarks>Lock state is the only thing the OnGameLoaded pass could read too early, and this is
		/// the exact test for it: the read ApplyUnlocks uses, over every indexed prefab.</remarks>
		private int LockStateDrift()
		{
			var drift = 0;

			foreach (var prefabIndex in BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any])
			{
				if (prefabIndex.Prefab is not null
					&& _prefabSystem.TryGetEntity(prefabIndex.Prefab, out var entity)
					&& EntityManager.HasEnabledComponent<Locked>(entity) != prefabIndex.IsLocked)
				{
					drift++;
				}
			}

			return drift;
		}

		protected override void OnGameLoadingComplete(Purpose purpose, GameMode mode)
		{
			base.OnGameLoadingComplete(purpose, mode);

			if (Mod.IsRoadBuilderEnabled)
			{
				roadBuilderDiscarded ??= new ComponentType(Assembly.Load("RoadBuilder").GetType("RoadBuilder.Domain.Components.DiscardedRoadBuilderPrefab"), ComponentType.AccessMode.ReadOnly);
			}

			if (mode is GameMode.Game or GameMode.Editor)
			{
				if (_indexedAtGameLoaded)
				{
					var drift = LockStateDrift();

					if (drift == 0)
					{
						Mod.Log.Info("Skipped full pass at OnGameLoadingComplete: indexed at OnGameLoaded and lock state agrees");
						Enabled = true;
						return;
					}

					Mod.Log.Info($"Full pass at OnGameLoadingComplete: {drift} prefab(s) changed lock state since OnGameLoaded");
				}
				else
				{
					Mod.Log.Info($"Full pass at OnGameLoadingComplete (purpose={purpose}, mode={mode})");
				}

				RunIndex(true);

				Enabled = true;
			}
		}

		protected override void OnDestroy()
		{
			if (ReferenceEquals(_instance, this))
			{
				_instance = null;
			}

			GameManager.instance.localizationManager.onActiveDictionaryChanged -= OnActiveDictionaryChanged;

			base.OnDestroy();
		}

		/// <summary>Marks the index stale when the player changes language.</summary>
		/// <remarks>Names are resolved at index time and cached, so only a full pass follows one.
		/// Dispatched to the main thread: a language change touches no entity, so OnUpdate sees none.</remarks>
		private void OnActiveDictionaryChanged()
		{
			if (_localeChanged)
			{
				return;
			}

			_localeChanged = true;

			MainThreadDispatcher.RunOnMainThread(() =>
			{
				_localeChanged = false;

				RunIndex(true);
			});
		}

		/// <remarks>Registered at UIUpdate as well as PrefabUpdate: PrefabUpdate ticks only when
		/// prefabs change and an unlock is not a prefab change, so the unlock branch needs a phase that
		/// runs every frame after UnlockSystem has raised its events.</remarks>
		protected override void OnUpdate()
		{
			if (_indexOnFirstUpdate)
			{
				_indexOnFirstUpdate = false;
				Mod.Log.Info("Full pass at first update: the mod joined a running game");
				// _indexedAtGameLoaded stays false so loading-complete, if it is
				// still to come, runs its own full pass over the finished save.
				RunIndex(true);
			}

			if (!_unlockEventQuery.IsEmptyIgnoreFilter)
			{
				ApplyUnlocks();
			}

			if (_changedPrefabQuery.IsEmptyIgnoreFilter)
			{
				return;
			}

			RunIndex(false);
		}

		/// <summary>Clears the lock state of the prefabs an Unlock event names.</summary>
		/// <remarks>A patch rather than the full re-index that would freeze the game on a milestone:
		/// lock state feeds only the three fields AddPrefab sets together, on instances every list shares.</remarks>
		private void ApplyUnlocks()
		{
			var events = _unlockEventQuery.ToComponentDataArray<Unlock>(Allocator.Temp);
			var changed = 0;

			for (var i = 0; i < events.Length; i++)
			{
				var entity = events[i].m_Prefab;
				var prefabIndex = BuildingMenuUtil.GetPrefabIndex(entity.Index);

				// Not every unlock is ours: the game unlocks prefabs no processor
				// indexes, and asking for one back returns null rather than throwing.
				if (prefabIndex is null)
				{
					continue;
				}

				// Read the component rather than assuming the event means unlocked,
				// so this reports what the game holds even if an unlock is undone.
				var locked = EntityManager.HasEnabledComponent<Locked>(entity);

				if (prefabIndex.IsLocked == locked)
				{
					continue;
				}

				prefabIndex.IsLocked = locked;

				// The MILESTONE is a permanent property of the asset and is kept
				// whatever the lock state; the REQUIREMENTS answer "what is this
				// waiting on", which an unlocked asset does not have.
				(prefabIndex.UnlockMilestone, var requirements) = GetUnlockRequirements(entity);
				prefabIndex.UnlockRequirements = locked ? requirements : Array.Empty<string>();

				changed++;
			}

			events.Dispose();

			if (changed == 0)
			{
				return;
			}

			Mod.Log.Info($"Unlocked {changed} indexed prefab(s)");

			// The catalog is served from a cached search, so the rows keep their
			// old lock state until it is rebuilt — and an Availability filter set
			// to Unlocked would still be excluding them.
			IndexGeneration++;
			_menuUISystem.TriggerSearch();
		}

		/// <summary>Resolves every asset's silhouette now, while the game is still loading.</summary>
		/// <remarks>The cache memoises per asset, so otherwise each menu pays for its own the first time
		/// the player opens it. Full passes only; an incremental reindex touches a handful of prefabs.</remarks>
		private void PrimeSilhouettes()
		{
			if (Mod.Silhouettes is null)
			{
				return;
			}

			var timer = Stopwatch.StartNew();
			var seen = 0;

			foreach (var prefab in BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any])
			{
				var thumbnail = prefab.Thumbnail ?? prefab.FallbackThumbnail;

				if (string.IsNullOrEmpty(thumbnail))
				{
					continue;
				}

				// Cheap and self-limiting: the cache returns immediately for a
				// raster, and remembers a miss as readily as a hit.
				Mod.Silhouettes.UrlFor(IconPath.Normalize(thumbnail));
				seen++;
			}

			Mod.Log.Info(
				$"Primed silhouettes for {seen} prefab(s) in {timer.Elapsed.TotalSeconds:0.000}s "
				+ $"({Mod.Silhouettes.Generated} generated)");
		}

		private void RunIndex(bool full)
		{
			var stopWatch = Stopwatch.StartNew();
			var existingMeshes = new List<string>();
			var census = new Dictionary<string, List<int>>(StringComparer.Ordinal);

			if (full)
			{
				BuildingMenuUtil.CategorizedPrefabs.Clear();

				AddAllCategories();

				// Before IndexZones and before the processors: the zone catalog
				// inherits the game's own Zones menu, and the blacklist check below
				// consults the placements too.
				IndexVanillaMenuPlacements();
				IndexZones();
				IndexAssetMenus();
				IndexAssetCategories();
				IndexMilestones();
				IndexDevTreeBranches();
			}

			foreach (var processor in _prefabCategoryProcessors)
			{
				if (full)
				{
					Mod.Log.Info($"Indexing prefabs with {processor.GetType().Name}");
				}

				try
				{
					var queries = processor.GetEntityQuery();

					var query = GetEntityQuery(queries);

					if (!full)
					{
						for (var i = 0; i < queries.Length; i++)
						{
							queries[i].Any = new[] { ComponentType.ReadOnly<Created>(), ComponentType.ReadOnly<Updated>() };
						}

						if (GetEntityQuery(queries).IsEmptyIgnoreFilter)
						{
							continue;
						}
					}

					var entities = query.ToEntityArray(Allocator.Temp);

					if (full)
					{
						Mod.Log.Info($"\tTotal Entities Count: {entities.Length}");
					}

					for (var i = 0; i < entities.Length; i++)
					{
						var entity = entities[i];

						if (!_prefabSystem.TryGetPrefab<PrefabBase>(entity, out var prefab) || prefab?.name is null)
						{
							continue;
						}

						// The blacklist is a list of names written for a flat asset browser. It
						// cannot outrank the build menu: Extractor Lot and Landfill Site Lot are
						// on it and are also tools the Areas and Garbage menus hand the player.
						if (_blackList.Contains(prefab.name) && !IsPlacedInVanillaMenu(entity.Index))
						{
							continue;
						}

						if (full && Mod.Log.isLevelEnabled(Level.Debug))
						{
							Mod.Log.Debug($"\tProcessing: {prefab.name}");
#if DEBUG
							Mod.Log.Debug($"\t\t> {prefab.GetType().Name} - {string.Join(", ", EntityManager.GetComponentTypes(entity).Select(x => x.GetManagedType()?.Name ?? string.Empty))}");
#endif
						}

						PrefabIndex prefabIndex = null;

						try
						{
							if (roadBuilderDiscarded.HasValue && EntityManager.HasComponent(entity, roadBuilderDiscarded.Value))
							{
								BuildingMenuUtil.RemoveItem(entity);

								continue;
							}

							if (!full && EntityManager.HasComponent<Created>(entity) && BuildingMenuUtil.Find(_prefabSystem.GetPrefab<PrefabBase>(entity), out var oldId))
							{
								BuildingMenuUtil.RemoveItem(oldId);
							}

							if (processor.TryCreatePrefabIndex(prefab, entity, out prefabIndex))
							{
								if (full && prefab is ObjectGeometryPrefab geometryPrefab && geometryPrefab.m_Meshes?.FirstOrDefault()?.m_Mesh?.name is string meshName)
								{
									if (meshName is not null or "" && !existingMeshes.Contains(meshName))
									{
										prefabIndex.IsUniqueMesh = true;
										existingMeshes.Add(meshName);
									}
								}

								if (prefab.TryGet<EditorAssetCategoryOverride>(out var overrides) && (overrides?.m_IncludeCategories?.Any() ?? false))
								{
									// Legacy FindIt category overrides are still read, so existing assets
									// keep their classification. An author's exclusion is honoured only for
									// assets the game does not itself place in a menu.
									if ((overrides?.m_ExcludeCategories?.Any(IsFindItCategoryOverride) ?? false)
										&& !IsPlacedInVanillaMenu(entity.Index))
									{
										continue;
									}

									if (overrides?.m_IncludeCategories?.Any() ?? false)
									{
										for (var ind = 0; ind < overrides.m_IncludeCategories.Length; ind++)
										{
											if (IsFindItCategoryOverride(overrides.m_IncludeCategories[ind]))
											{
												var split = overrides.m_IncludeCategories[ind].Split('/');

												if (split.Length >= 3 && int.TryParse(split[1], out var categeory) && int.TryParse(split[2], out var subCategeory))
												{
													prefabIndex.Category = (PrefabCategory)categeory;
													prefabIndex.SubCategory = (PrefabSubCategory)subCategeory;
												}

												if (split.Length >= 4 && int.TryParse(split[3], out var pdxModsId))
												{
													prefabIndex.PdxModsId = pdxModsId.ToString();
												}
											}
										}
									}
								}

								AddPrefab(prefab, entity, prefabIndex);

								if (full)
								{
									if (!census.TryGetValue(processor.GetType().Name, out var ids))
									{
										census[processor.GetType().Name] = ids = new List<int>();
									}

									ids.Add(prefabIndex.Id);
								}
							}
							else
							{
								Mod.Log.Debug($"\t\tSkipped: {prefab.name}");
							}
						}
						catch (Exception ex)
						{
							Mod.Log.Error(ex, $"Prefab indexing failed for prefab '{prefab.name}'" + (string.IsNullOrEmpty(prefabIndex?.PdxModsId) ? "" : $" (Pdx Mods ID: {prefabIndex.PdxModsId})"));
						}
					}
				}
				catch (Exception ex)
				{
					Mod.Log.Error(ex, $"Prefab indexing failed for processor {processor.GetType().Name}");
				}
			}

			if (full)
			{
				FillPdxModsData();

				AddNumberToDuplicatePrefabNames();

				CleanupBrandPrefabs();
			}

			BuildingMenuUtil.IsReady = true;
			IndexGeneration++;

			_menuUISystem.TriggerSearch();

			// Rescan the placed uniques against the city that just loaded: the
			// tracker's loaded-asset events may already have run this frame, and a
			// previous city's entries would otherwise survive into this one. Partial
			// passes too, so a prefab a mod added at runtime joins the candidates.
			RefreshPlacedUniques(rebuildCandidates: true);

			stopWatch.Stop();

			Mod.Log.Info($"{(full ? "Full" : "Partial")} Prefab Indexing completed in {stopWatch.Elapsed.TotalSeconds:0.000}s");
			// The locked count is logged so a second full pass on the same load can
			// be checked against the first.
			Mod.Log.Info($"Indexed Prefabs Count: {BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].Count}"
				+ $" locked={BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].Count(p => p.IsLocked)}");

			if (full)
			{
				// Which processors feed anything the lens can show. A processor
				// whose every prefab is neither a building/network nor placed in
				// a vanilla menu is indexing for nobody; this is the count.
				var all = BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any];

				foreach (var pair in census.OrderBy(pair => pair.Key, StringComparer.Ordinal))
				{
					var lens = pair.Value.Count(id =>
						all.TryGetValue(id, out var indexed)
						&& (indexed.Category is PrefabCategory.Buildings or PrefabCategory.ServiceBuildings or PrefabCategory.Networks
							|| IsPlacedInAnyMenu(id)));

					Mod.Log.Info($"[PROCESSOR-CENSUS] {pair.Key} indexed={pair.Value.Count} lens={lens}");
				}
			}

			if (full)
			{
				PrimeSilhouettes();
			}

			if (full)
			{
				LogVanillaMenuCoverage();
				LogVanillaMenuAudit();
			}
		}

			/// <summary>Records where the vanilla build menu places each asset, walking the game's own
			/// group tree from the menus downward.</summary>
			/// <remarks>The direction is the whole point; see docs/indexing.md, "The vanilla menu walk".</remarks>
			private void IndexVanillaMenuPlacements()
			{
				var placements = new Dictionary<int, VanillaMenuPlacement>();

				try
				{
					var query = GetEntityQuery(
						ComponentType.ReadOnly<UIAssetMenuData>(),
						ComponentType.ReadOnly<PrefabData>());
					var menus = query.ToEntityArray(Allocator.Temp);

					for (var i = 0; i < menus.Length; i++)
					{
						if (!_prefabSystem.TryGetPrefab<PrefabBase>(menus[i], out var menuPrefab)
							|| menuPrefab?.name is not string menuName
							|| !EntityManager.TryGetBuffer<UIGroupElement>(menus[i], true, out var categories))
						{
							continue;
						}

						for (var c = 0; c < categories.Length; c++)
						{
							var categoryEntity = categories[c].m_Prefab;

							// GetSortedCategories drops both of these, so a tab the player
							// cannot reach places nothing.
							if (!EntityManager.HasComponent<UIAssetCategoryData>(categoryEntity)
								|| !EntityManager.TryGetBuffer<UIGroupElement>(categoryEntity, true, out var assets)
								|| assets.Length == 0
								|| !_prefabSystem.TryGetPrefab<PrefabBase>(categoryEntity, out var categoryPrefab))
							{
								continue;
							}

							for (var a = 0; a < assets.Length; a++)
							{
								var assetEntity = assets[a].m_Prefab;

								if (EntityManager.HasComponent<ServiceUpgradeData>(assetEntity))
								{
									continue;
								}

								// Keyed by index alone because that is what PrefabIndex.Id
								// holds and what the diff compares against; the whole entity
								// rides along so a gap can still be named.
								placements[assetEntity.Index] = new VanillaMenuPlacement(
									assetEntity, menuName, categoryPrefab.name);
							}
						}
					}

					menus.Dispose();
				}
				catch (Exception ex)
				{
					Mod.Log.Error(ex, "[MENU-COVERAGE] walk failed");
				}

				_menuPlacements = placements;
				Mod.Log.Info($"Indexed Vanilla Menu Placements: {placements.Count}");
			}

			/// <summary>Whether the vanilla build menu offers this prefab to the player.</summary>
			/// <remarks>The index's tie-breaker: whatever the game puts in front of the player, the lens
			/// carries too, whichever of our own rules — the blacklist, the brush filter — would drop it.</remarks>
			public static bool IsPlacedInVanillaMenu(int entityIndex) =>
				_menuPlacements.ContainsKey(entityIndex);

			/// <summary>The vanilla menu that holds an asset, as an entity the game's toolbar accepts.</summary>
			/// <remarks>Fails for anything the game places in no menu — most assets — so the caller needs a
			/// fallback.</remarks>
			public static bool TryGetMenuEntityFor(int assetEntityIndex, out Entity menu)
			{
				menu = Entity.Null;

				return _menuPlacements.TryGetValue(assetEntityIndex, out var placement)
					&& placement.Menu is not null
					&& _assetMenuEntities.TryGetValue(placement.Menu.Trim(), out menu);
			}

			/// <summary>A menu's own entity, by the name the lens scopes itself with.</summary>
			/// <remarks>The same table <see cref="TryGetMenuEntityFor"/> reaches through, keyed straight
			/// off the menu name: the lens knows which menu it took over without holding an asset from it.</remarks>
			public static bool TryGetAssetMenuEntity(string menu, out Entity entity)
			{
				entity = Entity.Null;

				return !string.IsNullOrWhiteSpace(menu)
					&& _assetMenuEntities.TryGetValue(menu.Trim(), out entity);
			}

			/// <summary>Whether the game places this asset in that named menu.</summary>
			/// <remarks>The downward read. Its opposite number, <c>PrefabIndex.UiMenuName</c>, reads upward
			/// from an asset we hold, so it can only ever describe assets some processor indexed.</remarks>
			public static bool IsPlacedInMenu(int entityIndex, string menu) =>
				_menuPlacements.TryGetValue(entityIndex, out var placement)
				&& string.Equals(placement.Menu?.Trim(), menu, System.StringComparison.OrdinalIgnoreCase);

			/// <summary>The vanilla menu category an asset is placed in, when the game places it at all.</summary>
			public static bool TryGetVanillaCategory(int entityIndex, out string category)
			{
				category = string.Empty;

				if (!_menuPlacements.TryGetValue(entityIndex, out var placement) || string.IsNullOrWhiteSpace(placement.Category))
				{
					return false;
				}

				category = placement.Category.Trim();
				return true;
			}

			/// <summary>Whether the game places this asset in any menu at all.</summary>
			/// <remarks>The guard on the Roads menu's network gathering: the index also holds networks the
			/// game never offers, and admitting those would put unplaceable rows in that menu.</remarks>
			public static bool IsPlacedInAnyMenu(int entityIndex) =>
				_menuPlacements.ContainsKey(entityIndex);

			/// <summary>A per-menu census of the vanilla build menu, in both directions.</summary>
			/// <remarks>A census rather than an alarm, logged at Info whether or not anything is wrong; the
			/// arithmetic lives in <see cref="VanillaMenuAudit"/>. See docs/indexing.md, "The menu audit".</remarks>
			private void LogVanillaMenuAudit()
			{
				try
				{
					var indexed = BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any];

					// Everything we hold at all, menu or not. Zones included
					// deliberately — leaving them out is the blindness this exists
					// to remove.
					var held = new HashSet<int>(indexed.Select(entry => entry.Id));

					foreach (var zone in _zoneCatalog)
					{
						held.Add(zone.Id);
					}

					var report = VanillaMenuAudit.Compare(
						_menuPlacements.Values.Select(placement => new VanillaMenuPlacementFact(
							placement.Entity.Index,
							_prefabSystem.TryGetPrefab<PrefabBase>(placement.Entity, out var placed)
								? placed?.name ?? string.Empty
								: string.Empty,
							placement.Menu ?? "(none)",
							placement.Category ?? string.Empty)),
						indexed.Select(entry => new IndexedMenuFact(
							entry.Id,
							entry.PrefabName ?? $"entity:{entry.Id}",
							entry.UiMenuName ?? string.Empty,
							entry.IsServiceUpgrade)),
						held);

					Mod.Log.Info(
						$"[MENU-AUDIT] {report.Menus.Count} vanilla menus, {report.PlacementCount} placements, "
						+ $"{indexed.Count} indexed assets, {_zoneCatalog.Count} zones"
						+ (report.IsClean ? "" : " — NOT CLEAN"));

					// The reason goes next to the census, once, rather than living
					// only in a source comment nobody reading Modding.log can see.
					if (report.Menus.Any(line => line.ExpectedExtras.Count > 0))
					{
						Mod.Log.Info($"[MENU-AUDIT] expectedExtras: {VanillaMenuAudit.Divergences}");
					}

					// What the first-party content packs actually contribute. Two very
					// different causes look identical from the UI — the prefabs may be
					// absent, or present and filtered for being unowned — and this says which.
					try
					{
						var platform = PlatformManager.instance;

						var byDlc = indexed
							.GroupBy(entry => entry.DlcId)
							.Select(group => new
							{
								Count = group.Count(),
								Name = platform.GetDlcName(group.Key)
									?? group.Key.id.ToString(CultureInfo.InvariantCulture),
							})
							.OrderByDescending(line => line.Count)
							.ToArray();

						Mod.Log.Info(
							"[DLC-AUDIT] indexed by DLC: "
							+ string.Join(", ", byDlc.Select(line => $"{line.Name}={line.Count}")));

						var local = platform.EnumerateLocalDLCs().ToArray();
						var store = platform.EnumerateDLCs().ToArray();

						Mod.Log.Info(
							$"[DLC-AUDIT] {platform.dlcBackends?.Count ?? 0} backend(s), "
							+ $"{local.Length} installed, {store.Length} from the store, "
							+ $"dlcCount={platform.dlcCount}");

						Mod.Log.Info(
							"[DLC-AUDIT] ownership: "
							+ string.Join(
								", ",
								local.Select(dlc =>
									$"{dlc.internalName}={(platform.IsDlcOwned(dlc.id) ? "owned" : "NOT-OWNED")}")));
					}
					catch (Exception ex)
					{
						Mod.Log.Error(ex, "[DLC-AUDIT] failed");
					}

					foreach (var line in report.Menus)
					{
						var text =
							$"[MENU-AUDIT] menu=\"{line.Menu}\" categories={line.Categories} vanilla={line.VanillaPlaces} "
							+ $"held={line.Held} missing={line.Missing.Count} ours={line.Ours}";

						// Capped: a long tail here is a pattern, not a list to read.
						if (line.Missing.Count > 0)
						{
							text += $" [{Cap(line.Missing)}]";
						}

						if (line.ExpectedExtras.Count > 0)
						{
							text += $" expectedExtras={line.ExpectedExtras.Count} [{Cap(line.ExpectedExtras)}]";
						}

						if (line.UnexplainedExtras.Count > 0)
						{
							text += $" UNEXPLAINED={line.UnexplainedExtras.Count} [{Cap(line.UnexplainedExtras)}]";
						}

						Mod.Log.Info(text);
					}

					foreach (var menu in report.InventedMenus)
					{
						Mod.Log.Warn(
							$"[MENU-AUDIT] menu=\"{menu}\" is not a vanilla menu at all, yet our assets claim it");
					}
				}
				catch (Exception ex)
				{
					Mod.Log.Error(ex, "[MENU-AUDIT] failed");
				}
			}

			private static string Cap(IReadOnlyList<string> names) =>
				string.Join(",", names.Take(8)) + (names.Count > 8 ? ",…" : string.Empty);

			/// <summary>Reports every asset the vanilla build menu shows that our index does not.</summary>
			/// <remarks>Logged rather than thrown: a gap is a real state of the game — a mod can add a menu
			/// whose assets we have no processor for — and a short menu beats a dead one.</remarks>
			private void LogVanillaMenuCoverage()
			{
				try
				{
					var indexed = BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any];
					// PrefabIndex.Id is the prefab entity's index (see AddPrefab), so this
					// is an identity comparison rather than a name match.
					var byEntity = new Dictionary<int, PrefabIndex>();

					foreach (var entry in indexed)
					{
						byEntity[entry.Id] = entry;
					}

					// Zones reach the player through the zoning hierarchy rather than the
					// prefab index, so they are covered without being in it. Left out, the
					// report would accuse itself of losing every one of them.
					var zoned = new HashSet<int>(_zoneCatalog.Select(zone => zone.Id));
					var missing = new Dictionary<string, List<string>>();
					var misplaced = new Dictionary<string, List<string>>();
					var shown = new Dictionary<string, int>();

					foreach (var placement in _menuPlacements.Values)
					{
						var where = placement.Menu + '\u0000' + placement.Category;

						shown.TryGetValue(where, out var count);
						shown[where] = count + 1;

						if (zoned.Contains(placement.Entity.Index))
						{
							continue;
						}

						if (byEntity.TryGetValue(placement.Entity.Index, out var entry))
						{
							if (entry.UiCategoryName != placement.Category)
							{
								// Indexed, but filed under a different category than the tree
								// puts it in, so it is absent from this tab for a different
								// reason.
								Add(misplaced, where, $"{entry.PrefabName}->{entry.UiCategoryName ?? "none"}");
							}

							continue;
						}

						if (!_prefabSystem.TryGetPrefab<PrefabBase>(placement.Entity, out var assetPrefab) || assetPrefab?.name is null)
						{
							Add(missing, where, $"entity:{placement.Entity.Index}");
							continue;
						}

						// The prefab's own type is reported because it names what a
						// processor would have to query to reach it, which is the next
						// question every gap raises.
						Add(missing, where, DescribeMissing(assetPrefab, placement.Entity));
					}

					var totalMissing = 0;

					foreach (var where in shown.Keys.OrderBy(key => key, StringComparer.Ordinal))
					{
						missing.TryGetValue(where, out var gaps);
						misplaced.TryGetValue(where, out var strays);

						totalMissing += gaps?.Count ?? 0;

						if ((gaps?.Count ?? 0) == 0 && (strays?.Count ?? 0) == 0)
						{
							continue;
						}

						var parts = where.Split('\u0000');

						Mod.Log.Warn(
							$"[MENU-COVERAGE] menu=\"{parts[0]}\" category=\"{parts[1]}\" "
							+ $"vanilla={shown[where]} missing={gaps?.Count ?? 0} [{string.Join(",", gaps ?? new List<string>())}]"
							+ ((strays?.Count ?? 0) == 0 ? string.Empty : $" misplaced=[{string.Join(",", strays)}]"));
					}

					var summary = $"[MENU-COVERAGE] vanilla shows {_menuPlacements.Count} assets across its menus; "
						+ $"{totalMissing} missing from the index";

					if (totalMissing == 0)
					{
						Mod.Log.Info(summary);
					}
					else
					{
						Mod.Log.Warn(summary);
					}
				}
				catch (Exception ex)
				{
					Mod.Log.Error(ex, "[MENU-COVERAGE] report failed");
				}

				// Why an asset vanilla places is not in the index: the editor categories
				// the processors read, and the components their queries key on.
				string DescribeMissing(PrefabBase assetPrefab, Entity assetEntity)
				{
					var parts = new List<string> { assetPrefab.GetType().Name };
					if (assetPrefab.TryGet<EditorAssetCategoryOverride>(out var overrides))
					{
						parts.Add("include=" + string.Join("+", overrides.m_IncludeCategories ?? System.Array.Empty<string>()));
						parts.Add("exclude=" + string.Join("+", overrides.m_ExcludeCategories ?? System.Array.Empty<string>()));
					}
					var flags = new List<string>();
					if (EntityManager.HasComponent<BuildingData>(assetEntity)) flags.Add("Building");
					if (EntityManager.HasComponent<BuildingPropertyData>(assetEntity)) flags.Add("Property");
					if (EntityManager.HasComponent<SpawnableBuildingData>(assetEntity)) flags.Add("Spawnable");
					if (EntityManager.HasComponent<SignatureBuildingData>(assetEntity)) flags.Add("Signature");
					if (EntityManager.HasComponent<ServiceObjectData>(assetEntity)) flags.Add("Service");
					if (EntityManager.HasComponent<StaticObjectData>(assetEntity)) flags.Add("StaticObject");
					if (EntityManager.HasComponent<PlantData>(assetEntity)) flags.Add("Plant");
					if (EntityManager.IsDecal(assetEntity)) flags.Add("Decal");
					if (flags.Count > 0) parts.Add("has=" + string.Join("+", flags));
					return $"{assetPrefab.name}({string.Join(" ", parts)})";
				}

				static void Add(Dictionary<string, List<string>> into, string where, string what)
				{
					if (!into.TryGetValue(where, out var list))
					{
						list = new List<string>();
						into[where] = list;
					}

					list.Add(what);
				}
			}

			private static bool IsFindItCategoryOverride(string category)
			{
				return category == "FindIt"
					|| category.StartsWith("FindIt/", StringComparison.Ordinal)
					|| category == "BetterBuildingMenu"
					|| category.StartsWith("BetterBuildingMenu/", StringComparison.Ordinal);
			}

			private void AddPrefab(PrefabBase prefab, Entity entity, PrefabIndex prefabIndex)
		{
			prefabIndex.Id = entity.Index;
			prefabIndex.PrefabName = prefab.name;
			prefabIndex.Name = GetAssetName(prefab);
			prefabIndex.Thumbnail = IconPath.Normalize(prefabIndex.Thumbnail ?? ImageSystem.GetThumbnail(prefab));
			prefabIndex.FallbackThumbnail ??= CategoryIconAttribute.GetAttribute(prefabIndex.SubCategory).Icon;
			prefabIndex.CategoryThumbnail ??= CategoryIconAttribute.GetAttribute(prefabIndex.SubCategory).Icon;
			prefabIndex.Theme ??= prefab.GetComponent<ThemeObject>()?.m_Theme;
			prefabIndex.AssetPacks ??= prefab.GetComponent<AssetPackItem>()?.m_Packs?.Where(x => x is not null).ToArray() ?? new AssetPackPrefab[0];
			// Service upgrades are marked by ServiceUpgrade on the prefab and/or
			// ServiceUpgradeData on the entity, and some game versions expose only
			// one; vanilla's "Additional ..." entries are not BuildingExtensionPrefab.
			bool isBuildingExtension = prefabIndex.Category is PrefabCategory.Buildings or PrefabCategory.ServiceBuildings
				&& (prefab is BuildingExtensionPrefab
					|| EntityManager.HasComponent<BuildingExtensionData>(entity)
					|| EntityManager.HasComponent<ServiceUpgradeData>(entity)
					|| prefab.TryGet<ServiceUpgrade>(out _));
			prefabIndex.ExtensionIds ??= isBuildingExtension ? new[] { prefab.name } : Array.Empty<string>();
			if (prefabIndex.SupportedUpgradeIds is null)
			{
				(prefabIndex.SupportedUpgradeIds, prefabIndex.SupportedUpgradePrefabNames) = GetSupportedUpgrades(entity);
			}
			// Narrower than isBuildingExtension above, deliberately: this is
			// vanilla's exact test in FilterOutUpgrades, so what we hide from the
			// list is precisely what the game hides from its grid.
			prefabIndex.IsServiceUpgrade = EntityManager.HasComponent<ServiceUpgradeData>(entity);
			// The theme, pack and mod facts vanilla's own toolbar row filters on,
			// captured here because they are ECS reads. Identity-free by design:
			// entity indices rather than names, so a modded theme needs no change.
			prefabIndex.VanillaFacts = GetVanillaAssetFacts(entity);
			// The game's own test, so a difference is a bug rather than a
			// second opinion: IsUniqueAsset reads PlaceableObjectData's Unique
			// flag, which is what ToolbarUISystem.BindAssets asks too.
			prefabIndex.IsUnique = _uniqueAssets is not null && _uniqueAssets.IsUniqueAsset(entity);
			prefabIndex.ThemeThumbnail = prefabIndex.ThemeThumbnail is not null
				? IconPath.Normalize(prefabIndex.ThemeThumbnail)
				: prefabIndex.Theme is null ? null : IconPath.Normalize(ImageSystem.GetThumbnail(prefabIndex.Theme));
			prefabIndex.PackThumbnails ??= prefabIndex.AssetPacks.Select(pack => IconPath.Normalize(ImageSystem.GetThumbnail(pack))).ToArray();
			prefabIndex.Tags ??= new();
			prefabIndex.UIOrder = prefab.TryGet<UIObject>(out var uIObject) ? uIObject.m_Priority : int.MaxValue;
			// The menu placement the game itself uses. m_Group is
			// the asset's UI category; a category that is a UIAssetCategoryPrefab
			// names its menu. Two managed references, no ECS lookup.
			prefabIndex.UiCategoryName = uIObject?.m_Group?.name;
			prefabIndex.UiMenuName = (uIObject?.m_Group as UIAssetCategoryPrefab)?.m_Menu?.name;
			// The entity world's placement wins: mods that regroup the menu at
			// runtime edit it there and leave the managed group on the stock tab.
			if (_menuPlacements.TryGetValue(entity.Index, out var placed))
			{
				(prefabIndex.UiCategoryName, prefabIndex.UiMenuName) = MenuPlacementOverride.Resolve(
					prefabIndex.UiCategoryName, prefabIndex.UiMenuName, placed.Category, placed.Menu);
			}
			// The category's own priority, so a group of assets can be ordered the
			// way the tab strip above it is. Guarded on UIAssetCategoryPrefab rather
			// than on m_Group: a menu's priority ranks menus, a different space.
			prefabIndex.UiCategoryPriority =
				uIObject?.m_Group is UIAssetCategoryPrefab category
				&& category.TryGet<UIObject>(out var categoryUi)
					? categoryUi.m_Priority
					: 0;
			prefabIndex.IsVanilla = prefab.isBuiltin;
			// Every category, not only buildings: a parking lot reached through the
			// Roads menu is a network, and parking is the whole point of one.
			prefabIndex.ParkingSlots = GetParkingSlots(prefab);
			prefabIndex.HasParking = prefabIndex.ParkingSlots > 0;
			// Enableable: presence alone would mark every unlockable asset
			// locked forever, including the ones already earned.
			prefabIndex.IsLocked = EntityManager.HasEnabledComponent<Locked>(entity);
			prefabIndex.Bonuses = GetBonuses(entity);

			// Milestone kept whatever the lock state; requirements only while
			// locked. See the matching note in ApplyUnlocks.
			(prefabIndex.UnlockMilestone, var unlockRequirements) = GetUnlockRequirements(entity);
			prefabIndex.UnlockRequirements = prefabIndex.IsLocked ? unlockRequirements : Array.Empty<string>();

			// The other half of the progression, and the half that splits a service
			// menu. After UiMenuName above: an asset the tree never gated falls into
			// its service's root bucket, and the menu is what names the service.
			(prefabIndex.DevTreeBranch, prefabIndex.DevTreeBranchIcon, prefabIndex.DevTreeBranchDepth) =
				GetDevTreeBranch(entity, prefabIndex.UiMenuName);
			prefabIndex.IsRandom = prefabIndex.SubCategory is not PrefabSubCategory.Networks_Pillars && EntityManager.HasComponent<PlaceholderObjectData>(entity);
			prefabIndex.IsResourceIntensive = CheckIfResourceIntensive(prefab);

			if (prefab.asset?.database == AssetDatabase<ParadoxMods>.instance)
			{
				var meta = prefab.asset.GetMeta();

				prefabIndex.PdxModsId = prefab.asset.GetMeta().platformID;
			}

#if DEBUG
			if (prefabIndex.SubCategory != PrefabSubCategory.Props_Branding && !prefabIndex.IsRandom && ImageSystem.GetIcon(prefab) is null or "" && !prefab.Has<ServiceUpgrade>())
			{
				if (uIObject is null
					|| uIObject.m_Group is null
					|| !prefab.isBuiltin
					|| !uIObject.m_Group.isBuiltin)
				{
					Mod.Log.Info("MISSINGICON: " + prefab.name);
				}
			}
#endif

			if (prefabIndex.IsRandom && EntityManager.TryGetBuffer<PlaceholderObjectElement>(entity, true, out var placeholderObjectElements))
			{
				prefabIndex.RandomPrefabs = new int[placeholderObjectElements.Length];
				prefabIndex.RandomPrefabThumbnails = new string[placeholderObjectElements.Length];

				for (var i = 0; i < placeholderObjectElements.Length; i++)
				{
					prefabIndex.RandomPrefabs[i] = placeholderObjectElements[i].m_Object.Index;

					if (_prefabSystem.TryGetPrefab<PrefabBase>(placeholderObjectElements[i].m_Object, out var randomPrefab))
					{
						prefabIndex.RandomPrefabThumbnails[i] = IconPath.Normalize(ImageSystem.GetThumbnail(randomPrefab));
					}
				}
			}

			// Asset packs come off the prefab's own AssetPackItem and are
			// independent of DLC ownership, so they are read for every prefab.
			if (prefab.TryGet<AssetPackItem>(out var assetPackItem) && assetPackItem.m_Packs is not null)
			{
				prefabIndex.AssetPacks = assetPackItem.m_Packs.Where(pack => pack is not null).ToArray();
				prefabIndex.PackThumbnails = prefabIndex.AssetPacks
					.Select(pack => IconPath.Normalize(ImageSystem.GetThumbnail(pack)))
					.ToArray();
			}
			else
			{
				prefabIndex.AssetPacks = new AssetPackPrefab[0];
				prefabIndex.PackThumbnails = new string[0];
			}

			if (prefab.TryGet<ContentPrerequisite>(out var contentPrerequisites)
				&& contentPrerequisites.m_ContentPrerequisite.TryGet<DlcRequirement>(out var dlcRequirements))
			{
				prefabIndex.DlcId = dlcRequirements.m_Dlc;
				prefabIndex.DlcThumbnail = $"Media/DLC/{PlatformManager.instance.GetDlcName(dlcRequirements.m_Dlc)}.svg";
			}
			else if (prefabIndex.IsVanilla)
			{
				prefabIndex.DlcId = DlcId.BaseGame;
			}
			else
			{
				prefabIndex.DlcId = DlcId.Invalid;
			}

			if (EntityManager.TryGetComponent<BuildingData>(entity, out var buildingData))
			{
				prefabIndex.LotSize = buildingData.m_LotSize;
				if (prefabIndex.Category is PrefabCategory.Buildings or PrefabCategory.ServiceBuildings)
				{
					prefabIndex.BuildingFlagsValue = buildingData.m_Flags;
				}
			}
			else if (EntityManager.TryGetComponent<BuildingExtensionData>(entity, out var extensionData))
			{
				prefabIndex.LotSize = extensionData.m_LotSize;
			}

			PopulateAnalyticalData(entity, prefabIndex);

			BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any][prefabIndex.Id] = prefabIndex;

			BuildingMenuUtil.CategorizedPrefabs[prefabIndex.Category][PrefabSubCategory.Any][prefabIndex.Id] = prefabIndex;

			BuildingMenuUtil.CategorizedPrefabs[prefabIndex.Category][prefabIndex.SubCategory][prefabIndex.Id] = prefabIndex;

		}

		/// <summary>Cells per kilometre, so a network's per-cell cost reads as a per-km one.</summary>
		/// <remarks>Vanilla's own factor: PrefabUISystem binds int2(cost, cost * 125) for
		/// PlaceableNetData, and the shipped UI renders it through VALUE_MONEY_PER_KILOMETER.</remarks>
		private const float NetCellsPerKilometre = 125f;

		private void PopulateAnalyticalData(Entity entity, PrefabIndex prefabIndex)
		{
			// A filter on work, not on correctness: a component that does not apply
			// to a category simply does not match. Networks, zones, trees and props
			// are all priced from components read below, so they belong here.
			if (prefabIndex.Category is not PrefabCategory.Buildings
				and not PrefabCategory.ServiceBuildings
				and not PrefabCategory.Networks
				and not PrefabCategory.Zones
				and not PrefabCategory.Trees
				and not PrefabCategory.Props)
			{
				return;
			}

			if (EntityManager.TryGetComponent<PlaceableObjectData>(entity, out var placeableData))
			{
				prefabIndex.ConstructionCost = placeableData.m_ConstructionCost;
				Fact(prefabIndex, "xpReward", placeableData.m_XPReward);
			}
			else if (!EntityManager.HasComponent<PlaceableNetData>(entity)
				&& EntityManager.TryGetComponent<ServiceUpgradeData>(entity, out var upgradeData))
			{
				// An annex — a BuildingExtensionPrefab carrying ServiceUpgrade — has no
				// PlaceableObjectData: ServiceUpgrade adds that only to a BuildingPrefab.
				// Its price lives here, which is where GenerateObjectsSystem falls back to.
				prefabIndex.ConstructionCost = upgradeData.m_UpgradeCost;
				Fact(prefabIndex, "xpReward", upgradeData.m_XPReward);
			}
			else if (EntityManager.TryGetComponent<PlaceableNetData>(entity, out var netData))
			{
				// A network prices by length: m_DefaultConstructionCost is the sum of its
				// composition pieces for ONE cell, so it is converted to the per-kilometre
				// figure the game itself shows and flagged as a rate.
				prefabIndex.ConstructionCost = (uint)Math.Round(netData.m_DefaultConstructionCost * NetCellsPerKilometre);
				prefabIndex.Upkeep = (int)Math.Round(netData.m_DefaultUpkeepCost * NetCellsPerKilometre);
				prefabIndex.CostIsPerDistance = true;

				// Speed is per network TYPE rather than on a shared component, so each
				// is asked in turn and the first that answers wins. Each holds metres
				// per second; the catalog states km/h — see SpeedLimit.
				if (EntityManager.TryGetComponent<RoadData>(entity, out var roadData))
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(roadData.m_SpeedLimit);
				}
				else if (EntityManager.TryGetComponent<TrackData>(entity, out var trackData))
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(trackData.m_SpeedLimit);
				}
				else if (EntityManager.TryGetComponent<PathwayData>(entity, out var pathwayData))
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(pathwayData.m_SpeedLimit);
				}
				else if (EntityManager.TryGetComponent<WaterwayData>(entity, out var waterwayData))
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(waterwayData.m_SpeedLimit);
				}
				else if (EntityManager.TryGetComponent<TaxiwayData>(entity, out var taxiwayData))
				{
					prefabIndex.SpeedLimit = SpeedLimit.KilometresPerHour(taxiwayData.m_SpeedLimit);
				}

				if (EntityManager.TryGetComponent<NetGeometryData>(entity, out var geometryData)
					&& geometryData.m_DefaultWidth > 0f)
				{
					prefabIndex.NetworkWidth = geometryData.m_DefaultWidth;
				}

				if (EntityManager.TryGetComponent<NetGeometryData>(entity, out var elevatedGeometry)
					&& elevatedGeometry.m_ElevatedWidth > 0f
					&& Math.Abs(elevatedGeometry.m_ElevatedWidth - elevatedGeometry.m_DefaultWidth) > 0.01f)
				{
					// Only when it DIFFERS from the ground width. Stating both when
					// they are the same number is a line that says nothing.
					Fact(prefabIndex, "elevatedWidth", elevatedGeometry.m_ElevatedWidth);
				}

				if (netData.m_UndergroundPrefab != Entity.Null)
				{
					TextFact(prefabIndex, "roadFeature", "underground");
				}

				if (EntityManager.TryGetComponent<TrackData>(entity, out var trackKind)
					&& trackKind.m_TrackType != Game.Net.TrackTypes.None)
				{
					TextFact(prefabIndex, "trackType", trackKind.m_TrackType.ToString());
				}

				// Road class, traffic lights and zoning live on the AUTHORING prefab
				// rather than on a component, so they need the PrefabBase back. They are
				// three of the facts a player chooses a road by.
				if (_prefabSystem.TryGetPrefab<PrefabBase>(entity, out var netPrefab))
				{
					if (netPrefab is RoadPrefab roadPrefab)
					{
						if (roadPrefab.m_TrafficLights)
						{
							TextFact(prefabIndex, "roadFeature", "trafficLights");
						}
						if (roadPrefab.m_HighwayRules)
						{
							TextFact(prefabIndex, "roadFeature", "highwayRules");
						}
						if (roadPrefab.m_ZoneBlock is not null)
						{
							TextFact(prefabIndex, "roadFeature", "zonesAlongside");
						}
					}

					if (netPrefab.TryGet<PlaceableNetPiece>(out var netPiece) && netPiece.m_ElevationCost > 0)
					{
						Fact(prefabIndex, "elevationCost", netPiece.m_ElevationCost * NetCellsPerKilometre);
					}
				}
			}

			if (EntityManager.TryGetComponent<ConsumptionData>(entity, out var consumptionData))
			{
				prefabIndex.Upkeep = consumptionData.m_Upkeep;
				prefabIndex.ElectricityConsumption = consumptionData.m_ElectricityConsumption;
				prefabIndex.WaterConsumption = consumptionData.m_WaterConsumption;
				prefabIndex.GarbageAccumulation = consumptionData.m_GarbageAccumulation;
				prefabIndex.TelecomNeed = consumptionData.m_TelecomNeed;
			}

			// The upkeep buffer is the game's own answer, and for a city service
			// building the only place the money lives. Money entries are the upkeep;
			// every other resource is a fact of its own, in kilograms a month.
			if (EntityManager.TryGetBuffer<ServiceUpkeepData>(entity, true, out var upkeepBuffer) && upkeepBuffer.Length > 0)
			{
				var stacks = new List<(string Resource, int Amount)>(upkeepBuffer.Length);
				for (var i = 0; i < upkeepBuffer.Length; i++)
				{
					stacks.Add((upkeepBuffer[i].m_Upkeep.m_Resource.ToString(), upkeepBuffer[i].m_Upkeep.m_Amount));
				}

				var summary = ServiceUpkeepSummary.Summarise(prefabIndex.Upkeep ?? 0, stacks);
				if (summary.Money > 0)
				{
					prefabIndex.Upkeep = summary.Money;
				}
				foreach (var (resource, amount) in summary.Resources)
				{
					Fact(prefabIndex, ServiceUpkeepSummary.ResourceFactPrefix + resource, amount);
				}
			}

			if (EntityManager.TryGetComponent<WorkplaceData>(entity, out var workplaceData))
			{
				prefabIndex.Workers = workplaceData.m_MaxWorkers;
				// The rest of the staffing picture. MaxWorkers says how many; these
				// say how few it can run on and when they are there.
				Fact(prefabIndex, "minCrew", workplaceData.m_MinimumWorkersLimit);
				// 0-1 probabilities, not percentages: FindJobSystem rolls
				// `chance < m_EveningShiftProbability`. Shown as a percent, so scaled here.
				Fact(prefabIndex, "eveningShift", workplaceData.m_EveningShiftProbability * 100d);
				Fact(prefabIndex, "nightShift", workplaceData.m_NightShiftProbability * 100d);
				Fact(prefabIndex, "workConditions", workplaceData.m_WorkConditions);
				// Who the building employs. The game has no player-facing word for
				// WorkplaceComplexity — its CITIZEN_JOB_LEVEL vocabulary does not map
				// onto Manual/Simple/Complex/Hitech — so these are OUR words.
				TextFact(prefabIndex, "jobComplexity", workplaceData.m_Complexity.ToString());
			}

			// Zero is not a household count, it is "not residential": every service
			// building carries this component too. Left null so the card drops the
			// line rather than telling a fire station it houses nobody.
			if (EntityManager.TryGetComponent<BuildingPropertyData>(entity, out var propertyData)
				&& propertyData.m_ResidentialProperties > 0)
			{
				prefabIndex.Households = propertyData.m_ResidentialProperties;
			}

			if (EntityManager.TryGetComponent<PollutionData>(entity, out var pollutionData))
			{
				prefabIndex.GroundPollution = pollutionData.m_GroundPollution;
				prefabIndex.AirPollution = pollutionData.m_AirPollution;
				prefabIndex.NoisePollution = pollutionData.m_NoisePollution;
			}

			// Doubles: a telecom facility's capacity is gigabits a second with a
			// decimal, which an int would truncate.
			var capacities = new List<double>();
			// Doubles as the Role facet source: these are exactly the service
			// components that make a building a school, a hospital, and so on.
			var roles = new List<string>();
			if (EntityManager.TryGetComponent<SchoolData>(entity, out var schoolData))
			{
				roles.Add("School");
				capacities.Add(schoolData.m_StudentCapacity);
				Fact(prefabIndex, "studentWellbeing", schoolData.m_StudentWellbeing);
				Fact(prefabIndex, "studentHealth", schoolData.m_StudentHealth);
				// The tier the school grants, so nothing downstream has to guess it
				// from the building's name.
				prefabIndex.EducationLevel = schoolData.m_EducationLevel;
				Fact(prefabIndex, "graduation", schoolData.m_GraduationModifier);
			}

			// What a park gives the city: a park and a bowling alley are both
			// "ParksAndRecreation". The efficiency gate is vanilla's own —
			// LeisureProvider adds the component only when m_Efficiency > 0.
			if (EntityManager.TryGetComponent<LeisureProviderData>(entity, out var leisureData)
				&& leisureData.m_Efficiency > 0)
			{
				prefabIndex.LeisureType = leisureData.m_LeisureType.ToString();
				prefabIndex.LeisureEfficiency = leisureData.m_Efficiency;
			}

			if (EntityManager.TryGetComponent<HospitalData>(entity, out var hospitalData))
			{
				roles.Add("Hospital");
				capacities.Add(hospitalData.m_PatientCapacity);
				Fact(prefabIndex, "ambulances", hospitalData.m_AmbulanceCapacity);
				Fact(prefabIndex, "helicopters", hospitalData.m_MedicalHelicopterCapacity);
			}

			// A zone's own figures, carried as service facts rather than as new
			// columns: they are per-cell rates on ONE family of asset, which is the
			// same shape the per-service figures have.
			if (EntityManager.TryGetComponent<ZoneServiceConsumptionData>(entity, out var zoneConsumption))
			{
				// Only the upkeep: PropertyRenterSystem.GetUpkeep reads it as
				// level^exp × upkeep × lotSize. The electricity, water, garbage and
				// telecom coefficients beside it have no reader anywhere in the game.
				Fact(prefabIndex, "zoneUpkeep", zoneConsumption.m_Upkeep);
			}

			if (EntityManager.TryGetComponent<ZonePropertiesData>(entity, out var zoneProperties))
			{
				// Residential only; the other families report none rather than a zero
				// that would read as "no homes here". With ScaleResidentials the figure
				// is apartments per cell, without it a fixed count — hence two keys.
				Fact(prefabIndex, zoneProperties.m_ScaleResidentials ? "zoneHouseholdsPerCell" : "zoneHouseholds",
					zoneProperties.m_ResidentialProperties);
				Fact(prefabIndex, "zoneSpace", zoneProperties.m_SpaceMultiplier);
				// ×1 is the absence of a modifier, as with the pollution modifiers.
				if (zoneProperties.m_FireHazardMultiplier != 1f)
				{
					Fact(prefabIndex, "zoneFireHazard", zoneProperties.m_FireHazardMultiplier);
				}
				if (zoneProperties.m_IgnoreLandValue)
				{
					TextFact(prefabIndex, "zoneFeature", "ignoresLandValue");
				}
			}

			// The zone figures that are words rather than numbers.
			if (EntityManager.TryGetComponent<ZonePropertiesData>(entity, out var zoneResources))
			{
				TextFact(prefabIndex, "zoneSold", ResourceName(zoneResources.m_AllowedSold));
				TextFact(prefabIndex, "zoneManufactured", ResourceName(zoneResources.m_AllowedManufactured));
				TextFact(prefabIndex, "zoneStored", ResourceName(zoneResources.m_AllowedStored));
			}

			// The shapes the zone grows, for the glyphs the card already knows how
			// to draw. Computed once by IndexZones and cached, because it needs
			// every spawnable building's lot and this pass sees one prefab.
			if (prefabIndex.Category == Domain.Enums.PrefabCategory.Zones
				&& GetZoneLotSizes(entity) is ZoneLotSizes lots
				&& lots.Footprints is { Length: > 0 })
			{
				prefabIndex.Footprints = lots.Footprints;
				prefabIndex.FootprintOverflow = lots.FootprintOverflow;
			}

			if (EntityManager.TryGetComponent<ZoneData>(entity, out var zoneHeights))
			{
				// What the zone actually grows to, measured by the game from the
				// tallest mesh it can spawn and never shown by it.
				Fact(prefabIndex, "zoneMaxHeight", zoneHeights.m_MaxHeight);

				// Stated only when true: "does not support corners" is noise on
				// the majority of zones that do not.
				if ((zoneHeights.m_ZoneFlags & ZoneFlags.SupportNarrow) != 0)
				{
					TextFact(prefabIndex, "zoneLotShapes", "narrow");
				}

				if ((zoneHeights.m_ZoneFlags
					& (ZoneFlags.SupportLeftCorner | ZoneFlags.SupportRightCorner)) != 0)
				{
					TextFact(prefabIndex, "zoneLotShapes", "corners");
				}
			}

			// Tourism, and one of the few figures that matters across services
			// rather than inside one — a park, a landmark and a signature
			// building all trade on it.
			if (EntityManager.TryGetComponent<AttractionData>(entity, out var attractionData))
			{
				Fact(prefabIndex, "attractiveness", attractionData.m_Attractiveness);
			}

			if (EntityManager.TryGetComponent<CoverageData>(entity, out var coverageData)
				&& coverageData.m_Range > 0f)
			{
				prefabIndex.ServiceRange = coverageData.m_Range;
			}

			// The figure a mailbox is FOR, and the one vanilla reads for it:
			// Properties.MAIL_BOX_CAPACITY, an integer.
			if (EntityManager.TryGetComponent<MailBoxData>(entity, out var mailBox))
			{
				Fact(prefabIndex, "mailboxCapacity", mailBox.m_MailCapacity);
			}

			// RequiredResourceBinder's rule, transcribed: an extractor building whose
			// product needs a natural resource names the map feature of its extractor
			// area. The water half of that binder is already the waterSource fact.
			var requiredFeature = GetExtractorFeature(entity);
			if (requiredFeature is not null)
			{
				TextFact(prefabIndex, "requiredResource", requiredFeature);
			}

			if (EntityManager.TryGetComponent<PostFacilityData>(entity, out var postFacilityData))
			{
				roles.Add("PostFacility");
				// Mail held, not vans or sorting rate: the vans are how it works
				// and the rate is per unit time, while this is the size of the
				// thing — the same question capacity answers everywhere else.
				capacities.Add(postFacilityData.m_MailCapacity);
				Fact(prefabIndex, "postTrucks", postFacilityData.m_PostTruckCapacity);
				Fact(prefabIndex, "sortingRate", postFacilityData.m_SortingRate);
				Fact(prefabIndex, "postVans", postFacilityData.m_PostVanCapacity);
			}

			if (EntityManager.TryGetComponent<TelecomFacilityData>(entity, out var telecomFacilityData))
			{
				roles.Add("TelecomFacility");
				capacities.Add(telecomFacilityData.m_NetworkCapacity);
				// Telecom keeps its own range rather than using CoverageData's,
				// so it is read here and not above.
				if (telecomFacilityData.m_Range > 0f)
				{
					prefabIndex.ServiceRange = telecomFacilityData.m_Range;
				}
				if (telecomFacilityData.m_PenetrateTerrain)
				{
					TextFact(prefabIndex, "facilityFeature", "signalThroughTerrain");
				}
			}

			if (EntityManager.TryGetComponent<GarbageFacilityData>(entity, out var garbageFacilityData))
			{
				roles.Add("GarbageFacility");
				capacities.Add(garbageFacilityData.m_GarbageCapacity);
				// Its own key: kilograms a month, not the deathcare rate's bodies.
				Fact(prefabIndex, "garbageProcessing", garbageFacilityData.m_ProcessingSpeed);
				// m_VehicleCapacity, not m_TransportCapacity: the first is the garbage
				// trucks (GARBAGE_TRUCK_COUNT in vanilla's tooltip), the second the
				// delivery trucks that haul processed waste out.
				Fact(prefabIndex, "collectionTrucks", garbageFacilityData.m_VehicleCapacity);
				if (garbageFacilityData.m_IndustrialWasteOnly)
				{
					TextFact(prefabIndex, "facilityFeature", "industrialWasteOnly");
				}
			}

			if (EntityManager.TryGetComponent<FireStationData>(entity, out var fireStationData))
			{
				roles.Add("FireStation");
				capacities.Add(fireStationData.m_FireEngineCapacity);
				Fact(prefabIndex, "helicopters", fireStationData.m_FireHelicopterCapacity);
				Fact(prefabIndex, "disasterResponse", fireStationData.m_DisasterResponseCapacity);
			}

			if (EntityManager.TryGetComponent<PoliceStationData>(entity, out var policeStationData))
			{
				roles.Add("PoliceStation");
				capacities.Add(policeStationData.m_PatrolCarCapacity);
				Fact(prefabIndex, "jailCapacity", policeStationData.m_JailCapacity);
				Fact(prefabIndex, "helicopters", policeStationData.m_PoliceHelicopterCapacity);
			}

			if (EntityManager.TryGetComponent<PrisonData>(entity, out var prisonData))
			{
				roles.Add("Prison");
				capacities.Add(prisonData.m_PrisonerCapacity);
				Fact(prefabIndex, "prisonVans", prisonData.m_PrisonVanCapacity);
				Fact(prefabIndex, "prisonerWellbeing", prisonData.m_PrisonerWellbeing);
				Fact(prefabIndex, "prisonerHealth", prisonData.m_PrisonerHealth);
			}

			if (EntityManager.TryGetComponent<DeathcareFacilityData>(entity, out var deathcareFacilityData))
			{
				roles.Add("DeathcareFacility");
				capacities.Add(deathcareFacilityData.m_StorageCapacity);
				Fact(prefabIndex, "hearses", deathcareFacilityData.m_HearseCapacity);
				Fact(prefabIndex, "processingRate", deathcareFacilityData.m_ProcessingRate);
				if (deathcareFacilityData.m_LongTermStorage)
				{
					TextFact(prefabIndex, "facilityFeature", "longTermStorage");
				}
			}

			if (EntityManager.TryGetComponent<EmergencyShelterData>(entity, out var emergencyShelterData))
			{
				roles.Add("EmergencyShelter");
				capacities.Add(emergencyShelterData.m_ShelterCapacity);
				Fact(prefabIndex, "shelterVehicles", emergencyShelterData.m_VehicleCapacity);
			}

			if (EntityManager.TryGetComponent<WaterPumpingStationData>(entity, out var waterPumpingStationData))
			{
				roles.Add("WaterPumpingStation");
				prefabIndex.WaterCapacity = waterPumpingStationData.m_Capacity;
				capacities.Add(waterPumpingStationData.m_Capacity);
				Fact(prefabIndex, "purification", Percent.FromFraction(waterPumpingStationData.m_Purification));
				// Vanilla's wording and vanilla's silence: a tower allows no type
				// and says nothing, where the raw enum read "Draws from None".
				TextFact(prefabIndex, "waterSource", Domain.WaterSource.Describe(
					(waterPumpingStationData.m_Types & AllowedWaterTypes.Groundwater) != 0,
					(waterPumpingStationData.m_Types & AllowedWaterTypes.SurfaceWater) != 0));
			}

			if (EntityManager.TryGetComponent<SewageOutletData>(entity, out var sewageOutletData))
			{
				roles.Add("SewageOutlet");
				prefabIndex.SewageCapacity = sewageOutletData.m_Capacity;
				capacities.Add(sewageOutletData.m_Capacity);
				Fact(prefabIndex, "purification", Percent.FromFraction(sewageOutletData.m_Purification));
			}

			// Power plants report output as production rather than capacity, so
			// without this a coal plant has no capacity to forecast the city's
			// demand against. Solar is a separate component with its own field.
			if (EntityManager.TryGetComponent<PowerPlantData>(entity, out var powerPlantData))
			{
				roles.Add("PowerPlant");
				capacities.Add(powerPlantData.m_ElectricityProduction);
			}

			if (EntityManager.TryGetComponent<SolarPoweredData>(entity, out var solarData))
			{
				roles.Add("PowerPlant");
				capacities.Add(solarData.m_Production);
			}

			// Wind is a third component again, with its own production field.
			if (EntityManager.TryGetComponent<WindPoweredData>(entity, out var windData))
			{
				roles.Add("PowerPlant");
				capacities.Add(windData.m_Production);
			}

			// Each of these is the figure its building is FOR.
			if (EntityManager.TryGetComponent<BatteryData>(entity, out var batteryData))
			{
				roles.Add("Battery");
				capacities.Add(batteryData.m_Capacity);
				Fact(prefabIndex, "batteryOutput", batteryData.m_PowerOutput);
			}

			if (EntityManager.TryGetComponent<ParkData>(entity, out var parkData))
			{
				Fact(prefabIndex, "maintenancePool", parkData.m_MaintenancePool);
			}

			if (EntityManager.TryGetComponent<TransportDepotData>(entity, out var transportDepotData))
			{
				TextFact(prefabIndex, "transportType", transportDepotData.m_TransportType.ToString());
				Fact(prefabIndex, "depotVehicles", transportDepotData.m_VehicleCapacity);
			}

			if (EntityManager.TryGetComponent<MaintenanceDepotData>(entity, out var maintenanceDepotData))
			{
				Fact(prefabIndex, "maintenanceVehicles", maintenanceDepotData.m_VehicleCapacity);
			}

			// The two properties vanilla authors only on service upgrades. Both are
			// read exactly as PrefabUISystem binds them: multipliers as whole
			// percentages, the upkeep change as the largest multiplier minus one.
			if (EntityManager.TryGetComponent<PollutionModifierData>(entity, out var pollutionModifier))
			{
				// A multiplier of one changes nothing and "100 %" would say so at
				// length; only the factors that move a level are facts.
				PollutionModifierFact(prefabIndex, "groundPollutionModifier", pollutionModifier.m_GroundPollutionMultiplier);
				PollutionModifierFact(prefabIndex, "airPollutionModifier", pollutionModifier.m_AirPollutionMultiplier);
				PollutionModifierFact(prefabIndex, "noisePollutionModifier", pollutionModifier.m_NoisePollutionMultiplier);
			}

			if (EntityManager.TryGetBuffer<UpkeepModifierData>(entity, true, out var upkeepModifiers) && upkeepModifiers.Length > 0)
			{
				var largest = 1f;
				var changes = false;

				for (var i = 0; i < upkeepModifiers.Length; i++)
				{
					if (upkeepModifiers[i].m_Multiplier != 1f)
					{
						changes = true;
						largest = Math.Max(largest, upkeepModifiers[i].m_Multiplier);
					}
				}

				if (changes)
				{
					// Not through Fact: that helper drops anything at or below zero,
					// and a saving — the usual case for this modifier — is negative.
					prefabIndex.ServiceFacts.Add(new Domain.ServiceFact("upkeepChange", Math.Round(100d * (largest - 1d))));
				}
			}

			if (EntityManager.TryGetComponent<TransportStationData>(entity, out var transportStationData))
			{
				Fact(prefabIndex, "comfort", Percent.FromFraction(transportStationData.m_ComfortFactor));
			}

			// What vanilla's tooltip calls Cargo capacity: StorageLimitData on a
			// cargo station, and on the warehouse upgrade that adds to it.
			// Kilograms; the UI follows the game's own weight rule.
			if (EntityManager.TryGetComponent<StorageLimitData>(entity, out var storageLimit)
				&& storageLimit.m_Limit > 0)
			{
				Fact(prefabIndex, "cargoCapacity", storageLimit.m_Limit);
			}

			if (EntityManager.TryGetComponent<ElectricityConnectionData>(entity, out var electricityConnection)
				&& electricityConnection.m_Capacity > 0
				&& !EntityManager.HasComponent<RoadData>(entity))
			{
				Fact(prefabIndex, "electricityCapacity", electricityConnection.m_Capacity);
				TextFact(prefabIndex, "voltage", electricityConnection.m_Voltage.ToString());
			}

			if (EntityManager.TryGetComponent<WaterPipeConnectionData>(entity, out var pipeConnection)
				&& pipeConnection.m_StormCapacity > 0)
			{
				Fact(prefabIndex, "stormCapacity", pipeConnection.m_StormCapacity);
			}

			if (EntityManager.TryGetComponent<WastewaterTreatmentPlantData>(entity, out var wastewaterData))
			{
				roles.Add("WastewaterTreatmentPlant");
				prefabIndex.SewageCapacity = wastewaterData.m_Capacity;
				capacities.Add(wastewaterData.m_Capacity);
			}

			prefabIndex.BuildingTypeName = BuildingRole.ResolvePrimary(roles);

			if (capacities.Count > 0)
			{
				prefabIndex.Capacity = capacities.Max();
			}
		}

		private bool CheckIfResourceIntensive(PrefabBase prefab)
		{
			if (prefab is not ObjectGeometryPrefab geometryPrefab || geometryPrefab.m_Meshes is null || prefab.Has<TreeObject>() || prefab.isBuiltin)
			{
				return false;
			}

			return geometryPrefab.m_Meshes.Any(mesh =>
			{
				if (mesh.m_Mesh is not RenderPrefab meshPrefab)
				{
					return false;
				}

				var vertexCount = Math.Floor(meshPrefab.vertexCount / 3000D);
				var lodCount = meshPrefab.TryGet<LodProperties>(out var lodProperties) ? lodProperties.m_LodMeshes.Length : 0;

				if (vertexCount <= 4)
				{
					return false;
				}

				if (vertexCount <= 15)
				{
					return lodCount < 1;
				}

				return lodCount < 2;
			});
		}

		/// <summary>Names every milestone once, so locked assets can carry a bare index.</summary>
		/// <remarks>Resolved here because the modding API's translate(id, fallback) takes no arguments
		/// and the game's milestone name is a lookup parameterised by index.</remarks>
		private void IndexMilestones()
		{
			var query = GetEntityQuery(
				ComponentType.ReadOnly<MilestoneData>(),
				ComponentType.ReadOnly<PrefabData>());
			var milestones = query.ToEntityArray(Allocator.Temp);
			var names = new Dictionary<int, string>();
			var images = new Dictionary<int, string>();

			for (var i = 0; i < milestones.Length; i++)
			{
				if (EntityManager.TryGetComponent<MilestoneData>(milestones[i], out var data)
					&& _prefabSystem.TryGetPrefab<PrefabBase>(milestones[i], out var prefab))
				{
					names[data.m_Index] = GetMilestoneTitle(data.m_Index) ?? GetAssetName(prefab);
					// The progression screen's own image, so a tier tab carries
					// the badge the player earned that milestone under.
					images[data.m_Index] = prefab is MilestonePrefab milestone
						? IconPath.Normalize(milestone.m_Image) ?? string.Empty
						: string.Empty;
				}
			}

			_milestoneNames = names;
			_milestoneIcons = images;
			Mod.Log.Info($"Indexed Milestones: {names.Count}");
		}

		/// <summary>The milestone's name in the game's own words, or null.</summary>
		/// <remarks>The key is parameterised by index, so translate(id, fallback) cannot reach it, and
		/// GetAssetName falls through to the prefab name — literally "Milestone7".</remarks>
		private static string? GetMilestoneTitle(int index) =>
			GameManager.instance.localizationManager.activeDictionary
				.TryGetValue($"Progression.MILESTONE_NAME:{index}", out var name)
					? name
					: null;

		/// <summary>Dev-tree nodes drawn under another node's tab.</summary>
		/// <remarks>A narrow exception to the rule that a node is its own branch, keyed on the prefab
		/// name rather than the localized label. See docs/indexing.md, "Dev tree branches".</remarks>
		private static readonly Dictionary<string, string> FoldedDevTreeNodes = new(StringComparer.Ordinal)
		{
			// DEV TREE NODE prefab names, not the asset names the locale carries.
			// A key that matches nothing warns rather than passing silently.
			["InternationalAirportNode"] = "AirportNode",
			["SpaceCenterNode"] = "AirportNode",
		};

		/// <summary>Maps every development-tree node to the label assets it gates are filed under.</summary>
		/// <remarks>The node ITSELF, ranked by the tree's own layout, with the free root taking the
		/// service's name. See docs/indexing.md, "Dev tree branches".</remarks>
		private void IndexDevTreeBranches()
		{
			var query = GetEntityQuery(
				ComponentType.ReadOnly<DevTreeNodeData>(),
				ComponentType.ReadOnly<PrefabData>());
			var nodes = query.ToEntityArray(Allocator.Temp);
			var branches = new Dictionary<Entity, (string Label, string Icon, int Depth)>();
			var roots = new Dictionary<string, (string Label, string Icon, int Depth)>();
			// Prefab name to node, so FoldedDevTreeNodes can be resolved once the
			// whole tree is known — a fold's target may be indexed after it.
			var nodesByName = new Dictionary<string, Entity>(StringComparer.Ordinal);

			// Ranked per service by the tree's OWN LAYOUT — column first, then
			// distance from the trunk row. The game lays its siblings out in a
			// deliberate order; any other tie-break invents one.
			var ranked = new Dictionary<Entity, int>();

			foreach (var service in nodes
				.Where(node => EntityManager.HasComponent<DevTreeNodeData>(node))
				.GroupBy(node => EntityManager.GetComponentData<DevTreeNodeData>(node).m_Service))
			{
				var placed = service
					.Select(node => (Node: node, Prefab: _prefabSystem.TryGetPrefab<PrefabBase>(node, out var pf) ? pf as DevTreeNodePrefab : null))
					.Where(pair => pair.Prefab is not null)
					.ToArray();

				// The row the service's chain runs along, taken from its root.
				// NOT zero: education's trunk sits at 1, with Technical above at
				// 0 and Medical below at 2.
				var trunk = placed
					.Where(pair => pair.Prefab!.m_HorizontalPosition == 0)
					.Select(pair => pair.Prefab!.m_VerticalPosition)
					.DefaultIfEmpty(0f)
					.First();

				var ordered = placed
					.OrderBy(pair => pair.Prefab!.m_HorizontalPosition)
					// Then by distance from that trunk. Siblings in a column are drawn
					// around the chain they hang off, so measuring outward takes the
					// generic before its specialisations.
					.ThenBy(pair => Math.Abs(pair.Prefab!.m_VerticalPosition - trunk))
					.ThenBy(pair => pair.Prefab!.m_VerticalPosition)
					.ToArray();

				for (var r = 0; r < ordered.Length; r++)
				{
					ranked[ordered[r].Node] = r;
				}
			}

			for (var i = 0; i < nodes.Length; i++)
			{
				var node = nodes[i];

				if (!_prefabSystem.TryGetPrefab<PrefabBase>(node, out var prefab))
				{
					continue;
				}

				var isRoot = !EntityManager.TryGetBuffer<DevTreeNodeRequirement>(node, true, out var reqs)
					|| reqs.Length == 0;
				var depth = ranked.TryGetValue(node, out var rank) ? rank : 0;

				// The node ITSELF, not the chain it hangs off: collapsing a chain to
				// the branch below the root files the Central Intelligence Bureau under
				// "Police Headquarters", a separate unlock the player buys separately.
				var rootLabel = isRoot ? RootBranchLabel(node) : string.Empty;

				branches[node] = isRoot
					? (rootLabel, DevTreeIcon(prefab), 0)
					: (DevTreeBranchName(prefab), DevTreeIcon(prefab), depth);

				nodesByName[prefab.name] = node;

				// The root also names the bucket for everything the tree never
				// gated, so it is recorded against its service.
				if (isRoot
					&& EntityManager.TryGetComponent<DevTreeNodeData>(node, out var rootData)
					&& _prefabSystem.TryGetPrefab<PrefabBase>(rootData.m_Service, out var rootService))
				{
					roots[rootService.name] = (rootLabel, DevTreeIcon(prefab), 0);
				}
			}

			// Applied after the walk: an asset gated by a folded node now reports
			// the target's branch, so it lands in that tab with the target's
			// label, icon and rank rather than opening one of its own.
			var folded = 0;

			foreach (var fold in FoldedDevTreeNodes)
			{
				if (nodesByName.TryGetValue(fold.Key, out var from)
					&& nodesByName.TryGetValue(fold.Value, out var into)
					&& branches.TryGetValue(into, out var target)
					&& target.Label.Length > 0)
				{
					branches[from] = target;
					folded++;
				}
				else
				{
					// A fold that matches nothing is a typo, not a no-op, and nothing in
					// the build or the tests can catch it.
					Mod.Log.Warn(
						$"[DEVTREE] fold '{fold.Key}' -> '{fold.Value}' matched no node; "
						+ "the key is a dev tree NODE prefab name, not an asset name");
				}
			}

			_devTreeBranches = branches;
			_devTreeRoots = roots;
			Mod.Log.Info($"Indexed Dev Tree: {nodes.Length} nodes, {roots.Count} services, {folded} folded");
		}

		/// <summary>The node's icon, resolved the way the game's own dev tree resolves it.</summary>
		/// <remarks>DevTreeUISystem.GetDevTreeIcon, transcribed: an explicit m_IconPath wins, else the
		/// thumbnail of the prefab the node points at, else empty rather than a placeholder glyph.</remarks>
		private string DevTreeIcon(PrefabBase prefab)
		{
			if (prefab is not DevTreeNodePrefab node)
			{
				return string.Empty;
			}

			if (!string.IsNullOrEmpty(node.m_IconPath))
			{
				return IconPath.Normalize(node.m_IconPath) ?? string.Empty;
			}

			return node.m_IconPrefab is not null
				? IconPath.Normalize(ImageSystem.GetThumbnail(node.m_IconPrefab)) ?? string.Empty
				: string.Empty;
		}

		/// <summary>Every milestone image, dense by index.</summary>
		/// <remarks>Same shape and the same reason as GetMilestoneNames.</remarks>
		public static string[] GetMilestoneIcons()
		{
			if (_milestoneIcons.Count == 0)
			{
				return Array.Empty<string>();
			}

			var highest = 0;
			foreach (var index in _milestoneIcons.Keys)
			{
				if (index > highest)
				{
					highest = index;
				}
			}

			var icons = new string[highest + 1];
			for (var i = 0; i <= highest; i++)
			{
				icons[i] = _milestoneIcons.TryGetValue(i, out var icon) ? icon : string.Empty;
			}

			return icons;
		}

		/// <summary>What the service's free root node is called.</summary>
		/// <remarks>The SERVICE's name, because that is what the top bar already calls this bucket. The
		/// node itself has no localized title and would fall through to its prefab name.</remarks>
		private string RootBranchLabel(Entity node)
		{
			if (EntityManager.TryGetComponent<DevTreeNodeData>(node, out var data)
				&& _prefabSystem.TryGetPrefab<PrefabBase>(data.m_Service, out var service))
			{
				var name = GetAssetName(service);

				if (!string.IsNullOrEmpty(name))
				{
					return name;
				}
			}

			return "Basic";
		}

		/// <summary>The node's name, without the "Node" the prefab titles all carry.</summary>
		/// <remarks>An authoring artefact the player never sees in the dev tree, which draws the node
		/// under its icon, so it is dropped rather than repeated across every tab of the strip.</remarks>
		private string DevTreeBranchName(PrefabBase prefab)
		{
			var name = GetAssetName(prefab);

			return name.EndsWith(" Node", StringComparison.Ordinal)
				? name.Substring(0, name.Length - " Node".Length)
				: name;
		}

		/// <summary>The label the tree's root carries for a menu, or empty.</summary>
		/// <remarks>A sentinel more than a name: the adapter replaces it with what the MENU calls that
		/// bucket, which needs the whole set of ungated assets. See ProjectForMenu.</remarks>
		public static string GetDevTreeRootLabel(string? menu) =>
			menu is not null && _devTreeRoots.TryGetValue(menu, out var root) ? root.Label : string.Empty;

		/// <summary>The branch an asset's unlock node belongs to, or empty.</summary>
		private (string Label, string Icon, int Depth) GetDevTreeBranch(Entity entity, string? menu)
		{
			if (EntityManager.HasComponent<UnlockRequirement>(entity))
			{
				var required = new NativeParallelHashMap<Entity, UnlockFlags>(10, Allocator.TempJob);

				try
				{
					ProgressionUtils.CollectSubRequirements(EntityManager, entity, required);

					foreach (var item in required)
					{
						if (_devTreeBranches.TryGetValue(item.Key, out var branch) && branch.Label.Length > 0)
						{
							return branch;
						}
					}
				}
				finally
				{
					required.Dispose();
				}
			}

			// No node gated it, so it belongs to the service's free root — the same
			// bucket the game puts the starting kit in. Named after the root node
			// rather than "Other": it is a real place in the tree.
			return menu is not null && _devTreeRoots.TryGetValue(menu, out var root)
				? root
				: (string.Empty, string.Empty, 0);
		}

		/// <summary>The name the game gives a milestone index.</summary>
		public static string GetMilestoneName(int index) =>
			_milestoneNames.TryGetValue(index, out var name) ? name : string.Empty;

		/// <summary>Every milestone name, dense by index.</summary>
		/// <remarks>Sized from the highest index present rather than probed from 0, which the game's
		/// first milestone need not use. Gaps stay empty so every later name keeps its own index.</remarks>
		public static string[] GetMilestoneNames()
		{
			if (_milestoneNames.Count == 0)
			{
				return Array.Empty<string>();
			}

			var highest = 0;
			foreach (var index in _milestoneNames.Keys)
			{
				if (index > highest)
				{
					highest = index;
				}
			}

			var names = new string[highest + 1];
			for (var i = 0; i <= highest; i++)
			{
				names[i] = GetMilestoneName(i);
			}

			return names;
		}

		/// <summary>What the game still wants before this asset can be built.</summary>
		/// <remarks>Mirrors PrefabUISystem.GetRequirements: collect the transitive requirements, take the
		/// highest milestone, and let everything else contribute its own localized title.</remarks>
		private (int Milestone, string[] Requirements) GetUnlockRequirements(Entity entity)
		{
			if (!EntityManager.HasComponent<UnlockRequirement>(entity))
			{
				return (0, Array.Empty<string>());
			}

			var required = new NativeParallelHashMap<Entity, UnlockFlags>(10, Allocator.TempJob);

			try
			{
				ProgressionUtils.CollectSubRequirements(EntityManager, entity, required);

				var milestone = 0;
				var requirements = new List<string>();

				foreach (var item in required)
				{
					// RequireAll, matching ProgressionUtils.GetRequiredMilestone:
					// a milestone reachable through a RequireAny branch is one of
					// several ways in, so it is not "the" milestone.
					if (EntityManager.TryGetComponent<MilestoneData>(item.Key, out var milestoneData))
					{
						if ((item.Value & UnlockFlags.RequireAll) != 0 && milestoneData.m_Index > milestone)
						{
							milestone = milestoneData.m_Index;
						}

						continue;
					}

					// Tutorials are not a requirement the player can act on, and their
					// titles are internal. Vanilla special-cases them too:
					// BindUnlockRequirement tests m_TutorialRequirementEntity first.
					if (!_prefabSystem.TryGetPrefab<PrefabBase>(item.Key, out var requirementPrefab)
						|| requirementPrefab is TutorialPrefab
						|| requirementPrefab is TutorialListPrefab
						|| requirementPrefab is TutorialBalloonPrefab)
					{
						continue;
					}

					var described = DescribeRequirement(item.Key, requirementPrefab);

					if (!string.IsNullOrEmpty(described))
					{
						requirements.Add(described);
					}
				}

				return (milestone, requirements.Distinct().ToArray());
			}
			finally
			{
				required.Dispose();
			}
		}

		/// <summary>What this building does for the city, phrased for a hover card.</summary>
		/// <remarks>Both buffers the game applies, with vanilla's own arithmetic in
		/// ModifierUIUtils.GetModifierDelta. m_Range.max is the figure vanilla binds.</remarks>
		private string[] GetBonuses(Entity entity)
		{
			var bonuses = new List<string>();

			if (EntityManager.TryGetBuffer<CityModifierData>(entity, true, out var cityModifiers))
			{
				for (var i = 0; i < cityModifiers.Length; i++)
				{
					var modifier = cityModifiers[i];

					// Vanilla hides this one from its own effect list, so a card
					// that showed it would be inventing an effect the game does
					// not acknowledge.
					if (modifier.m_Type == CityModifierType.CriminalMonitorProbability)
					{
						continue;
					}

					bonuses.Add(DescribeModifier(
						modifier.m_Type.ToString(),
						modifier.m_Mode,
						modifier.m_Range.max));
				}
			}

			if (EntityManager.TryGetBuffer<LocalModifierData>(entity, true, out var localModifiers))
			{
				for (var i = 0; i < localModifiers.Length; i++)
				{
					var modifier = localModifiers[i];

					bonuses.Add(DescribeModifier(
						modifier.m_Type.ToString(),
						modifier.m_Mode,
						modifier.m_Delta.max));
				}
			}

			return bonuses.Where(b => !string.IsNullOrEmpty(b)).Distinct().ToArray();
		}

		/// <summary>The map feature an extractor building requires, or null when it is not one.
		/// PrefabUISystem.RequiredResourceBinder.GetExtractorType, transcribed: an upgrade defers to its
		/// building, whose manufactured resource must itself require a natural resource.</summary>
		private string GetExtractorFeature(Entity entity)
		{
			var building = entity;
			if (EntityManager.TryGetBuffer<ServiceUpgradeBuilding>(entity, true, out var upgradeOf) && upgradeOf.Length >= 1)
			{
				building = upgradeOf[0].m_Building;
			}

			if (!EntityManager.TryGetComponent<PlaceholderBuildingData>(building, out var placeholder)
				|| placeholder.m_Type != BuildingType.ExtractorBuilding
				|| !EntityManager.TryGetComponent<BuildingPropertyData>(building, out var property)
				|| !EntityManager.TryGetBuffer<Game.Prefabs.SubArea>(entity, true, out var subAreas))
			{
				return null;
			}

			var resourcePrefab = _resourceSystem.GetPrefabs()[property.m_AllowedManufactured];
			if (!EntityManager.TryGetComponent<ResourceData>(resourcePrefab, out var resource) || !resource.m_RequireNaturalResource)
			{
				return null;
			}

			for (var i = 0; i < subAreas.Length; i++)
			{
				if (EntityManager.TryGetComponent<ExtractorAreaData>(subAreas[i].m_Prefab, out var extractor) && extractor.m_RequireNaturalResource)
				{
					return extractor.m_MapFeature.ToString();
				}
			}

			return null;
		}

		/// <summary>One effect, signed, with the unit its mode implies.</summary>
		private static string DescribeModifier(string type, ModifierValueMode mode, float value)
		{
			// ModifierUIUtils.GetModifierDelta, transcribed: a relative mode is a
			// fraction and reads as a percentage; absolute is already the number.
			var scaled = mode switch
			{
				ModifierValueMode.Relative => 100f * value,
				ModifierValueMode.InverseRelative => 100f * (1f / Math.Max(0.001f, 1f + value) - 1f),
				_ => value,
			};

			if (Math.Abs(scaled) < 0.005f)
			{
				return string.Empty;
			}

			var unit = mode == ModifierValueMode.Absolute ? string.Empty : "%";
			// The sign is the point — a modifier can make something worse, and an
			// unsigned number would read as a benefit either way.
			var sign = scaled > 0 ? "+" : string.Empty;

			return $"{type.FormatWords()} {sign}{scaled:0.##}{unit}";
		}

		/// <summary>Says what a requirement actually asks of the player.</summary>
		/// <remarks>Composed from each requirement's own data, the way vanilla does it in PrefabUISystem,
		/// because the strings do not exist as data: requirement prefabs carry no localized title.</remarks>
		private string DescribeRequirement(Entity entity, PrefabBase prefab)
		{
			if (EntityManager.TryGetComponent<CitizenRequirementData>(entity, out var citizens))
			{
				if (citizens.m_MinimumPopulation > 0)
				{
					return Format("Requirement.POPULATION", "{0} population", citizens.m_MinimumPopulation.ToString("N0"));
				}

				return citizens.m_MinimumHappiness > 0
					? Format("Requirement.HAPPINESS", "{0} happiness", citizens.m_MinimumHappiness.ToString())
					: string.Empty;
			}

			if (EntityManager.TryGetComponent<ProcessingRequirementData>(entity, out var processing))
			{
				return Format(
					"Requirement.PROCESSING",
					"produce {0} {1}",
					processing.m_MinimumProducedAmount.ToString("N0"),
					processing.m_ResourceType.ToString());
			}

			if (EntityManager.TryGetComponent<ZoneBuiltRequirementData>(entity, out var zone))
			{
				var zoneName = _prefabSystem.TryGetPrefab<PrefabBase>(zone.m_RequiredZone, out var zonePrefab)
					? GetAssetName(zonePrefab)
					: string.Empty;

				// Squares and count are alternative measures of the same demand;
				// the game sets whichever it means, so report the one it set.
				if (zone.m_MinimumSquares > 0)
				{
					return Format("Requirement.ZONE_SQUARES", "{0} squares of {1}", zone.m_MinimumSquares.ToString("N0"), zoneName);
				}

				return zone.m_MinimumCount > 0
					? Format("Requirement.ZONE_COUNT", "{0} × {1}", zone.m_MinimumCount.ToString("N0"), zoneName)
					: zoneName;
			}

			// Only the STRICT variant names the object it wants. Plain
			// ObjectBuiltRequirementPrefab carries a count and no reference of any
			// kind, so it could only ever say "build 1" — worse than silence.
			if (prefab is StrictObjectBuiltRequirementPrefab strict && strict.m_Requirement is not null)
			{
				return Format(
					"Requirement.OBJECTS_BUILT",
					"build {0} × {1}",
					strict.m_MinimumCount.ToString("N0"),
					GetAssetName(strict.m_Requirement));
			}

			// The subject is authored text rather than a reference: every
			// requirement prefab carries m_LabelID and vanilla binds it. Asked after
			// the formatters that compose better, before the count-only branch.
			var authored = UnlockRequirementLabel.Resolve(
				(prefab as UnlockRequirementPrefab)?.m_LabelID,
				key => GameManager.instance.localizationManager.activeDictionary.TryGetValue(key, out var text) ? text : null);

			if (authored.Length > 0)
			{
				return authored;
			}

			if (EntityManager.TryGetComponent<ObjectBuiltRequirementData>(entity, out var objectBuilt))
			{
				// The prefab names what to build even though it references nothing:
				// "Subway Yard Built Req", "Bus Depot Built Req". These carry an empty
				// m_LabelID, so the name is the only subject there is.
				var subject = ObjectBuiltRequirement.SubjectOf(prefab.name);

				if (subject.Length == 0)
				{
					// A name that was only bookkeeping. Silence beats a subjectless
					// "build 1".
					return string.Empty;
				}

				return objectBuilt.m_MinimumCount > 1
					? Format("Requirement.OBJECTS_BUILT", "build {0} × {1}", objectBuilt.m_MinimumCount.ToString("N0"), subject)
					: Format("Requirement.OBJECT_BUILT", "build a {0}", subject);
			}

			// A dev tree node's own name is near-redundant beside the building it
			// unlocks. What the player cannot see from the card is where to go and
			// what it costs, so say that instead.
			if (prefab is DevTreeNodePrefab node)
			{
				var service = node.m_Service is not null ? GetAssetName(node.m_Service) : string.Empty;

				return node.m_Cost > 0
					? Format("Requirement.DEV_TREE_COST", "{0} tech, {1} pts", service, node.m_Cost.ToString())
					: Format("Requirement.DEV_TREE", "{0} tech", service);
			}

			return GetAssetName(prefab);
		}

		/// <summary>
		/// Localized requirement phrasing, falling back to the English shape.
		/// </summary>
		private static string Format(string key, string fallback, params string[] args)
		{
			var template = GameManager.instance.localizationManager.activeDictionary.TryGetValue(key, out var localized)
				? localized
				: fallback;

			for (var i = 0; i < args.Length; i++)
			{
				template = template.Replace("{" + i + "}", args[i]);
			}

			return template.Trim();
		}

		/// <summary>Records one service figure, dropping the zeros.</summary>
		/// <remarks>A zero means "this building has none of that", and a card that has already dropped
		/// every field that does not apply has no use for the line.</remarks>
		private static void Fact(PrefabIndex prefabIndex, string key, double value)
		{
			if (value > 0d)
			{
				prefabIndex.ServiceFacts.Add(new Domain.ServiceFact(key, value));
			}
		}

		/// <summary>A pollution multiplier as the whole percentage vanilla shows, unless it is one.</summary>
		private static void PollutionModifierFact(PrefabIndex prefabIndex, string key, float multiplier)
		{
			if (Math.Abs(multiplier - 1f) > 0.0005f)
			{
				Fact(prefabIndex, key, Math.Round(multiplier * 100d));
			}
		}

		/// <summary>Records one worded figure, dropping the blanks.</summary>
		private static void TextFact(PrefabIndex prefabIndex, string key, string? value)
		{
			if (!string.IsNullOrWhiteSpace(value))
			{
				prefabIndex.ServiceTextFacts.Add(new Domain.ServiceTextFact(key, value!.Trim()));
			}
		}

		private string GetAssetName(PrefabBase prefab)
		{
			_prefabUISystem.GetTitleAndDescription(_prefabSystem.GetEntity(prefab), out var titleId, out var _);

			return GameManager.instance.localizationManager.activeDictionary.TryGetValue(titleId, out var name)
				? name
				: prefab.name.Replace('_', ' ').FormatWords();
		}

		private async void FillPdxModsData()
		{
			foreach (var grp in BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].Where(x => int.TryParse(x.PdxModsId, out var id) && id > 0).GroupBy(x => x.PdxModsId))
			{
				var details = await PdxModsUtil.GetLocalModDetails(grp.Key);

				if (details?.Success == true)
				{
					var folder = details.Mod.LocalData?.FolderAbsolutePath ?? string.Empty;
					var installDate = Directory.Exists(folder) ? Directory.GetCreationTime(folder) : (DateTime?)null;

					foreach (var item in grp)
					{
						item.InstalledDate = installDate;
						item.UpdatedDate = details.Mod.UpdatedDate;
					}
				}
			}
		}

		private static void AddNumberToDuplicatePrefabNames()
		{
			// Upgrades are left out of the numbering. Every school type has an
			// "Extension Wing"; they are never listed beside each other, only on
			// their own parent's picker, where "Extension Wing 2" has no referent.
			foreach (var grp in BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any]
				.Where(x => !x.IsServiceUpgrade)
				.GroupBy(x => x.Name))
			{
				var count = grp.Count();

				if (count == 1)
				{
					continue;
				}

				var format = new string('0', count.ToString().Length);
				var index = 1;

				foreach (var prefab in grp)
				{
					prefab.Name = $"{prefab.Name} {index++.ToString(format)}";
				}
			}
		}

		private void CleanupBrandPrefabs()
		{
			var brands = new HashSet<string>(BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Props][PrefabSubCategory.Props_Branding].Select(x => x.PrefabName));

			foreach (var category in BuildingMenuUtil.CategorizedPrefabs.Keys)
			{
				if (category is PrefabCategory.Any)
				{
					continue;
				}

				foreach (var subCategory in BuildingMenuUtil.CategorizedPrefabs[category].Keys)
				{
					if (subCategory is PrefabSubCategory.Props_Branding || (category is PrefabCategory.Props && subCategory is PrefabSubCategory.Any))
					{
						continue;
					}

					foreach (var item in BuildingMenuUtil.CategorizedPrefabs[category][subCategory].ToList())
					{
						if (brands.Contains(item.PrefabName))
						{
							BuildingMenuUtil.CategorizedPrefabs[category][subCategory].Remove(item);

							Mod.Log.Debug($"Removed {item.PrefabName} from {subCategory}");
						}
					}
				}
			}
		}

		private void AddAllCategories()
		{
			foreach (PrefabCategory category in Enum.GetValues(typeof(PrefabCategory)))
			{
				BuildingMenuUtil.CategorizedPrefabs[category] = new()
				{
					{ PrefabSubCategory.Any, new() }
				};

				if (category == PrefabCategory.Any)
				{
					continue;
				}

				foreach (PrefabSubCategory subCategory in Enum.GetValues(typeof(PrefabSubCategory)))
				{
					if ((int)subCategory > (int)category && (int)subCategory < (int)category + 100)
					{
						BuildingMenuUtil.CategorizedPrefabs[category][subCategory] = new();
					}
				}
			}
		}

		/// <summary>Caches the vanilla toolbar's asset menus by entity index, so a menu selection
		/// arriving from the UI can be resolved to a prefab name.</summary>
		private void IndexAssetMenus()
		{
			var query = GetEntityQuery(
				ComponentType.ReadOnly<UIAssetMenuData>(),
				ComponentType.ReadOnly<PrefabData>());
			var menus = query.ToEntityArray(Allocator.Temp);
			var names = new Dictionary<int, string>();
			var entities = new Dictionary<string, Entity>(System.StringComparer.OrdinalIgnoreCase);
			var list = new List<VanillaMenuCategory>();

			for (var i = 0; i < menus.Length; i++)
			{
				if (!_prefabSystem.TryGetPrefab<PrefabBase>(menus[i], out var prefab) || prefab?.name is null)
				{
					continue;
				}

				names[menus[i].Index] = prefab.name;
				// The reverse of names, and it needs the whole Entity: opening a menu
				// means handing one to the game's toolbar.selectAssetMenu trigger, and
				// an Entity without its version is not a valid handle.
				entities[prefab.name] = menus[i];

				prefab.TryGet<UIObject>(out var uIObject);

				// Same record as a category tab, because a menu is the tier above one.
				// Priority is UIObject.m_Priority; the bottom bar also sorts by toolbar
				// GROUP first, which is not modelled here.
				list.Add(new VanillaMenuCategory(
					Id: prefab.name,
					Name: prefab.name,
					Icon: IconPath.Normalize(CategoryIcon.Resolve(uIObject?.m_Icon, _imageSystem.GetIconOrGroupIcon(menus[i]))) ?? string.Empty,
					Priority: uIObject?.m_Priority ?? 0));
			}

			list.Sort((left, right) => left.Priority.CompareTo(right.Priority));

			_assetMenuNames = names;
			_assetMenuEntities = entities;
			_assetMenus = list;
			Mod.Log.Info($"Indexed Asset Menus Count: {_assetMenuNames.Count}");
		}

		/// <summary>Caches each menu's category tabs, which are vanilla's second tier.</summary>
		/// <remarks>A category that names no menu is not a build-menu tab — UIAssetCategoryPrefab adds
		/// UIAssetCategoryData only when m_Menu is set — so that check is belt and braces.</remarks>
		private void IndexAssetCategories()
		{
			var query = GetEntityQuery(
				ComponentType.ReadOnly<UIAssetCategoryData>(),
				ComponentType.ReadOnly<PrefabData>());
			var categories = query.ToEntityArray(Allocator.Temp);
			var byMenu = new Dictionary<string, List<VanillaMenuCategory>>();

			for (var i = 0; i < categories.Length; i++)
			{
				if (!_prefabSystem.TryGetPrefab<PrefabBase>(categories[i], out var prefab)
					|| prefab is not UIAssetCategoryPrefab category
					|| category.m_Menu?.name is not string menuName)
				{
					continue;
				}

				// A category with no members is not a tab: vanilla drops these in
				// GetSortedCategories before it binds the row. Transportation ships a
				// ferry category that is empty in a base-game save.
				if (!EntityManager.TryGetBuffer<UIGroupElement>(categories[i], true, out var members)
					|| members.Length == 0)
				{
					continue;
				}

				prefab.TryGet<UIObject>(out var uIObject);

				if (!byMenu.TryGetValue(menuName, out var tabs))
				{
					tabs = new List<VanillaMenuCategory>();
					byMenu[menuName] = tabs;
				}

				tabs.Add(new VanillaMenuCategory(
					Id: prefab.name,
					Name: prefab.name,
					Icon: IconPath.Normalize(CategoryIcon.Resolve(uIObject?.m_Icon, _imageSystem.GetIconOrGroupIcon(categories[i]))) ?? string.Empty,
					// Vanilla orders its tabs by this and defaults it to 0, so
					// categories that never set one keep their query order rather
					// than being pushed to the end.
					Priority: uIObject?.m_Priority ?? 0));
			}

			foreach (var tabs in byMenu.Values)
			{
				tabs.Sort((left, right) => left.Priority.CompareTo(right.Priority));
			}

			_assetCategories = byMenu;
			Mod.Log.Info($"Indexed Asset Categories: {byMenu.Count} menus, {byMenu.Values.Sum(list => list.Count)} tabs");
		}

		private void IndexZones()
		{
			// Rebuilt with the catalog, not merged into it. A reindex can drop
			// zones, and entity indices are reused within a session, so a stale
			// entry here would answer for whatever took its place.
			_zoneFacts = new Dictionary<int, VanillaAssetFacts>();

			var zonesQuery = GetEntityQuery(
				ComponentType.ReadOnly<ZoneData>(),
				ComponentType.ReadOnly<ZonePropertiesData>(),
				ComponentType.ReadOnly<PrefabData>());
			var zones = zonesQuery.ToEntityArray(Allocator.Temp);
			var propertiesData = zonesQuery.ToComponentDataArray<ZonePropertiesData>(Allocator.Temp);
			var zoneData = zonesQuery.ToComponentDataArray<ZoneData>(Allocator.Temp);

			var buildingsQuery = GetEntityQuery(new EntityQueryDesc
			{
				All = new[]
				{
					ComponentType.ReadOnly<BuildingData>(),
					ComponentType.ReadOnly<SpawnableBuildingData>(),
					ComponentType.ReadOnly<PrefabData>()
				},
				None = new[] { ComponentType.ReadOnly<SignatureBuildingData>() }
			});
			var buildingsData = buildingsQuery.ToComponentDataArray<BuildingData>(Allocator.Temp);
			var spawnableBuildings = buildingsQuery.ToComponentDataArray<SpawnableBuildingData>(Allocator.Temp);

			// One pass over the buildings rather than a rescan per zone. It also
			// yields the lot sizes each zone can actually fill, which the game never
			// tells the player: some zones only ever grow 2x2.
			var lotSizes = new Dictionary<Entity, ZoneLotSizes>();

			for (var j = 0; j < spawnableBuildings.Length; j++)
			{
				var zonePrefab = spawnableBuildings[j].m_ZonePrefab;
				if (zonePrefab == Entity.Null)
				{
					continue;
				}

				var lot = buildingsData[j].m_LotSize;

				lotSizes[zonePrefab] = lotSizes.TryGetValue(zonePrefab, out var seen)
					? seen.Include(lot.x, lot.y)
					: ZoneLotSizes.From(lot.x, lot.y);
			}

			var dictionary = new Dictionary<Entity, ZoneTypeFilter>();
			var densities = new Dictionary<Entity, ZoneTypeFilter>();

			for (var i = 0; i < zones.Length; i++)
			{
				var zone = zones[i];
				var info = propertiesData[i];
				var maxLotWidth = lotSizes.TryGetValue(zone, out var sizes) ? sizes.MaxWidth : 0;

				// The ZONE'S OWN tier, which is what the zoning menu navigates by, and
				// which is computed for every zone including the ones the building-side
				// answer below skips.
				densities[zone] = ZoneDensityClassifier.Classify(new ZoneDensityFacts(
					IsResidential: info.m_ResidentialProperties > 0f,
					ResidentialProperties: info.m_ResidentialProperties,
					SpaceMultiplier: info.m_SpaceMultiplier,
					ScaleResidentials: info.m_ScaleResidentials,
					SellsGoods: info.m_AllowedSold != default,
					MaxLotWidth: maxLotWidth,
					PrefabName: _prefabSystem.TryGetPrefab<PrefabBase>(zone, out var densityPrefab)
						? densityPrefab?.name ?? string.Empty
						: string.Empty));

				// The BUILDING-side answer, unchanged. See _zoneTypeCache: this
				// one exists so a building can be filtered by the zone it grows
				// in, and widening it would reclassify thousands of them.
				if (info.m_ResidentialProperties <= 0f)
				{
					dictionary[zone] = ZoneTypeFilter.Any;
					continue;
				}

				var ratio = info.m_ResidentialProperties / info.m_SpaceMultiplier;

				if (!info.m_ScaleResidentials)
				{
					dictionary[zone] = ZoneTypeFilter.Low;
				}
				else if (ratio < 1f)
				{
					// "No spawnable building wider than 2" is exactly "the widest is at
					// most 2". A zone with no spawnable buildings at all stays Row.
					dictionary[zone] = maxLotWidth <= 2 ? ZoneTypeFilter.Row : ZoneTypeFilter.Medium;
				}
				else
				{
					dictionary[zone] = ZoneTypeFilter.High;
				}
			}

			_zoneTypeCache = dictionary;
			_zoneDensityCache = densities;
			_zoneLotSizeCache = lotSizes;

			// The same pass that classifies buildings by zone also yields the zones
			// themselves, which the zoning hierarchy browses. Family comes from
			// ZoneData, and density from the derivation just performed.
			var catalog = new List<ZoneCatalogEntry>();

			for (var i = 0; i < zones.Length; i++)
			{
				var zone = zones[i];

				if (!_prefabSystem.TryGetPrefab<PrefabBase>(zone, out var prefab) || prefab?.name is null)
				{
					continue;
				}

				// The zone's own data first: ZoneData.m_AreaType plus ZoneFlags.Office
				// is what the game itself switches on. The query requires ZoneData, so
				// the fallbacks only run for a zone whose AreaType is None.
				var family = ZoningSurfaceCatalog.ResolveFamily(zoneData[i].m_AreaType, zoneData[i].m_ZoneFlags)
					?? ZoningSurfaceCatalog.ResolveFamilyFromGroup(
						prefab.TryGet<UIObject>(out var zoneUi) ? zoneUi.m_Group?.name : null)
					?? ZoningSurfaceCatalog.ResolveFamily(prefab.name);

				if (family is null)
				{
					continue;
				}

				var isZoneLocked = EntityManager.HasEnabledComponent<Locked>(zone);
				var (zoneMilestone, zoneRequirements) = isZoneLocked
					? GetUnlockRequirements(zone)
					: (0, Array.Empty<string>());

				_zoneFacts[zone.Index] = GetVanillaAssetFacts(zone);

				catalog.Add(new ZoneCatalogEntry(
					Id: zone.Index,
					Version: zone.Version,
					PrefabName: prefab.name,
					Name: GetAssetName(prefab),
					Family: family,
					// One source for the tier, shared with the prefab index:
					// ZoneDensityClassifier owns the rules, including the name fallback
					// for commercial and office.
					Density: GetZoneDensity(zone),
					Thumbnail: IconPath.Normalize(ImageSystem.GetThumbnail(prefab)),
					// Measured by the game, never shown by it: BuildingInitializeSystem
					// raises MaxHeight to the tallest mesh of every spawnable building the
					// zone can grow, so this is real geometry rather than the tier's name.
					MaxHeight: zoneData[i].m_MaxHeight,
					SupportsNarrow: (zoneData[i].m_ZoneFlags & ZoneFlags.SupportNarrow) != 0,
					SupportsCorners: (zoneData[i].m_ZoneFlags
						& (ZoneFlags.SupportLeftCorner | ZoneFlags.SupportRightCorner)) != 0,
					AllowedSold: ResourceName(propertiesData[i].m_AllowedSold),
					AllowedManufactured: ResourceName(propertiesData[i].m_AllowedManufactured),
					AllowedStored: ResourceName(propertiesData[i].m_AllowedStored),
					// What will actually grow here. A zone whose buildings are
					// all 2x2 fills a 2-wide strip and nothing else, which
					// decides how the block gets drawn and is stated nowhere.
					MinLotWidth: lotSizes.TryGetValue(zone, out var zoneLots) ? zoneLots.MinWidth : 0,
					MaxLotWidth: zoneLots?.MaxWidth ?? 0,
					MinLotDepth: zoneLots?.MinDepth ?? 0,
					MaxLotDepth: zoneLots?.MaxDepth ?? 0,
					Footprints: zoneLots?.Footprints,
					FootprintOverflow: zoneLots?.FootprintOverflow ?? 0,
					// Same source as the building index: the enableable Locked
					// component, not its mere presence, which would mark every
					// unlockable zone locked forever including the earned ones.
					IsLocked: isZoneLocked,
					UnlockMilestone: zoneMilestone,
					UnlockRequirements: zoneRequirements));
			}

			// The menu is the authority: it lists the specialised industries the
			// player can actually pick. The component query is only a fallback, and
			// it finds the underlying extractor LOTS vanilla does not offer.
			if (!InheritVanillaZoneMenu(catalog))
			{
				Mod.Log.Warn("Zones menu inherited nothing; falling back to the extractor query.");
				IndexExtractorAreas(catalog);
			}

			_zoneCatalog = catalog;
			Mod.Log.Info($"Indexed Zones Count: {_zoneCatalog.Count}");
		}

		/// <summary>Takes the Zones menu's categories and members from the game itself.</summary>
		/// <remarks>Membership is not in components, so no query can reproduce the menu. See
		/// docs/indexing.md, "The vanilla menu walk".</remarks>
		private bool InheritVanillaZoneMenu(List<ZoneCatalogEntry> catalog)
		{
			var known = new HashSet<int>(catalog.Select(entry => entry.Id));
			var added = 0;
			var categoriesSeen = new HashSet<string>();

			foreach (var placement in _menuPlacements.Values)
			{
				if (!string.Equals(placement.Menu?.Trim(), "Zones", StringComparison.OrdinalIgnoreCase))
				{
					continue;
				}

				categoriesSeen.Add(placement.Category ?? string.Empty);

				if (known.Contains(placement.Entity.Index)
					|| !_prefabSystem.TryGetPrefab<PrefabBase>(placement.Entity, out var prefab)
					|| prefab?.name is null)
				{
					continue;
				}

				var family = ZoningSurfaceCatalog.ResolveFamilyFromGroup(placement.Category)
					?? ZoningFamilies.Extractors;
				var locked = EntityManager.HasEnabledComponent<Locked>(placement.Entity);
				var (milestone, requirements) = locked
					? GetUnlockRequirements(placement.Entity)
					: (0, Array.Empty<string>());
				var feature = EntityManager.TryGetComponent<ExtractorAreaData>(placement.Entity, out var extractor)
					? extractor.m_MapFeature.ToString()
					: null;

				_zoneFacts[placement.Entity.Index] = GetVanillaAssetFacts(placement.Entity);

				catalog.Add(new ZoneCatalogEntry(
					Id: placement.Entity.Index,
					Version: placement.Entity.Version,
					PrefabName: prefab.name,
					Name: GetAssetName(prefab),
					Family: family,
					Density: ZoneTypeFilter.Any,
					Thumbnail: IconPath.Normalize(ImageSystem.GetThumbnail(prefab)),
					IsLocked: locked,
					UnlockMilestone: milestone,
					UnlockRequirements: requirements,
					MapFeature: feature));

				known.Add(placement.Entity.Index);
				added++;
			}

			Mod.Log.Info(
				$"Inherited Zones menu: {added} assets added, categories seen: {string.Join(", ", categoriesSeen)}");

			// Which of our entries the game does NOT offer in that menu. An entry
			// vanilla never shows is one the player cannot use, so this is the list
			// to justify or drop.
			var placedInZones = new HashSet<int>(
				_menuPlacements.Values
					.Where(p => string.Equals(p.Menu?.Trim(), "Zones", StringComparison.OrdinalIgnoreCase))
					.Select(p => p.Entity.Index));
			var unplaced = catalog.Where(entry => !placedInZones.Contains(entry.Id)).ToList();

			Mod.Log.Info(
				$"[ZONE-PARITY] vanilla places {placedInZones.Count} in Zones; dropping {unplaced.Count} it does not offer: "
				+ string.Join(" | ", unplaced.Select(entry => $"{entry.Name} [{entry.PrefabName}]")));

			// Show what the game shows, and nothing else: the ZoneData query returns
			// every zone prefab that exists, including ones the player can never
			// pick. Applied only when the walk actually found the menu.
			catalog.RemoveAll(entry => !placedInZones.Contains(entry.Id));

			return added > 0;
		}

		/// <summary>The specialised industries, which are areas rather than zones.</summary>
		/// <remarks>They are LotPrefabs carrying <c>ExtractorArea</c>, and <c>Game.Zones.AreaType</c> has
		/// no specialised type for them, so the zone query — which requires ZoneData — never returns one.</remarks>
		private void IndexExtractorAreas(List<ZoneCatalogEntry> catalog)
		{
			var areasQuery = GetEntityQuery(
				ComponentType.ReadOnly<ExtractorAreaData>(),
				ComponentType.ReadOnly<PrefabData>());
			var areas = areasQuery.ToEntityArray(Allocator.Temp);
			var areaData = areasQuery.ToComponentDataArray<ExtractorAreaData>(Allocator.Temp);

			for (var i = 0; i < areas.Length; i++)
			{
				var area = areas[i];

				if (!_prefabSystem.TryGetPrefab<PrefabBase>(area, out var prefab) || prefab?.name is null)
				{
					continue;
				}

				var locked = EntityManager.HasEnabledComponent<Locked>(area);
				var (milestone, requirements) = locked
					? GetUnlockRequirements(area)
					: (0, Array.Empty<string>());

				catalog.Add(new ZoneCatalogEntry(
					Id: area.Index,
					Version: area.Version,
					PrefabName: prefab.name,
					Name: GetAssetName(prefab),
					Family: ZoningFamilies.Extractors,
					// An area has no density tier. Saying "Any" is honest here:
					// the surface labels that "No density tier" rather than
					// inventing one.
					Density: ZoneTypeFilter.Any,
					Thumbnail: IconPath.Normalize(ImageSystem.GetThumbnail(prefab)),
					IsLocked: locked,
					UnlockMilestone: milestone,
					UnlockRequirements: requirements,
					// What it works: FertileLand, Forest, Oil, Ore. This is the
					// only thing separating grain from cotton in the data, so it
					// is what the surface groups and labels them by.
					MapFeature: areaData[i].m_MapFeature.ToString()));
			}

			Mod.Log.Info($"Indexed Extractor Areas: {areas.Length}");
			areas.Dispose();
			areaData.Dispose();
		}

		/// <summary>
		/// Asks the game which unique assets the city already holds, for the panel to
		/// refuse a second one of.
		/// </summary>
		/// <remarks>
		/// Per-prefab through UniqueAssetTrackingSystem.IsPlacedUniqueAsset, never
		/// through the tracker's placedUniqueAssets collection, so our answer is the
		/// game's answer however it was reached. Anarchy makes that accessor say false
		/// while its "place multiple unique buildings" option is on, and disables the
		/// system that fills the collection, so a collection read both refuses what
		/// Anarchy allows and never hears about it. Cheap enough to re-run on every
		/// catalog publish, which is what keeps up with a tracker that is switched off
		/// and therefore raises no events. See PlacedUniqueScan.
		/// </remarks>
		private void RefreshPlacedUniques(bool rebuildCandidates)
		{
			if (rebuildCandidates)
			{
				CollectUniqueCandidates();
			}

			if (_uniqueAssets is null)
			{
				PlacedUniqueRegistry.Reset(null);
				return;
			}

			var candidates = new List<PlacedUniqueScan.Candidate>(_uniqueCandidates.Count);

			foreach (var (id, prefab) in _uniqueCandidates)
			{
				if (!_prefabSystem.TryGetEntity(prefab, out var entity))
				{
					continue;
				}

				candidates.Add(new PlacedUniqueScan.Candidate(
					id,
					isUnique: true,
					accessorSaysPlaced: _uniqueAssets.IsPlacedUniqueAsset(entity)));
			}

			var moved = PlacedUniqueRegistry.Reset(PlacedUniqueScan.Collect(candidates));

			if (moved)
			{
				// Same reason as the event path: the prefabs are untouched but the
				// projections built from them are stale.
				IndexGeneration++;
			}

			// Logged on a change only: the rescan runs on every catalog publish.
			if (moved || _uniqueCandidates.Count != _loggedUniqueCandidateCount)
			{
				_loggedUniqueCandidateCount = _uniqueCandidates.Count;
				Mod.Log.Info($"Placed unique assets: {PlacedUniqueRegistry.Count} of {_uniqueCandidates.Count} unique assets");
			}
		}

		/// <summary>Rescans the placed uniques for whoever is about to draw them.</summary>
		/// <remarks>
		/// Static because the panel holds no reference to this system. Does not republish
		/// the catalog: the caller is already on its way to doing that, and a republish
		/// from here would recurse.
		/// </remarks>
		public static void SyncPlacedUniques() => _instance?.RefreshPlacedUniques(rebuildCandidates: false);

		private void CollectUniqueCandidates()
		{
			var candidates = new List<(int Id, PrefabBase Prefab)>();

			if (BuildingMenuUtil.CategorizedPrefabs.TryGetValue(PrefabCategory.Any, out var subCategories)
				&& subCategories.TryGetValue(PrefabSubCategory.Any, out var prefabs))
			{
				foreach (var prefabIndex in prefabs)
				{
					if (prefabIndex.IsUnique && prefabIndex.Prefab is not null)
					{
						candidates.Add((prefabIndex.Id, prefabIndex.Prefab));
					}
				}
			}

			_uniqueCandidates = candidates;
		}

		/// <summary>Keeps the placed-unique set in step with the city.</summary>
		/// <remarks>Fires on both edges, so the state goes stale in neither direction. Refreshed rather
		/// than re-indexed: nothing about the PREFAB changed, only what the city holds.</remarks>
		private void OnUniqueAssetStatusChanged(Entity prefab, bool placed)
		{
			PlacedUniqueRegistry.Set(prefab.Index, placed);
			IndexGeneration++;
			_menuUISystem?.RefreshBuildingCatalogFromIndexing();
		}

		/// <summary>Names a pack for <see cref="AssetPackRegistry"/>.</summary>
		/// <remarks>Recorded as the packs are walked, the one place both halves of the entity are in
		/// hand. Wider than vanilla's Pack row, which BindPacks builds from the selected CATEGORY.</remarks>
		private void RecordAssetPack(Entity pack)
		{
			AssetPackRegistry.Record(
				pack.Index,
				pack.Version,
				_prefabSystem.TryGetPrefab<PrefabBase>(pack, out var packPrefab)
					? GetAssetName(packPrefab)
					: string.Empty);
		}

		/// <summary>The upgrades a building supports, in the order vanilla offers them.</summary>
		/// <remarks>Two buffers, as UpgradeMenuUISystem reads them — BuildingUpgradeElement for service
		/// upgrades, BuildingModule for the modules signature towers take — filtered and ordered as it does.</remarks>
		private (string[] DisplayNames, string[] PrefabNames) GetSupportedUpgrades(Entity entity)
		{
			List<(int Priority, string Name, string PrefabName)> found = null;

			if (EntityManager.TryGetBuffer<BuildingUpgradeElement>(entity, true, out var upgrades))
			{
				for (var i = 0; i < upgrades.Length; i++)
				{
					CollectUpgrade(upgrades[i].m_Upgrade, ref found);
				}
			}

			if (EntityManager.TryGetBuffer<BuildingModule>(entity, true, out var modules))
			{
				for (var i = 0; i < modules.Length; i++)
				{
					CollectUpgrade(modules[i].m_Module, ref found);
				}
			}

			if (found is null)
			{
				return (Array.Empty<string>(), Array.Empty<string>());
			}

			// OrderBy, not Sort: it is stable, so two upgrades sharing a priority
			// keep the order the game's own buffers hold them in.
			var ordered = found.OrderBy(entry => entry.Priority).ToArray();

			return (
				ordered.Select(entry => entry.Name).ToArray(),
				ordered.Select(entry => entry.PrefabName).ToArray());
		}

		private void CollectUpgrade(Entity upgrade, ref List<(int Priority, string Name, string PrefabName)> found)
		{
			if (!EntityManager.TryGetComponent<UIObjectData>(upgrade, out var ui))
			{
				return;
			}

			if (!_prefabSystem.TryGetPrefab<PrefabBase>(upgrade, out var prefab) || prefab?.name is null)
			{
				return;
			}

			(found ??= new List<(int Priority, string Name, string PrefabName)>()).Add((ui.m_Priority, GetAssetName(prefab), prefab.name));
		}

		/// <summary>What the game's own toolbar filter row knows about a prefab.</summary>
		/// <remarks>Identity-free by design: WHICH requirement and pack entities an asset carries, never
		/// which themes or packs they are, so a theme or pack a mod ships needs no change here.</remarks>
		private VanillaAssetFacts GetVanillaAssetFacts(Entity entity)
		{
			var themeRequirements = new List<int>();

			if (EntityManager.TryGetBuffer<ObjectRequirementElement>(entity, true, out var requirements))
			{
				for (var i = 0; i < requirements.Length; i++)
				{
					var requirement = requirements[i].m_Requirement;

					if (EntityManager.HasComponent<ThemeData>(requirement))
					{
						themeRequirements.Add(requirement.Index);
					}
				}
			}

			var packs = new List<int>();
			var hasPackBuffer = EntityManager.TryGetBuffer<AssetPackElement>(entity, true, out var packElements);

			// IsModAsset, and the second half is easy to get backwards: an asset
			// carrying ModPrerequisiteData is NOT a mod asset when one of its packs
			// carries it too, so the pack filter governs it, not the Mods toggle.
			var isModAsset = EntityManager.HasComponent<ModPrerequisiteData>(entity);

			if (hasPackBuffer)
			{
				for (var i = 0; i < packElements.Length; i++)
				{
					var pack = packElements[i].m_Pack;
					packs.Add(pack.Index);
					RecordAssetPack(pack);

					if (isModAsset && EntityManager.HasComponent<ModPrerequisiteData>(pack))
					{
						isModAsset = false;
					}
				}
			}

			return new VanillaAssetFacts(themeRequirements, packs, hasPackBuffer, isModAsset);
		}

		/// <summary>The tab strip for a menu, empty when the menu has none.</summary>
		/// <remarks>Roads gets more tabs than the game gives it: the lens gathers every network there
		/// (see <see cref="NetworkMenuExtension"/>), so the strip has to offer the extras too.</remarks>
		public static IReadOnlyList<VanillaMenuCategory> GetMenuCategories(string? menuName)
		{
			var tabs = menuName is not null && _assetCategories.TryGetValue(menuName, out var found)
				? found
				: (IReadOnlyList<VanillaMenuCategory>)Array.Empty<VanillaMenuCategory>();

			if (!NetworkMenuExtension.IsExtended(menuName) || tabs.Count == 0)
			{
				return tabs;
			}

			return tabs.Concat(GetExtraNetworkCategories()).ToArray();
		}

		/// <summary>A tab for each kind of network the Roads menu does not already hold.</summary>
		/// <remarks>Built from what is indexed rather than from the enum, so a subcategory with nothing
		/// in it draws no tab. Ids match what NetworkMenuExtension.Reframe writes onto the entries.</remarks>
		private static IEnumerable<VanillaMenuCategory> GetExtraNetworkCategories()
		{
			if (!BuildingMenuUtil.CategorizedPrefabs.TryGetValue(PrefabCategory.Networks, out var networks))
			{
				yield break;
			}

			foreach (var pair in networks.OrderBy(pair => (int)pair.Key))
			{
				if (pair.Key == PrefabSubCategory.Any || pair.Value.Count == 0)
				{
					continue;
				}

				// Only the ones that arrive through the extension. A subcategory whose
				// members are all in the Roads menu already has vanilla tabs covering
				// them, and a second tab over the same assets would split the roads.
				if (!pair.Value.Any(prefab => !string.Equals(
						prefab.UiMenuName,
						NetworkMenuExtension.RoadsMenu,
						StringComparison.OrdinalIgnoreCase)))
				{
					continue;
				}

				var name = pair.Key.ToString();

				yield return new VanillaMenuCategory(
					Id: NetworkMenuExtension.GroupId(name),
					Name: NetworkMenuExtension.GroupId(name),
					Icon: IconPath.Normalize(CategoryIconAttribute.GetAttribute(pair.Key).Icon) ?? string.Empty,
					Priority: NetworkMenuExtension.GroupPriority(name));
			}
		}

		/// <summary>Every vanilla menu that has something in it, in the game's order.</summary>
		/// <remarks>Filtered to menus with at least one category tab, the same test vanilla applies
		/// before drawing one: a menu whose categories are all empty is a button the game hides.</remarks>
		public static IReadOnlyList<VanillaMenuCategory> GetAssetMenus() =>
			_assetMenus.Where(menu => _assetCategories.ContainsKey(menu.Id)).ToArray();

		/// <summary>The prefab name of a vanilla toolbar asset menu, by entity index.</summary>
		/// <remarks>The UI reads the game's toolbar.selectedAssetMenu binding but receives only an
		/// entity, and entity indices are runtime values that must not be persisted.</remarks>
		public static string? GetAssetMenuName(int entityIndex) => _assetMenuNames.TryGetValue(entityIndex, out var name)
			? name
			: null;

		/// <summary>The name of a single allowed resource, or null.</summary>
		/// <remarks><c>Resource</c> is a ulong flags enum: zero ToString()s as "NoResource" and a
		/// composite value as a raw number — and only a single flag tells the player anything.</remarks>
		private static string? ResourceName(Game.Economy.Resource resource)
		{
			ulong value = (ulong)resource;

			bool isSingleResource = value != 0UL && (value & (value - 1UL)) == 0UL;

			return isSingleResource ? resource.ToString() : null;
		}

		public static ZoneTypeFilter GetZoneType(Entity zonePrefab)
		{
			if (_zoneTypeCache != null && _zoneTypeCache.TryGetValue(zonePrefab, out var type))
			{
				return type;
			}

			return ZoneTypeFilter.Any;
		}

		/// <summary>The lot shapes a zone grows, or none.</summary>
		public static ZoneLotSizes GetZoneLotSizes(Entity zonePrefab) =>
			_zoneLotSizeCache != null && _zoneLotSizeCache.TryGetValue(zonePrefab, out var sizes)
				? sizes
				: null;

		/// <summary>The zone's own density tier. Any when it has none.</summary>
		/// <remarks>Fails soft like <see cref="GetZoneType"/>, so a cold read is indistinguishable from
		/// an untiered zone; IndexZones fills the cache before the prefab category processors start.</remarks>
		public static ZoneTypeFilter GetZoneDensity(Entity zonePrefab)
		{
			if (_zoneDensityCache != null && _zoneDensityCache.TryGetValue(zonePrefab, out var density))
			{
				return density;
			}

			return ZoneTypeFilter.Any;
		}

		/// <summary>How many cars the asset can park, counted rather than merely detected.</summary>
		/// <remarks>Exact for an object's own lanes: LaneSystem.CreateObjectLane sets FindConnections on
		/// every one, so the curve is never trimmed and the game's own arithmetic reproduces the count.</remarks>
		private int GetParkingSlots(PrefabBase prefab)
		{
			var slots = 0;

			// A garage parks cars inside rather than along marked lanes, so it has
			// no sub-lanes to divide up and declares its capacity outright.
			if (prefab.TryGet<ParkingFacility>(out var parkingFacility)
				&& parkingFacility.m_GarageMarkerCapacity > 0)
			{
				slots += parkingFacility.m_GarageMarkerCapacity;
			}
			else if (prefab.TryGet<SpawnLocation>(out var spawnLocation)
				&& spawnLocation.m_ConnectionType == RouteConnectionType.Parking)
			{
				// A parking connection with no declared capacity really is one
				// dedicated space — a driveway rather than a car park.
				slots++;
			}

			if (prefab.TryGet<ObjectSubLanes>(out var subLanes) && subLanes.m_SubLanes is not null)
			{
				foreach (var lane in subLanes.m_SubLanes)
				{
					if (lane?.m_LanePrefab is null
						|| !lane.m_LanePrefab.TryGet<ParkingLane>(out var parkingLane))
					{
						continue;
					}

					// A lane with no slot width is Virtual, and the game's own capacity sum
					// skips those: RoadsInfoviewUISystem drops VirtualLane before adding
					// slots, and a slot angle near zero would otherwise count bays.
					if (parkingLane.m_SlotSize.x < 0.001f)
					{
						continue;
					}

					var interval = GetParkingSlotInterval(parkingLane);

					if (interval > 0.001f)
					{
						// The +0.01 is the game's, not a fudge: GetParkingSlotCount
						// adds it before the divide, and dropping it loses a bay
						// whenever the length divides exactly.
						slots += (int)Math.Floor((MathUtils.Length(lane.m_BezierCurve) + 0.01f) / interval);
					}
				}
			}

			if (prefab.TryGet<ObjectSubObjects>(out var subObjects) && subObjects.m_SubObjects is not null)
			{
				foreach (var obj in subObjects.m_SubObjects)
				{
					if (obj.m_Object is not null)
					{
						slots += GetParkingSlots(obj.m_Object);
					}
				}
			}

			return slots;
		}

		/// <summary>The spacing between bays, derived the way the game bakes it.</summary>
		/// <remarks>NetInitializeSystem computes ParkingLaneData.m_SlotInterval from the managed slot
		/// size and angle; deriving it here keeps to the prefab graph the rest of the walk uses.</remarks>
		private static float GetParkingSlotInterval(ParkingLane parkingLane)
		{
			var angle = math.radians(math.clamp(parkingLane.m_SlotAngle, 0f, 90f));
			var slotSize = math.select(parkingLane.m_SlotSize, 0f, parkingLane.m_SlotSize < 0.001f);
			var y = new float2(math.cos(angle), math.sin(angle));

			if (y.y < 0.001f)
			{
				return slotSize.y;
			}

			if (y.x < 0.001f)
			{
				return slotSize.x;
			}

			var scaled = slotSize / new float2(y.y, y.x);
			scaled = math.select(scaled, 0f, scaled < 0.001f);

			return math.min(scaled.x, scaled.y);
		}
	}
}
