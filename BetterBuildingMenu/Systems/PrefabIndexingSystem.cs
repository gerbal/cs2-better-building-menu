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
		private ImageSystem _imageSystem;
		private PrefabUISystem _prefabUISystem;
		private BuildingMenuUISystem _menuUISystem;
		private HashSet<string> _blackList;
		private ComponentType? roadBuilderDiscarded;
		private static Dictionary<Entity, ZoneTypeFilter> _zoneTypeCache;

		/// <summary>
		/// Density per ZONE prefab, which is not the question
		/// <see cref="_zoneTypeCache"/> answers.
		/// </summary>
		/// <remarks>
		/// That one classifies a zone so its BUILDINGS can be filtered by the
		/// zone they grow in, and it deliberately knows only Low/Row/Medium/
		/// High. This one is the zone's own tier and adds Mixed and LowRent,
		/// which no building should ever receive.
		///
		/// Kept apart rather than widened: ZonedBuildingPrefabCategoryProcessor
		/// reads the other one, so a wider vocabulary there would silently
		/// reclassify thousands of buildings as a side effect of a change to
		/// the zoning menu.
		/// </remarks>
		private static Dictionary<Entity, ZoneTypeFilter> _zoneDensityCache;
		private EntityQuery _unlockEventQuery;
		// Prefabs the game created or changed this frame — the incremental
		// pass's own trigger. Held as a field rather than a RequireForUpdate
		// gate; see OnUpdate for why that gate had to go.
		private EntityQuery _changedPrefabQuery;
		// Guards against queueing a second pass while one is already pending:
		// the locale event fires more than once per change. See
		// OnActiveDictionaryChanged.
		private bool _localeChanged;
		private static List<ZoneCatalogEntry> _zoneCatalog = new();

		/// <summary>
		/// The vanilla toolbar's facts for each zone, keyed by entity index.
		/// </summary>
		/// <remarks>
		/// Beside the catalog rather than on <see cref="ZoneCatalogEntry"/>,
		/// because that record is serialised to the UI and this is backend-only
		/// data the UI has no use for. It is also where the EU/NA answer comes
		/// from, and zones are the assets that actually differ by theme — most
		/// buildings carry no theme requirement at all.
		/// </remarks>
		private static Dictionary<int, VanillaAssetFacts> _zoneFacts = new();
		private static Dictionary<int, string> _assetMenuNames = new();
		// The reverse: menu prefab name -> its entity, so the picker can ask the
		// game to open the menu that holds the building it just picked.
		private static Dictionary<string, Entity> _assetMenuEntities = new();
		// Vanilla's second tier, keyed by menu name. See VanillaMenuCategory.
		private static Dictionary<string, List<VanillaMenuCategory>> _assetCategories = new();
		/// <summary>
		/// The vanilla build menus, in the game's own order.
		/// </summary>
		/// <remarks>
		/// Published so the lens can offer them as a filter. A bottom-bar icon
		/// is a shortcut to a menu, and the menu is a facet like any other — so
		/// it has to be reachable without going back out to the toolbar.
		/// </remarks>
		private static IReadOnlyList<VanillaMenuCategory> _assetMenus = System.Array.Empty<VanillaMenuCategory>();
		// Where the vanilla build menu puts each asset, keyed by prefab entity
		// index. Built by IndexVanillaMenuPlacements; read by the coverage
		// report and by IsPlacedInVanillaMenu.
		private static Dictionary<int, VanillaMenuPlacement> _menuPlacements = new();
		// Milestone index -> the name the rest of the game calls it. ~20 entries,
		// resolved once per index pass rather than per locked asset.
		private static Dictionary<int, string> _milestoneNames = new();
		// Node entity -> branch label, and service name -> its root's label.
		// Rebuilt with the rest of the index; see IndexDevTreeBranches.
		// Label AND icon together, keyed by node and by service. The icon was
		// briefly keyed by label instead, which collides: every service's root
		// is called "Basic", so all eleven shared one entry and Electricity's
		// Basic tab drew the water glyph.
		private UniqueAssetTrackingSystem? _uniqueAssets;
		private Dictionary<Entity, (string Label, string Icon, int Depth)> _devTreeBranches = new();
		private static Dictionary<string, (string Label, string Icon, int Depth)> _devTreeRoots = new();
		// Milestone index -> its progression-screen image. Safe to key by index
		// because a milestone index IS unique, unlike a branch label.
		private static Dictionary<int, string> _milestoneIcons = new();
		private readonly List<IPrefabCategoryProcessor> _prefabCategoryProcessors = new();

		/// <summary>
		/// Bumped whenever an indexed fact changes: a re-index, an unlock, a
		/// unique built or bulldozed. The catalog's snapshot cache is keyed on
		/// it, so a stale projection cannot outlive the change that staled it.
		/// </summary>
		public static int IndexGeneration { get; private set; } = 1;

		protected override void OnCreate()
		{
			base.OnCreate();

			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_imageSystem = World.GetOrCreateSystemManaged<ImageSystem>();
			_prefabUISystem = World.GetOrCreateSystemManaged<PrefabUISystem>();
			_menuUISystem = World.GetOrCreateSystemManaged<BuildingMenuUISystem>();

			GameManager.instance.localizationManager.onActiveDictionaryChanged += OnActiveDictionaryChanged;

			// The third availability state, kept live off the game's own
			// tracker. GetExisting rather than GetOrCreate: this is a GAME
			// system and creating a second one would leave OnUpdate dead while
			// looking fine — the trap recorded against ECS systems generally.
			_uniqueAssets = World.GetExistingSystemManaged<UniqueAssetTrackingSystem>();

			if (_uniqueAssets is not null)
			{
				// `+=`, NOT `=`. EventUniqueAssetStatusChanged is a settable
				// PROPERTY rather than a C# event, so assigning it would drop
				// whatever the game or another mod had already put there.
				// Compound assignment reads, combines and writes back.
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

			// Unlock events are the second trigger. UnlockSystem.UnlockPrefab
			// disables the Locked component and raises an Unlock event, but
			// never marks the prefab Updated — so without this the lock state
			// captured at index time would stay stale until the next reload,
			// and a milestone would silently stop being reflected.
			//
			// The same query vanilla watches: ToolbarUISystem builds
			// GetEntityQuery(ComponentType.ReadOnly<Unlock>()) and reads it in
			// OnUpdate. The event entity carries Event as well as Unlock, and
			// PrepareCleanUpSystem hands those to CleanUpSystem in the Cleanup
			// phase — after PrefabUpdate, where this system runs — so the event
			// is still there to be seen in the frame it was raised.
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
		}

		protected override void OnGamePreload(Purpose purpose, GameMode mode)
		{
			base.OnGamePreload(purpose, mode);

			Enabled = false;
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
				RunIndex(true);

				Enabled = true;
			}
		}

		protected override void OnDestroy()
		{
			GameManager.instance.localizationManager.onActiveDictionaryChanged -= OnActiveDictionaryChanged;

			base.OnDestroy();
		}

		/// <summary>
		/// Marks the index stale when the player changes language.
		/// </summary>
		/// <remarks>
		/// Names, asset-menu titles and zone labels are resolved against the
		/// active dictionary once, when the prefab is indexed, and then cached.
		/// Everything the UI renders through <c>translate</c> follows a language
		/// change immediately, so switching to German moved the breadcrumbs and
		/// the group headings but left every building name in English — a
		/// half-translated menu that looked like missing translations rather
		/// than a stale cache.
		///
		/// Re-indexing wholesale is heavier than repairing the names alone, but
		/// a language change is rare and player-initiated, and a full pass
		/// cannot drift from what the index otherwise holds.
		///
		/// The work cannot be deferred to OnUpdate: this system declares
		/// RequireForUpdate on prefabs carrying Created or Updated, and a
		/// language change touches no entity at all, so OnUpdate would never
		/// run to notice a flag. Setting one looked right and did nothing.
		/// Dispatching to the main thread instead runs the pass on the next
		/// frame regardless of what the ECS gate thinks.
		/// </remarks>
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

		/// <remarks>
		/// Two things had to change before the unlock branch below could ever run,
		/// and only the second one was visible from this file.
		///
		/// The first was a <c>RequireForUpdate</c> on prefabs carrying Created or
		/// Updated. An unlock touches no prefab at all, so that gate held the
		/// system shut in precisely the case the branch existed to catch — the same
		/// trap described at length on OnActiveDictionaryChanged.
		///
		/// The second was the phase. Removing the gate changed nothing, because
		/// PrefabUpdate is not driven by the player loop: PrefabSystem calls
		/// Update(PrefabUpdate) when prefabs change, and an unlock is not a prefab
		/// change. The system is now registered at UIUpdate as well (see Mod.cs),
		/// which ticks every frame after UnlockSystem has raised its events.
		///
		/// Worth stating plainly: the first fix was tested by reading the code and
		/// looked complete. It took unlocking a node in the live tech tree, and
		/// finding nothing in the log, to see the phase underneath it.
		/// </remarks>
		protected override void OnUpdate()
		{
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

		/// <summary>
		/// Clears the lock state of the prefabs an Unlock event names.
		/// </summary>
		/// <remarks>
		/// Deliberately a patch rather than the full re-index this used to ask
		/// for. A full pass measures at five seconds on this save, and a
		/// milestone unlocks a whole tier at once, so "re-index on unlock" spends
		/// a five-second freeze on the single most celebratory moment in the
		/// game.
		///
		/// The patch is exact rather than approximate because lock state feeds
		/// exactly three fields, all set together in AddPrefab: IsLocked, and the
		/// UnlockMilestone/UnlockRequirements pair that is only meaningful while
		/// IsLocked. Nothing else in the index is derived from it, so there is no
		/// fourth field for this to drift away from.
		///
		/// PrefabIndex is a class and the category lists hold the same instances,
		/// so one write is seen by every view of it.
		/// </remarks>
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

				// The MILESTONE is a permanent property of the asset — the point
				// in the progression the game gates it behind — and it is kept
				// whatever the current lock state. It used to be assigned 0 here,
				// which meant the progression tier evaporated at the exact moment
				// the player earned it, and an asset unlocked mid-session dropped
				// out of its own tier tab.
				//
				// Re-reading it is safe, and this was measured rather than
				// assumed: unlocking only disables the Locked component
				// (UnlockSystem.UnlockPrefab) and never touches the
				// UnlockRequirement buffer the walk reads, so the same walk
				// returns the same milestone before and after.
				//
				// The REQUIREMENTS are not permanent. They answer "what is this
				// waiting on", which is a question an unlocked asset does not
				// have.
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

		/// <summary>
		/// Resolves every asset's silhouette now, while the game is still loading.
		/// </summary>
		/// <remarks>
		/// The cache memoises per asset and survives across refreshes, so the
		/// cost is paid exactly once per asset per session — but WHERE it was
		/// paid was the first time a menu happened to project that asset, which
		/// is the moment the player opens it.
		///
		/// Measured: the first refresh for a menu cost ~250-295ms against ~65ms
		/// for every later one, on both of the two largest menus. The premium is
		/// per MENU rather than global, which is what ruled out JIT warm-up —
		/// Landscaping paid it in full after Roads had already paid its own.
		///
		/// Doing it here moves that onto the loading screen, beside the game's
		/// own asset work, where a pause is what the player already expects.
		/// Full passes only: an incremental reindex touches a handful of prefabs
		/// and would rather not walk seventeen thousand.
		/// </remarks>
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

				// Before IndexZones, not after: the zone catalog inherits the
				// game's own Zones menu, so the placements have to exist by the
				// time it walks them. It also has to precede the processors —
				// the blacklist check below consults it, and so does the
				// terrain-brush processor.
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

					if (Mod.Settings.HideRandomAssets)
					{
						for (var i = 0; i < queries.Length; i++)
						{
							// None is null on a processor that never excludes anything, and
							// Concat on null throws — which took every processor down at
							// once on a prefix where HideRandomAssets was on, and indexed
							// nothing. The 949230 prefix never had the setting on, so it
							// was never seen there.
							queries[i].None = (queries[i].None ?? Array.Empty<ComponentType>())
								.Concat(new[] { ComponentType.ReadOnly<PlaceholderObjectData>() })
								.ToArray();
						}
					}

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

						// The blacklist is a list of names, written for a flat asset
						// browser where lot definitions and pipe nodes were noise. It
						// cannot outrank the build menu: Extractor Lot and Landfill Site
						// Lot are on it and are also the tools the Areas and Garbage
						// menus hand the player.
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
									// Keep reading legacy FindIt category overrides so existing
									// assets retain their intended classification. Newly generated
									// overrides use the successor prefix below.
									// An asset author's "keep this out of Find It" is honoured for
									// assets the game does not itself place. For one vanilla shows
									// in a menu — IndustrialModernPlaza01DeliveryVan01 carries
									// exclude=FindIt+FindIt/500/505 from upstream's generated-vehicle
									// scheme and sits in Landscaping › PropsIndustrial (cm-vxuv) —
									// the menu is the fact, as it is for the name blacklist above.
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

			// Seed the placed-unique set from the city that just loaded.
			//
			// The event keeps it current afterwards, but it cannot be trusted to
			// establish it: the tracker raises its loaded-asset events during
			// ITS OnUpdate, which may already have run, and a previous city's
			// entries would otherwise survive into this one. Reset both catches
			// up and clears.
			if (full)
			{
				SeedPlacedUniques();
			}

			stopWatch.Stop();

			Mod.Log.Info($"{(full ? "Full" : "Partial")} Prefab Indexing completed in {stopWatch.Elapsed.TotalSeconds:0.000}s");
			Mod.Log.Info($"Indexed Prefabs Count: {BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].Count}");

			if (full)
			{
				// Which processors feed anything the lens can show. A processor
				// whose every prefab is neither a building/network nor placed in
				// a vanilla menu is indexing for nobody — the review's "30
				// processors classify things the lens never lists" was a guess,
				// and Landscaping's trees say it was wrong; this is the count.
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

			/// <summary>
			/// Records where the vanilla build menu places each asset, walking the
			/// game's own group tree from the menus downward.
			/// </summary>
			/// <remarks>
			/// The direction is the whole point. Everything else in this file reads
			/// upward: an indexed asset names its category through
			/// <c>UIObject.m_Group</c>, and its menu through that category's
			/// <c>m_Menu</c>. That view can only ever describe assets we already hold,
			/// so an asset no processor queries is absent from it entirely and the menu
			/// it belongs to looks complete while being short. It is how the terrain
			/// brushes went missing from Landscaping and the seaway tools from
			/// Transportation: not filtered out, never indexed, and so invisible to any
			/// report built from the index.
			///
			/// The walk is vanilla's, step for step, so a difference is ours rather
			/// than an artefact of reading the tree differently.
			/// <c>ToolbarUISystem.BindAssetCategories</c> takes each menu's
			/// <see cref="UIGroupElement"/> buffer, <c>GetSortedCategories</c> keeps the
			/// members carrying <see cref="UIAssetCategoryData"/> that have members of
			/// their own, and <c>BindAssets</c> takes every element of those buffers.
			/// The one exclusion applied here is <c>FilterOutUpgrades</c>, which drops
			/// <see cref="ServiceUpgradeData"/>, because a service upgrade is placed
			/// from its parent building's row rather than the grid. The theme and
			/// asset-pack filters are deliberately NOT applied: those are player
			/// settings that hide assets which should still be indexed.
			///
			/// Two things read the result. LogVanillaMenuCoverage reports what is
			/// missing, and the index itself treats placement as an override — see the
			/// blacklist check in RunIndex, and IsPlacedInVanillaMenu.
			/// </remarks>
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

			/// <summary>
			/// Whether the vanilla build menu offers this prefab to the player.
			/// </summary>
			/// <remarks>
			/// The index's tie-breaker. Two of its own rules were hiding assets the game
			/// shows: the blacklist, which named Extractor Lot and Landfill Site Lot,
			/// and the terrain-brush target filter, which kept the five terrain materials
			/// out on the theory that they sat under no category. They do sit under one,
			/// and the coverage walk found them there.
			///
			/// Both rules are still right about what they were written for. This is the
			/// exception they both needed — whatever the game puts in front of the
			/// player, the lens carries too.
			/// </remarks>
			public static bool IsPlacedInVanillaMenu(int entityIndex) =>
				_menuPlacements.ContainsKey(entityIndex);

			/// <summary>
			/// Whether the game places this asset in that named menu.
			/// </summary>
			/// <remarks>
			/// The downward read, and the one the menu itself uses. Its opposite
			/// number is <c>PrefabIndex.UiMenuName</c>, which comes from the
			/// asset's own <c>UIObject.m_Group.m_Menu</c> — reading upward from
			/// an asset we already hold. That view can only ever describe assets
			/// some processor happened to index, so a menu looks complete while
			/// being short, and it is the shape behind the terrain-brush, seaway
			/// and Zones-tab gaps.
			///
			/// Walking down from UIAssetMenuData is what ToolbarUISystem does, so
			/// a difference between this and the grid is a bug of ours rather
			/// than an artefact of reading the tree differently.
			/// </remarks>
			/// <summary>
			/// The vanilla menu that holds an asset, as an entity the game's own
			/// toolbar trigger will accept.
			/// </summary>
			/// <remarks>
			/// Two hops, both off the downward walk: the asset's placement names
			/// its menu, and the menu index names that menu's entity. Fails for
			/// anything the game does not place in a menu at all, which is most
			/// of the 17,952 indexed assets and is why the caller needs a
			/// fallback.
			/// </remarks>
			public static bool TryGetMenuEntityFor(int assetEntityIndex, out Entity menu)
			{
				menu = Entity.Null;

				return _menuPlacements.TryGetValue(assetEntityIndex, out var placement)
					&& placement.Menu is not null
					&& _assetMenuEntities.TryGetValue(placement.Menu.Trim(), out menu);
			}

			/// <summary>
			/// A menu's own entity, by the name the lens scopes itself with.
			/// </summary>
			/// <remarks>
			/// Same table <see cref="TryGetMenuEntityFor"/> reaches through, but
			/// keyed straight off the menu name — the lens knows which menu it
			/// took over without holding any asset from it.
			/// </remarks>
			public static bool TryGetAssetMenuEntity(string menu, out Entity entity)
			{
				entity = Entity.Null;

				return !string.IsNullOrWhiteSpace(menu)
					&& _assetMenuEntities.TryGetValue(menu.Trim(), out entity);
			}

			public static bool IsPlacedInMenu(int entityIndex, string menu) =>
				_menuPlacements.TryGetValue(entityIndex, out var placement)
				&& string.Equals(placement.Menu?.Trim(), menu, System.StringComparison.OrdinalIgnoreCase);

			/// <summary>Whether the game places this asset in any menu at all.</summary>
			/// <remarks>
			/// The guard on the Roads menu's network gathering. "Every network"
			/// has to mean every network VANILLA PLACES — the index also holds
			/// networks the game never offers, and admitting those would put
			/// unplaceable rows in the one menu that gathers most widely.
			/// </remarks>
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

			public static bool IsPlacedInAnyMenu(int entityIndex) =>
				_menuPlacements.ContainsKey(entityIndex);

			/// <summary>
			/// Reports every asset the vanilla build menu shows that our index does not.
			/// </summary>
			/// <remarks>
			/// Logged rather than thrown because a gap is a real state of the game — a
			/// mod can add a menu whose assets we have no processor for — and a short
			/// menu serves the player better than a dead one.
			/// </remarks>
			/// <summary>
			/// A per-menu census of the vanilla build menu, in both directions.
			/// </summary>
			/// <remarks>
			/// LogVanillaMenuCoverage answers one question — what does vanilla place
			/// that we failed to index — and answers it well, but it is blind in two
			/// ways that let a whole menu go wrong unnoticed.
			///
			/// It skips zones outright, because they reach the player through the
			/// zoning hierarchy rather than the prefab index. That exclusion is why
			/// the Zones menu could be missing its entire Extractors tab — nine
			/// assets: Grain Farming, Livestock Farming, Textile Fiber Farming,
			/// Vegetable Farming, Forestry, Coal/Ore/Stone Mining, Oil Drilling —
			/// while the report said "0 missing".
			///
			/// And it only looks one way. It never asks what WE show that vanilla
			/// does not place, which is how four unbuildable "Area Hub" zones and
			/// six theme-less base zones sat in the surface until a player tried to
			/// build one.
			///
			/// So this is a census rather than an alarm: every menu, its categories,
			/// what vanilla places, what we cover, and what we show that vanilla
			/// does not. It logs at Info whether or not anything is wrong, because
			/// the value is in reading it, not in being warned by it.
			///
			/// The arithmetic itself now lives in <see cref="VanillaMenuAudit"/>,
			/// where it is a function of plain data and is covered by tests. This
			/// method gathers the facts out of the entity world and logs what comes
			/// back. That split is the point: as a log line the census could only be
			/// read by booting a save and grepping Modding.log, so nothing stopped
			/// the mapping regressing between boots.
			///
			/// Extras are split in the output. Ones a recorded divergence explains
			/// are reported as <c>expectedExtras</c>; anything else is
			/// <c>UNEXPLAINED</c>, which is either a new divergence to write down or
			/// a bug.
			/// </remarks>
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

					// What the first-party content packs actually contribute.
					//
					// The packs mount under --no-steam — the game lists every one
					// at boot — but nothing DLC-flagged reaches a menu, and the
					// lens's DLC facet is dropped everywhere as a result. Two very
					// different causes look identical from the UI: the prefabs may
					// be absent, or present and filtered for being unowned. This
					// says which.
					//
					// EnumerateLocalDLCs reads the shipped manifest, so it lists
					// what the INSTALL has. EnumerateDLCs goes through the platform
					// backends, so it lists what the STORE says. A stubbed
					// Steamworks leaves the second empty while the first is full,
					// and then IsDlcOwned is false for everything but the base game.
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
					// report accuses itself of losing all 22 of them.
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

				/// <summary>
				/// Why an asset vanilla places is not in the index: the editor
				/// categories the processors read and the components their queries
				/// key on. cm-vxuv: three such assets took a live session to explain;
				/// the audit line now carries the explanation.
				/// </summary>
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
			// Service upgrades are represented by a prefab carrying ServiceUpgrade
			// and/or an entity carrying ServiceUpgradeData (the latter is the
			// runtime marker used by the vanilla upgrade rows). Some game versions
			// expose only the extension component.
			// Keep the extension identity on the already-indexed row rather than
			// discovering a second list of upgrade assets. This also covers the
			// vanilla "Additional ..." BuildingPrefab entries, whose prefab type
			// is not BuildingExtensionPrefab even though they are extensions.
			bool isBuildingExtension = prefabIndex.Category is PrefabCategory.Buildings or PrefabCategory.ServiceBuildings
				&& (prefab is BuildingExtensionPrefab
					|| EntityManager.HasComponent<BuildingExtensionData>(entity)
					|| EntityManager.HasComponent<ServiceUpgradeData>(entity)
					|| prefab.TryGet<ServiceUpgrade>(out _));
			prefabIndex.ExtensionIds ??= isBuildingExtension ? new[] { prefab.name } : Array.Empty<string>();
			prefabIndex.SupportedUpgradeIds ??= GetSupportedUpgrades(entity);
			// Narrower than isBuildingExtension above, deliberately: this is
			// vanilla's exact test in FilterOutUpgrades, so what we hide from the
			// list is precisely what the game hides from its grid.
			prefabIndex.IsServiceUpgrade = EntityManager.HasComponent<ServiceUpgradeData>(entity);
			// The theme, pack and mod facts vanilla's own toolbar row filters on.
			// Captured here, at index time, because they are ECS reads and the
			// query runs on a worker with no EntityManager. Identity-free by
			// design: entity indices rather than names, so a theme or pack added
			// by a mod needs no code change to be filtered correctly.
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
			// SPIKE (cm-e98i): the menu placement the game itself uses. m_Group is
			// the asset's UI category; a category that is a UIAssetCategoryPrefab
			// names its menu. Two managed references, no ECS lookup.
			prefabIndex.UiCategoryName = uIObject?.m_Group?.name;
			prefabIndex.UiMenuName = (uIObject?.m_Group as UIAssetCategoryPrefab)?.m_Menu?.name;
			// The category's own priority, so a group of assets can be ordered
			// the way the tab strip above it is ordered. m_Group is a
			// UIGroupPrefab : PrefabBase, so its UIObject is one managed lookup
			// from here — the same two dereferences the lines above already do.
			//
			// Guarded on UIAssetCategoryPrefab, not on m_Group being non-null:
			// UIAssetMenuPrefab derives from UIGroupPrefab too, so an asset
			// parked directly on a menu rather than in one of its categories
			// would otherwise be ranked by the MENU's priority. Those are a
			// different ordering space — menus rank against each other in the
			// toolbar — and mixing the two would interleave the headings with
			// numbers that mean nothing to one another.
			prefabIndex.UiCategoryPriority =
				uIObject?.m_Group is UIAssetCategoryPrefab category
				&& category.TryGet<UIObject>(out var categoryUi)
					? categoryUi.m_Priority
					: 0;
			prefabIndex.IsVanilla = prefab.isBuiltin;
			// Not gated to Buildings and ServiceBuildings any more: a parking
			// lot reached through the Roads menu is a network, and reporting no
			// parking for the one asset class whose whole purpose is parking was
			// the most conspicuous case of the old boolean being useless.
			prefabIndex.ParkingSlots = GetParkingSlots(prefab);
			prefabIndex.HasParking = prefabIndex.ParkingSlots > 0;
			// Enableable: presence alone would mark every unlockable asset
			// locked forever, including the ones already earned.
			prefabIndex.IsLocked = EntityManager.HasEnabledComponent<Locked>(entity);
			// Only for what is actually locked. The walk allocates a hash map and
			// recurses per prefab, so running it across all 17,898 prefabs would be
			// the expensive thing here. Restricted this way the cost is highest at
			// load, when a full index runs anyway, and an unlock afterwards pays it
			// only for the prefabs it actually names (see ApplyUnlocks).
			prefabIndex.Bonuses = GetBonuses(entity);

			// Milestone kept whatever the lock state; requirements only while
			// locked. See the matching note in ApplyUnlocks.
			(prefabIndex.UnlockMilestone, var unlockRequirements) = GetUnlockRequirements(entity);
			prefabIndex.UnlockRequirements = prefabIndex.IsLocked ? unlockRequirements : Array.Empty<string>();

			// The other half of the progression, and the half that actually
			// splits a service menu. Resolved after UiMenuName above, because an
			// asset the tree never gated falls into its service's root bucket
			// and the menu is what names the service.
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
			// This used to be hardcoded to an empty array *inside* the DLC
			// branch, which left the Asset pack facet permanently empty and
			// broke the pack facet for every asset in the game.
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

		/// <summary>
		/// Cells per kilometre, so a network's per-cell cost reads as a per-km one.
		/// </summary>
		/// <remarks>
		/// Vanilla's own factor — PrefabUISystem binds int2(cost, cost * 125) for
		/// PlaceableNetData — and the shipped UI renders that unit through
		/// Common.VALUE_MONEY_PER_KILOMETER, so 125 cells is a kilometre and a
		/// cell is 8m. Read off the bundle rather than assumed.
		/// </remarks>
		private const float NetCellsPerKilometre = 125f;

		private void PopulateAnalyticalData(Entity entity, PrefabIndex prefabIndex)
		{
			// Networks were excluded here, which is why every one of the 157
			// assets under Roads showed a blank Cost. The rest of this method
			// reads building-only components, so they simply do not match for a
			// network and leave their fields absent.
			if (prefabIndex.Category is not PrefabCategory.Buildings
				and not PrefabCategory.ServiceBuildings
				and not PrefabCategory.Networks)
			{
				return;
			}

			if (EntityManager.TryGetComponent<PlaceableObjectData>(entity, out var placeableData))
			{
				prefabIndex.ConstructionCost = placeableData.m_ConstructionCost;
			}
			else if (EntityManager.TryGetComponent<PlaceableNetData>(entity, out var netData))
			{
				// A network prices by length, not by instance: m_DefaultConstruction
				// Cost is the sum of its composition pieces for ONE cell. Reporting
				// that raw in a column beside a building's total would be wrong by
				// two orders of magnitude, so it is converted to the per-kilometre
				// figure the game itself shows and flagged as a rate — the UI has
				// to say "/km" or the number lies about what it measures.
				prefabIndex.ConstructionCost = (uint)Math.Round(netData.m_DefaultConstructionCost * NetCellsPerKilometre);
				prefabIndex.Upkeep = (int)Math.Round(netData.m_DefaultUpkeepCost * NetCellsPerKilometre);
				prefabIndex.CostIsPerDistance = true;
			}

			if (EntityManager.TryGetComponent<ConsumptionData>(entity, out var consumptionData))
			{
				prefabIndex.Upkeep = consumptionData.m_Upkeep;
				prefabIndex.ElectricityConsumption = consumptionData.m_ElectricityConsumption;
				prefabIndex.WaterConsumption = consumptionData.m_WaterConsumption;
				prefabIndex.GarbageAccumulation = consumptionData.m_GarbageAccumulation;
			}

			if (EntityManager.TryGetComponent<WorkplaceData>(entity, out var workplaceData))
			{
				prefabIndex.Workers = workplaceData.m_MaxWorkers;
			}

			// Zero is not a household count, it is "not residential" — every
			// service building carries this component too. Left null so the
			// card drops the line rather than telling a fire station it houses
			// nobody.
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

			var capacities = new List<int>();
			// Doubles as the Role facet source: these are exactly the service
			// components that make a building a school, a hospital, and so on.
			var roles = new List<string>();
			if (EntityManager.TryGetComponent<SchoolData>(entity, out var schoolData))
			{
				roles.Add("School");
				capacities.Add(schoolData.m_StudentCapacity);
				// The tier the school grants. Without it the UI had to guess the
				// tier from the building's name, which cannot see a modded
				// "Akademie" and silently dropped it from the forecast.
				prefabIndex.EducationLevel = schoolData.m_EducationLevel;
			}

			if (EntityManager.TryGetComponent<HospitalData>(entity, out var hospitalData))
			{
				roles.Add("Hospital");
				capacities.Add(hospitalData.m_PatientCapacity);
			}

			if (EntityManager.TryGetComponent<GarbageFacilityData>(entity, out var garbageFacilityData))
			{
				roles.Add("GarbageFacility");
				capacities.Add(garbageFacilityData.m_GarbageCapacity);
			}

			if (EntityManager.TryGetComponent<FireStationData>(entity, out var fireStationData))
			{
				roles.Add("FireStation");
				capacities.Add(fireStationData.m_FireEngineCapacity);
			}

			if (EntityManager.TryGetComponent<PoliceStationData>(entity, out var policeStationData))
			{
				roles.Add("PoliceStation");
				capacities.Add(policeStationData.m_PatrolCarCapacity);
			}

			if (EntityManager.TryGetComponent<PrisonData>(entity, out var prisonData))
			{
				roles.Add("Prison");
				capacities.Add(prisonData.m_PrisonerCapacity);
			}

			if (EntityManager.TryGetComponent<DeathcareFacilityData>(entity, out var deathcareFacilityData))
			{
				roles.Add("DeathcareFacility");
				capacities.Add(deathcareFacilityData.m_StorageCapacity);
			}

			if (EntityManager.TryGetComponent<EmergencyShelterData>(entity, out var emergencyShelterData))
			{
				roles.Add("EmergencyShelter");
				capacities.Add(emergencyShelterData.m_ShelterCapacity);
			}

			if (EntityManager.TryGetComponent<WaterPumpingStationData>(entity, out var waterPumpingStationData))
			{
				roles.Add("WaterPumpingStation");
				prefabIndex.WaterCapacity = waterPumpingStationData.m_Capacity;
				capacities.Add(waterPumpingStationData.m_Capacity);
			}

			if (EntityManager.TryGetComponent<SewageOutletData>(entity, out var sewageOutletData))
			{
				roles.Add("SewageOutlet");
				prefabIndex.SewageCapacity = sewageOutletData.m_Capacity;
				capacities.Add(sewageOutletData.m_Capacity);
			}

			// Power plants report output as production rather than capacity, so
			// without this a coal plant has no capacity at all and cannot be
			// forecast against the city's electricity demand like every other
			// service. Solar is a separate component with its own field.
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

		/// <summary>
		/// Names every milestone once, so locked assets can carry a bare index.
		/// </summary>
		/// <remarks>
		/// Resolved here rather than in the UI because the modding API's
		/// translate(id, fallback) takes no arguments, and the game's own
		/// milestone name is a parameterised lookup — Progression.MILESTONE_NAME
		/// keyed by index. Doing it at index time also means it follows a
		/// language change for free: OnActiveDictionaryChanged already forces a
		/// full pass.
		/// </remarks>
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

		/// <summary>
		/// The milestone's name in the game's own words, or null.
		/// </summary>
		/// <remarks>
		/// The key is parameterised by index — the game's UI builds it as
		/// <c>`${base}:${index}`</c> (the <c>yc</c> key class in its own
		/// index.js) — so it cannot go through <c>translate(id, fallback)</c>,
		/// which takes no arguments. Asked of the dictionary directly instead.
		///
		/// GetAssetName does not cover this. Its PrefabUISystem title lookup
		/// misses for a milestone prefab and falls through to the prefab name,
		/// which is literally "Milestone7" — so the progression strip and the
		/// progression headings both read "Milestone 7" in every language while
		/// the game's own HUD said "Founding" two inches away.
		/// </remarks>
		private static string? GetMilestoneTitle(int index) =>
			GameManager.instance.localizationManager.activeDictionary
				.TryGetValue($"Progression.MILESTONE_NAME:{index}", out var name)
					? name
					: null;

		/// <summary>
		/// Maps every development-tree node to the branch it belongs to.
		/// </summary>
		/// <remarks>
		/// A service's tree is a free <c>Basic&lt;Service&gt;</c> root with a
		/// handful of chains hanging off it. The BRANCH is the node directly
		/// below the root — walk any node's requirements up until the next step
		/// would be the root, and that is the branch it belongs to.
		///
		/// Why the branch and not the node: measured on the live tree, a node
		/// unlocks one or two buildings, so the seven Electricity nodes would
		/// draw seven tabs of one asset each. The two branches under its root —
		/// Gas (gas, coal, nuclear) and Advanced (geothermal, hydro, solar) —
		/// are the split a player actually thinks in, and the game authored it.
		///
		/// A node can have several parents (Satellite Uplink requires both
		/// Server Farm and Telecom Tower). The first is taken, which keeps the
		/// walk total; a merge point belongs to whichever branch reached it
		/// first, and nothing in the UI depends on that choice being canonical.
		/// </remarks>
		private void IndexDevTreeBranches()
		{
			var query = GetEntityQuery(
				ComponentType.ReadOnly<DevTreeNodeData>(),
				ComponentType.ReadOnly<PrefabData>());
			var nodes = query.ToEntityArray(Allocator.Temp);
			var branches = new Dictionary<Entity, (string Label, string Icon, int Depth)>();
			var roots = new Dictionary<string, (string Label, string Icon, int Depth)>();

			// Ranked per service by the tree's OWN LAYOUT — column first, then
			// row. The column alone leaves siblings tied, and an alphabetical
			// tie-break put Medical University and Technical University above
			// the plain University they specialise. The game lays its siblings
			// out in a deliberate order and draws them that way; reading that
			// order off the layout is the only answer the tree actually gives.
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
					// Then by distance from that trunk. Siblings in a column are
					// drawn around the chain they hang off — the plain University
					// sits between Technical and Medical, on the trunk's own row —
					// so reading rows top to bottom puts a specialisation first.
					// Measuring outward from the trunk takes the generic before
					// the branches, which is the order the player meets them in.
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

				// The node ITSELF, not the chain it hangs off. Collapsing a
				// chain to the branch below the root reads as the game's
				// structure and is not: it filed the Central Intelligence
				// Bureau under "Police Headquarters" because that is what it is
				// reached THROUGH, and the Nuclear Power Plant under "Gas Power
				// Plant" for the same reason. Those are separate unlocks the
				// player buys separately, and a grouping that says otherwise
				// misreports the tree it claims to show.
				var rootLabel = isRoot ? RootBranchLabel(node) : string.Empty;

				branches[node] = isRoot
					? (rootLabel, DevTreeIcon(prefab), 0)
					: (DevTreeBranchName(prefab), DevTreeIcon(prefab), depth);

				// The root also names the bucket for everything the tree never
				// gated, so it is recorded against its service.
				if (isRoot
					&& EntityManager.TryGetComponent<DevTreeNodeData>(node, out var rootData)
					&& _prefabSystem.TryGetPrefab<PrefabBase>(rootData.m_Service, out var rootService))
				{
					roots[rootService.name] = (rootLabel, DevTreeIcon(prefab), 0);
				}
			}

			_devTreeBranches = branches;
			_devTreeRoots = roots;
			Mod.Log.Info($"Indexed Dev Tree: {nodes.Length} nodes, {roots.Count} services");
		}

		/// <summary>
		/// The node's icon, resolved the way the game's own dev tree resolves it.
		/// </summary>
		/// <remarks>
		/// Transcribed from DevTreeUISystem.GetDevTreeIcon: an explicit
		/// m_IconPath wins, otherwise the thumbnail of the prefab the node
		/// points at. Empty rather than a placeholder when there is neither —
		/// the strip decides for itself what an iconless tab looks like, and a
		/// placeholder glyph reads as a broken icon rather than none.
		/// </remarks>
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

		/// <summary>
		/// What the service's free root node is called.
		/// </summary>
		/// <remarks>
		/// The SERVICE's name — Electricity, Water &amp; Sewage, Police &amp;
		/// Administration — because that is what the top bar already calls this
		/// bucket: its tab draws the service's own glyph, the one on the
		/// toolbar icon that opened the menu.
		///
		/// It was the literal word "Basic", which named nothing the player
		/// could see and read as a category the game does not have. The node's
		/// own name is worse still: it has no localized title, so it falls
		/// through to the prefab name and renders "Basic Water&amp;Sewage",
		/// missing the spaces the service's real name has.
		/// </remarks>
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

		/// <summary>
		/// The node's name, without the "Node" the prefab titles all carry.
		/// </summary>
		/// <remarks>
		/// The game's own localized title is "Gas Power Plant Node". The word is
		/// an authoring artefact — the player never sees it in the dev tree,
		/// which draws the node under its icon — so it is dropped rather than
		/// repeated across every tab of the strip.
		/// </remarks>
		private string DevTreeBranchName(PrefabBase prefab)
		{
			var name = GetAssetName(prefab);

			return name.EndsWith(" Node", StringComparison.Ordinal)
				? name.Substring(0, name.Length - " Node".Length)
				: name;
		}

		/// <summary>The label the tree's root carries for a menu, or empty.</summary>
		/// <remarks>
		/// A sentinel more than a name: the adapter replaces it with what the
		/// MENU calls that bucket, which needs the whole set of ungated assets
		/// and so cannot be settled here. See ProjectForMenu.
		/// </remarks>
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

			// No node gated it, so it belongs to the service's free root — the
			// same bucket the game puts the starting kit in. Named after the
			// root node rather than "Other", because it is a real place in the
			// tree and the player can see it there.
			return menu is not null && _devTreeRoots.TryGetValue(menu, out var root)
				? root
				: (string.Empty, string.Empty, 0);
		}

		/// <summary>The name the game gives a milestone index.</summary>
		public static string GetMilestoneName(int index) =>
			_milestoneNames.TryGetValue(index, out var name) ? name : string.Empty;

		/// <summary>Every milestone name, dense by index.</summary>
		/// <remarks>
		/// Sized from the highest index actually present rather than probed one
		/// index at a time until a blank. Probing published an EMPTY table
		/// whenever index 0 had no name — which is the normal shape, since the
		/// game's first milestone is not necessarily index 0 — and an empty
		/// table is what made the progression headings read "Milestone 3"
		/// instead of naming the milestone. Gaps stay empty strings so the
		/// index of every later name is still its own.
		/// </remarks>
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

		/// <summary>
		/// What the game still wants before this asset can be built.
		/// </summary>
		/// <remarks>
		/// Mirrors PrefabUISystem.GetRequirements: collect the transitive
		/// requirements the game itself collects, then take the highest milestone
		/// and name everything else.
		///
		/// Milestones are separated out because they are ordinal and shared —
		/// one index names a milestone every player recognises. Everything else
		/// contributes its own localized title, which covers dev tree nodes and
		/// the requirement prefabs signature buildings hang off without this
		/// having to know one requirement type from another.
		/// </remarks>
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

					// Tutorials are not a requirement the player can act on, and
					// their titles are internal. A census across every locked
					// asset in a live save found TutorialBalloonPrefab was 124 of
					// 362 requirements — the single biggest source of the
					// "Tutorials Intro List New +3" noise this used to print.
					// Vanilla special-cases tutorials too: BindUnlockRequirement
					// tests m_TutorialRequirementEntity before anything else.
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

		/// <summary>
		/// What this building does for the city, phrased for a hover card.
		/// </summary>
		/// <remarks>
		/// Both buffers the game applies: CityModifierData for citywide effects,
		/// LocalModifierData for the ones with a radius. The arithmetic is
		/// vanilla's own — ModifierUIUtils.GetModifierDelta scales a relative
		/// mode by 100 and leaves an absolute one alone — so our numbers agree
		/// with the ones the game prints elsewhere on the same screen.
		///
		/// m_Range.max is the figure vanilla binds. Range carries a min too, but
		/// the effect a player gets from a finished building is the top of it.
		/// </remarks>
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

		/// <summary>
		/// Says what a requirement actually asks of the player.
		/// </summary>
		/// <remarks>
		/// Composed from each requirement's own data, the way vanilla does it in
		/// PrefabUISystem, because the strings do not exist as data: requirement
		/// prefabs carry no localized title, so resolving their names produced
		/// prettified internal ids like "Commercial Zoning Tutorial Low Density".
		///
		/// A census across every locked asset in a live save says which types are
		/// worth composing — dev tree nodes 149, zone built 61, object built 17,
		/// processing 8, citizen 3 — so this covers the five that occur rather
		/// than the eight the game defines.
		/// </remarks>
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
			// ObjectBuiltRequirementPrefab carries a count and nothing else — no
			// m_Requirement, no reference of any kind — so it can only ever say
			// "build 1", which is what made Switchon's card read "build 1 +1".
			// A count with no subject is worse than silence.
			if (prefab is StrictObjectBuiltRequirementPrefab strict && strict.m_Requirement is not null)
			{
				return Format(
					"Requirement.OBJECTS_BUILT",
					"build {0} × {1}",
					strict.m_MinimumCount.ToString("N0"),
					GetAssetName(strict.m_Requirement));
			}

			// ...but silence was too much. Reported by the user: a building
			// gated on a subway depot being placed gave no reason at all.
			//
			// The subject is authored text, not a reference. Every requirement
			// prefab carries m_LabelID, and vanilla binds it for all of them
			// (PrefabUISystem.BindUnlockRequirementProperties) — which is why
			// looking for a reference found nothing and concluded there was
			// nothing to say. Asked here, after the formatters that compose
			// something better from real numbers and before the count-only
			// branch that has to stay quiet.
			var authored = UnlockRequirementLabel.Resolve(
				(prefab as UnlockRequirementPrefab)?.m_LabelID,
				key => GameManager.instance.localizationManager.activeDictionary.TryGetValue(key, out var text) ? text : null);

			if (authored.Length > 0)
			{
				return authored;
			}

			if (EntityManager.TryGetComponent<ObjectBuiltRequirementData>(entity, out var objectBuilt))
			{
				// The prefab names what to build even though it references
				// nothing: "Subway Yard Built Req", "Bus Depot Built Req".
				// Measured across 21 of these in game — every one has an empty
				// m_LabelID, so the name is the only subject there is, and it
				// is the same one vanilla binds beside the count.
				var subject = ObjectBuiltRequirement.SubjectOf(prefab.name);

				if (subject.Length == 0)
				{
					// A name that was only bookkeeping. Silence beats a
					// subjectless "build 1" — the reading that made Switchon's
					// card say "build 1 +1".
					return string.Empty;
				}

				return objectBuilt.m_MinimumCount > 1
					? Format("Requirement.OBJECTS_BUILT", "build {0} × {1}", objectBuilt.m_MinimumCount.ToString("N0"), subject)
					: Format("Requirement.OBJECT_BUILT", "build a {0}", subject);
			}

			// A dev tree node's own name is near-redundant beside the building it
			// unlocks — "Health Research Institute Node" under Health Research
			// Institute. What the player cannot see from the card is where to go
			// and what it costs, so say that instead.
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
			foreach (var grp in BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].GroupBy(x => x.Name))
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

		/// <summary>
		/// Caches the vanilla toolbar's asset menus by entity index, so a menu
		/// selection arriving from the UI can be resolved to a prefab name.
		/// </summary>
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
				// The reverse of names, and it needs the whole Entity rather than
				// the index: opening a menu means handing one back to the game's
				// toolbar.selectAssetMenu trigger, and an Entity without its
				// version is not a valid handle.
				entities[prefab.name] = menus[i];

				prefab.TryGet<UIObject>(out var uIObject);

				// Same record as a category tab, because a menu is the tier above
				// one and the picker wants exactly the same four fields. Priority
				// is UIObject.m_Priority, defaulted to 0 as vanilla does — note
				// that the bottom bar also sorts by toolbar GROUP first, which is
				// not modelled here, so this is the game's order within a group
				// rather than across the whole bar.
				list.Add(new VanillaMenuCategory(
					Id: prefab.name,
					Name: prefab.name,
					Icon: IconPath.Normalize(uIObject?.m_Icon ?? ImageSystem.GetIcon(prefab)) ?? string.Empty,
					Priority: uIObject?.m_Priority ?? 0));
			}

			list.Sort((left, right) => left.Priority.CompareTo(right.Priority));

			_assetMenuNames = names;
			_assetMenuEntities = entities;
			_assetMenus = list;
			Mod.Log.Info($"Indexed Asset Menus Count: {_assetMenuNames.Count}");
		}

		/// <summary>
		/// Caches each menu's category tabs, which are vanilla's second tier.
		/// </summary>
		/// <remarks>
		/// Deliberately the same shape as IndexAssetMenus above: query the data
		/// component the game itself groups by, resolve the managed prefab, read
		/// its name. A category that names no menu is not a build-menu tab —
		/// UIAssetCategoryPrefab.GetPrefabComponents only adds UIAssetCategoryData
		/// when m_Menu is set, so this is belt and braces rather than a real case.
		/// </remarks>
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

				// A category with no members is not a tab. Vanilla drops these in
				// GetSortedCategories (ToolbarUISystem.cs:335-347) before it binds
				// the row, so showing one is showing something the game hides.
				//
				// Not hypothetical: Transportation ships a ferry category that is
				// empty in a base-game save, and it surfaced as a tab whose icon
				// really is Media/Placeholder.svg — the game never intended anyone
				// to see it, so it never gave it an icon.
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
					Icon: IconPath.Normalize(uIObject?.m_Icon ?? ImageSystem.GetIcon(prefab)) ?? string.Empty,
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

			// One pass over the buildings rather than a rescan per zone. This
			// also yields the lot sizes each zone can actually fill, which is
			// what the row-housing test was really asking about and which the
			// game never tells the player: some zones only ever grow 2x2.
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

				// The ZONE'S OWN tier, which is what the zoning menu navigates
				// by: six tiers, from the same fields plus the two the
				// four-tier derivation below cannot express. Computed for every
				// zone including the ones the building-side answer skips.
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
					// Identical to the old scan: "no spawnable building wider
					// than 2" is exactly "the widest is at most 2". A zone with
					// no spawnable buildings at all stays row, as before.
					dictionary[zone] = maxLotWidth <= 2 ? ZoneTypeFilter.Row : ZoneTypeFilter.Medium;
				}
				else
				{
					dictionary[zone] = ZoneTypeFilter.High;
				}
			}

			_zoneTypeCache = dictionary;
			_zoneDensityCache = densities;

			// The same pass that classifies buildings by zone also yields the
			// zones themselves, which the zoning hierarchy browses. Family comes
			// from ZoneData rather than the prefab name, and density from the
			// derivation just performed rather than from a name heuristic.
			var catalog = new List<ZoneCatalogEntry>();

			for (var i = 0; i < zones.Length; i++)
			{
				var zone = zones[i];

				if (!_prefabSystem.TryGetPrefab<PrefabBase>(zone, out var prefab) || prefab?.name is null)
				{
					continue;
				}

				// The zone's own data first, which is Find It's method applied
				// here: ZoneData.m_AreaType plus ZoneFlags.Office is what the
				// game itself switches on, and ZonePrefab derives its
				// "ZonesOffice"/"Zones{AreaType}" tags from exactly the same two
				// fields. An earlier comment here claimed the UIObject group was
				// the only source separating Office from Commercial; that was a
				// leftover from assuming office zones were commercial-area, and
				// the flag has been doing the work since.
				//
				// The query requires ZoneData, so the fallbacks only run for a
				// zone whose AreaType is None — which the data does not
				// distinguish at all.
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
					// One source for the tier, shared with the prefab index. This
					// used to re-derive it here — the four-tier dictionary, then
					// a name fallback — which is how the catalog and the index
					// could have answered differently for the same zone.
					// ZoneDensityClassifier owns the rules now, including the
					// name fallback for commercial and office.
					Density: GetZoneDensity(zone),
					Thumbnail: IconPath.Normalize(ImageSystem.GetThumbnail(prefab)),
					// Measured by the game, never shown by it. ZoneSystem seeds
					// MaxHeight to zero and BuildingInitializeSystem raises it to
					// the tallest mesh of every spawnable building the zone can
					// grow, so this answers "how tall does this get" from real
					// geometry rather than from the tier's name.
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

			// The menu is the authority. It lists nine specialised industries —
			// Grain Farming, Livestock Farming, Textile Fiber Farming, Vegetable
			// Farming, Forestry, Coal/Ore/Stone Mining, Oil Drilling — and those
			// are what the player can actually pick.
			//
			// The component query is only a fallback for the day the walk stops
			// working. It finds the four underlying extractor LOTS, one per
			// MapFeature, which vanilla does NOT put in the menu; showing them
			// alongside the nine would offer four things the Zones menu never
			// offered, which is the opposite of mirroring it.
			if (!InheritVanillaZoneMenu(catalog))
			{
				Mod.Log.Warn("Zones menu inherited nothing; falling back to the extractor query.");
				IndexExtractorAreas(catalog);
			}

			_zoneCatalog = catalog;
			Mod.Log.Info($"Indexed Zones Count: {_zoneCatalog.Count}");
		}

		/// <summary>
		/// Every assignable zone, grouped by family in the zoning hierarchy.
		/// </summary>

		/// <summary>
		/// Take the Zones menu's categories and members from the game itself.
		/// </summary>
		/// <remarks>
		/// The surface used to be assembled from ECS component queries — zones by
		/// ZoneData, then extractor areas by ExtractorAreaData — and that can
		/// never reproduce the menu, because membership is not in components.
		/// Vanilla's Extractors tab lists NINE resource-specific assets
		/// (Livestock, Grain, Vegetables, Cotton, Wood, Stone, Coal, Ore, Oil,
		/// read off the live menu by their Media/Game/Resources icons), while a
		/// query on ExtractorAreaData finds four feature-level lots. And
		/// "ZonesExtractors" appears nowhere in the game's code: the tag is
		/// assigned in asset data through ManualUITagsConfiguration, so no
		/// component predicate can name it.
		///
		/// So the categories are inherited instead. The walk that already backs
		/// the coverage report — UIAssetMenuData -> UIGroupElement categories ->
		/// their members — is the same one ToolbarUISystem uses to draw the menu,
		/// so whatever the game puts under Zones appears here too, including
		/// anything a mod adds later. The existing GroupFamilies map already
		/// speaks the category names (ZonesResidential ... ZonesExtractors); it
		/// only ever lacked a caller that walked the tree.
		///
		/// Entries the zone pass already produced are left alone: they carry
		/// density, footprints and allowed resources that this walk cannot know.
		/// This adds what the menu has and the queries missed.
		/// </remarks>
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
			// vanilla never shows is one the player cannot use, so this is the
			// list to justify or drop.
			var placedInZones = new HashSet<int>(
				_menuPlacements.Values
					.Where(p => string.Equals(p.Menu?.Trim(), "Zones", StringComparison.OrdinalIgnoreCase))
					.Select(p => p.Entity.Index));
			var unplaced = catalog.Where(entry => !placedInZones.Contains(entry.Id)).ToList();

			Mod.Log.Info(
				$"[ZONE-PARITY] vanilla places {placedInZones.Count} in Zones; dropping {unplaced.Count} it does not offer: "
				+ string.Join(" | ", unplaced.Select(entry => $"{entry.Name} [{entry.PrefabName}]")));

			// Show what the game shows, and nothing else.
			//
			// The ZoneData query is broader than the menu: it returns every zone
			// prefab that exists, including ones the player can never pick.
			// Reported from play as "the area hub zones are not actually
			// buildable", and the walk proves it — Industrial Agriculture,
			// Industrial Forestry, Industrial Ore and Industrial Oil are zone
			// prefabs the specialised-industry system uses internally and vanilla
			// never places in a menu. The six theme-less base zones (Residential
			// Low/Medium/High/Mixed, Commercial Low/High) are unplaced for the
			// same reason: the menu offers their EU and NA variants instead.
			//
			// Only applied when the walk actually found the menu. If it ever
			// stops working, an over-broad catalog beats an empty one.
			catalog.RemoveAll(entry => !placedInZones.Contains(entry.Id));

			return added > 0;
		}

		/// <summary>
		/// The specialised industries, which are areas rather than zones.
		/// </summary>
		/// <remarks>
		/// Grain, livestock and cotton are not zones and never could be:
		/// <c>Game.Zones.AreaType</c> has only None, Residential, Commercial and
		/// Industrial, so there is no specialised zone type for them to be. They
		/// are LotPrefabs carrying <c>ExtractorArea</c>
		/// (<c>[ComponentMenu("Areas/", typeof(LotPrefab))]</c>), holding a
		/// <c>MapFeature</c>, and the Area tool places them.
		///
		/// The zone query requires ZoneData, so it can never return one — a fact
		/// ZoningSurface has documented all along while leaving the Extractors
		/// family unreachable. Reported from play as "the specialized industrial
		/// zones just zone industrial": the four industrial ZONES the surface did
		/// show are real, and painting them really does lay industrial cells, but
		/// the areas the player was looking for were absent from the whole index.
		/// Searching the entire catalog for grain, livestock, cotton or textile
		/// returned nothing at all.
		///
		/// They join the zone catalog rather than getting their own binding
		/// because the player reaches both the same way — by opening Zones and
		/// looking for the industry they want. The Extractors family already
		/// exists, with an icon and a tooltip, and only ever lacked members.
		/// </remarks>
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
		/// What the game's own toolbar filter row knows about a prefab.
		/// </summary>
		/// <remarks>
		/// Deliberately identity-free: it records WHICH requirement and pack
		/// entities an asset carries, never which themes or packs those are. A
		/// mod that ships a new theme or a new asset pack therefore needs no
		/// change here — its entities flow through the same comparison as
		/// vanilla's, because vanilla's own filter compares entities too.
		///
		/// Transcribed from ToolbarUISystem: the theme half reads the
		/// ObjectRequirementElement buffer and keeps the requirements that carry
		/// ThemeData (FilterByThemes, :1357), NOT ThemeObject.m_Theme, which is a
		/// different fact and is what the building indexer reads for its own
		/// facet.
		/// </remarks>
		private void SeedPlacedUniques()
		{
			if (_uniqueAssets is null)
			{
				PlacedUniqueRegistry.Reset(null);
				return;
			}

			var placed = _uniqueAssets.placedUniqueAssets;

			if (!placed.IsCreated)
			{
				PlacedUniqueRegistry.Reset(null);
				return;
			}

			using var entities = placed.ToNativeArray(Allocator.Temp);
			var ids = new List<int>(entities.Length);

			for (var i = 0; i < entities.Length; i++)
			{
				ids.Add(entities[i].Index);
			}

			PlacedUniqueRegistry.Reset(ids);
			Mod.Log.Info($"Placed unique assets: {PlacedUniqueRegistry.Count}");
		}

		/// <summary>Keeps the placed-unique set in step with the city.</summary>
		/// <remarks>
		/// Fires on both edges — true when one is built or loaded, false when
		/// one is bulldozed — so the state goes stale in neither direction.
		/// The catalog is refreshed rather than re-indexed: nothing about the
		/// PREFAB changed, only what the city holds.
		/// </remarks>
		private void OnUniqueAssetStatusChanged(Entity prefab, bool placed)
		{
			PlacedUniqueRegistry.Set(prefab.Index, placed);
			IndexGeneration++;
			_menuUISystem?.RefreshBuildingCatalogFromIndexing();
		}

		/// <summary>Names a pack for <see cref="AssetPackRegistry"/>.</summary>
		/// <remarks>
		/// Recorded as the packs are walked, because this is the one place both
		/// halves of the entity are in hand. The registry is wider than the
		/// game's own Pack row by design: ToolbarUISystem.BindPacks builds that
		/// row from the selected CATEGORY, so it offers the packs in the
		/// category you are looking at — measured in Parks &amp; Recreation it
		/// offered two while the menu held four, and the two it left out had
		/// three assets each. Same axis, narrower view.
		/// </remarks>
		private void RecordAssetPack(Entity pack)
		{
			AssetPackRegistry.Record(
				pack.Index,
				pack.Version,
				_prefabSystem.TryGetPrefab<PrefabBase>(pack, out var packPrefab)
					? GetAssetName(packPrefab)
					: string.Empty);
		}

		/// <summary>
		/// The upgrades a building supports, in the order vanilla offers them.
		/// </summary>
		/// <remarks>
		/// The reverse of the extension self-tag above, and a different question:
		/// this is what can be ATTACHED to the building, which is what the hover
		/// card's upgrades row asks for.
		///
		/// UpgradeMenuUISystem is the reference, and it reads TWO buffers off the
		/// building prefab rather than one — BuildingUpgradeElement for service
		/// upgrades, BuildingModule for the modules a modular building takes.
		/// Signature towers are the second kind, which is why reading only the
		/// ServiceUpgrade side found none of them and every signature reported no
		/// upgrades at all.
		///
		/// Both are filtered on UIObjectData exactly as vanilla filters them (an
		/// upgrade the game never draws is not one the player can attach) and
		/// ordered by its m_Priority, so the names appear in the order the upgrade
		/// menu itself would list them.
		/// </remarks>
		private string[] GetSupportedUpgrades(Entity entity)
		{
			List<(int Priority, string Name)> found = null;

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
				return Array.Empty<string>();
			}

			// OrderBy, not Sort: it is stable, so two upgrades sharing a priority
			// keep the order the game's own buffers hold them in.
			return found.OrderBy(entry => entry.Priority).Select(entry => entry.Name).ToArray();
		}

		private void CollectUpgrade(Entity upgrade, ref List<(int Priority, string Name)> found)
		{
			if (!EntityManager.TryGetComponent<UIObjectData>(upgrade, out var ui))
			{
				return;
			}

			if (!_prefabSystem.TryGetPrefab<PrefabBase>(upgrade, out var prefab) || prefab?.name is null)
			{
				return;
			}

			(found ??= new List<(int Priority, string Name)>()).Add((ui.m_Priority, GetAssetName(prefab)));
		}

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

			// IsModAsset, and the second half of it is easy to get backwards: an
			// asset carrying ModPrerequisiteData is NOT a mod asset when one of
			// its packs carries it too — vanilla returns false there, so the pack
			// filter governs it instead of the Mods toggle (ToolbarUISystem:963).
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


		/// <summary>
		/// The zone catalog as the game's own toolbar row would show it.
		/// </summary>
		/// <remarks>
		/// Zones are where this actually bites. Most buildings carry no theme
		/// requirement, so the EU/NA toggle changes almost nothing in a building
		/// menu — but every growable zone comes in an EU and an NA variant, and
		/// the Zones menu was the surface the report named (cm-2xvs.3): the
		/// toggle filtered vanilla's grid and left ours showing both.
		///
		/// A zone with no recorded facts stays visible. "We were never told" has
		/// to read as unfiltered, the same way it reads as unlocked elsewhere,
		/// or a gap in indexing would silently empty the menu.

		/// <summary>
		/// The prefab name of a vanilla toolbar asset menu, by entity index.
		/// </summary>
		/// <remarks>
		/// The UI can read the game's toolbar.selectedAssetMenu binding but only
		/// receives an entity, and entity indices are runtime values that must
		/// not be persisted. Resolving the name belongs here, where the prefab
		/// system is available.
		/// </remarks>
		/// <summary>The tab strip for a menu, empty when the menu has none.</summary>
		/// <remarks>
		/// Roads gets more tabs than the game gives it. The lens gathers every
		/// network there (see <see cref="NetworkMenuExtension"/>), so the strip has
		/// to offer the extras too — otherwise the menu holds three hundred assets
		/// and the only way past the roads is to scroll.
		/// </remarks>
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

		/// <summary>
		/// A tab for each kind of network the Roads menu does not already hold.
		/// </summary>
		/// <remarks>
		/// Built from what is actually indexed rather than from the enum, so a
		/// subcategory with nothing in it draws no tab — the same rule vanilla
		/// applies in GetSortedCategories, and the one that stopped Transportation
		/// showing an empty ferry tab with a placeholder icon.
		///
		/// Ids match what NetworkMenuExtension.Reframe writes onto the entries, so
		/// picking a tab selects the group beneath it. Icons come from the
		/// subcategory's own CategoryIcon, which is the same art the unscoped
		/// filter rail draws for it.
		/// </remarks>
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

				// Only the ones that arrive through the extension. A subcategory
				// whose members are all in the Roads menu already has vanilla tabs
				// covering them, and a second tab over the same assets would split
				// the roads in two.
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

		/// <summary>
		/// Every vanilla menu that has something in it, in the game's order.
		/// </summary>
		/// <remarks>
		/// Filtered to menus with at least one category tab, which is the same
		/// test vanilla applies before drawing one: a menu whose categories are
		/// all empty is a button the game itself hides.
		/// </remarks>
		public static IReadOnlyList<VanillaMenuCategory> GetAssetMenus() =>
			_assetMenus.Where(menu => _assetCategories.ContainsKey(menu.Id)).ToArray();

		public static string? GetAssetMenuName(int entityIndex) => _assetMenuNames.TryGetValue(entityIndex, out var name)
			? name
			: null;

		/// <summary>
		/// The name of a single allowed resource, or null.
		/// </summary>
		/// <remarks>
		/// Resource is a <c>ulong</c> flags enum. Its zero is NoResource, which
		/// ToString()s as "NoResource" — a string the player would read as a
		/// kind of resource rather than as its absence. Worse, a composite value
		/// has no name at all and ToString()s as the raw number: a commercial
		/// zone sells most things, and the card read "sells 428424300332".
		///
		/// So only a single flag is named. That is also the only case worth
		/// stating — "this industrial zone makes Oil" tells the player
		/// something, while "this commercial zone sells almost everything" is
		/// what they already assume.
		/// </remarks>
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

		/// <summary>The zone's own density tier. Any when it has none.</summary>
		/// <remarks>
		/// Fails soft like <see cref="GetZoneType"/>, and for the same reason —
		/// but note what that costs here: a cold read is indistinguishable from
		/// an untiered zone, which is exactly how every zone shipped Any before
		/// this existed.
		///
		/// The order is safe and was traced rather than assumed. IndexZones
		/// runs inside RunIndex's full branch and assigns this cache before the
		/// prefab category processors start, and
		/// ZonedBuildingPrefabCategoryProcessor already reads the sibling cache
		/// from that same point — which is the standing evidence that it is
		/// warm there.
		/// </remarks>
		public static ZoneTypeFilter GetZoneDensity(Entity zonePrefab)
		{
			if (_zoneDensityCache != null && _zoneDensityCache.TryGetValue(zonePrefab, out var density))
			{
				return density;
			}

			return ZoneTypeFilter.Any;
		}

		/// <summary>
		/// How many cars the asset can park, counted rather than merely detected.
		/// </summary>
		/// <remarks>
		/// A boolean could not answer the question anyone actually asks. It also
		/// made sorting by Parking a no-op, because every entry tied.
		///
		/// EXACT for an object's own lanes, which is what a parking lot has.
		/// The game's count is NetUtils.GetParkingSlotCount, floor((slotSpace +
		/// 0.01) / slotInterval), and slotSpace trims the curve only when
		/// ParkingLaneFlags.FindConnections is CLEAR. LaneSystem.CreateObjectLane
		/// — the path every object sub-lane takes — sets StartingLane, EndingLane
		/// and FindConnections together, so the trimming branch never runs and
		/// slotSpace is the raw curve length. The same arithmetic therefore
		/// reproduces the placed count rather than approximating it.
		///
		/// An earlier version of this comment called the figure approximate, on
		/// the assumption that the runtime flags were unknowable. They are
		/// knowable: they are unconditional for this path.
		///
		/// The interval is derived exactly as NetInitializeSystem bakes it from
		/// the lane's slot size and angle, so at least that half is the game's.
		/// </remarks>
		private int GetParkingSlots(PrefabBase prefab)
		{
			var slots = 0;

			// A garage parks cars inside rather than along marked lanes, so it
			// has no sub-lanes to divide up and declares its capacity outright.
			// Counting its spawn point as one space made the Automated Parking
			// Building — a multi-storey car park — report a single bay, which
			// the live table showed plainly.
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

					// A lane with no slot width is Virtual (NetInitializeSystem:1608),
					// and the game's own capacity sum skips those —
					// RoadsInfoviewUISystem drops VirtualLane before adding slots.
					// Two of the three interval branches already yield 0 for such
					// a lane and fall out below, but a slot angle near zero takes
					// the interval from slotSize.y and would have counted bays the
					// game does not.
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

		/// <summary>
		/// The spacing between bays, derived the way the game bakes it.
		/// </summary>
		/// <remarks>
		/// Transcribed from NetInitializeSystem, which computes this into
		/// ParkingLaneData.m_SlotInterval from the managed component's slot size
		/// and angle. Deriving it here rather than reading the baked component
		/// keeps this to the managed prefab graph the rest of the walk uses.
		/// </remarks>
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
