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
using BetterBuildingMenu.Utilities.PrefabCategoryProcessor;

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

using Unity.Collections;
using Unity.Entities;
using Unity.Mathematics;

namespace BetterBuildingMenu.Systems
{
	public partial class PrefabIndexingSystem : GameSystemBase
	{
		private PrefabSystem _prefabSystem = null!;
		private ResourceSystem _resourceSystem = null!;
		private ImageSystem _imageSystem = null!;
		private PrefabUISystem _prefabUISystem = null!;
		private HashSet<string> _blackList = null!;
		// Road Builder's mark on a road it has thrown away, once found. See RefreshModCompatibility.
		private ComponentType? _roadBuilderDiscarded;
		private bool _warnedRoadBuilderDiscarded;
		// Empty until IndexZones fills it, which reads the same as a zone it has no entry for.
		private static Dictionary<Entity, ZoneTypeFilter> _zoneTypeCache = new();

		/// <summary>Density per ZONE prefab: the zone's own tier, which adds Mixed and LowRent.</summary>
		/// <remarks>Kept apart from <see cref="_zoneTypeCache"/>, which classifies a zone so its
		/// buildings can be filtered; widening that one would reclassify thousands of buildings.</remarks>
		private static Dictionary<Entity, ZoneTypeFilter> _zoneDensityCache = new();

		/// <summary>The lot shapes each zone actually grows, by zone prefab.</summary>
		/// <remarks>Cached because IndexZones computes it before the processor loop that builds each
		/// zone's PrefabIndex, and the entry needs it there.</remarks>
		private static Dictionary<Entity, ZoneLotSizes> _zoneLotSizeCache = new();
		private EntityQuery _unlockEventQuery;
		// Prefabs the game created or changed this frame — the incremental
		// pass's own trigger. A field rather than a RequireForUpdate gate,
		// which would hold the system shut for unlock events too.
		private EntityQuery _changedPrefabQuery;
		// One full pass per settled burst of dictionary changes, at once for a
		// language change. See OnActiveDictionaryChanged.
		private readonly LocaleReindexPolicy _localeReindex = new(TimeSpan.FromSeconds(1));
		private static readonly System.Diagnostics.Stopwatch IndexClock = System.Diagnostics.Stopwatch.StartNew();
		// Set by the OnGameLoaded pass, cleared at preload, read at loading-
		// complete to decide whether a second full pass is owed. See there.
		private bool _indexedAtGameLoaded;
		// Whether this load's census and menu audit are in the log yet. See RunIndex.
		private bool _auditedThisLoad;
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
		// root is called "Basic", so a label-keyed icon would collide. A branch also
		// names the service whose tree it sits in; see DevTreeGates.
		private Dictionary<Entity, (string Label, string Icon, int Depth, string Service)> _devTreeBranches = new();
		private static Dictionary<string, (string Label, string Icon, int Depth)> _devTreeRoots = new();
		// Each processor with its query, and that query narrowed to prefabs created or changed this
		// frame, which is all a partial pass reads. Built once, in OnCreate.
		private readonly List<(IPrefabCategoryProcessor Processor, EntityQuery All, EntityQuery Changed)> _processors = new();

		/// <summary>Bumped whenever an indexed fact changes: a re-index, an unlock, a unique built or
		/// bulldozed. The catalog's snapshot cache is keyed on it, so a stale projection cannot outlive
		/// the change that staled it, and the panel polls it to know when to republish.</summary>
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

			// In the order PrefabCategoryProcessors lists them, the same on every build.
			var processors = PrefabCategoryProcessors.Create(new(EntityManager, _imageSystem, _prefabSystem));

			foreach (var processor in processors)
			{
				_processors.Add((
					processor,
					GetEntityQuery(processor.GetEntityQuery()),
					GetEntityQuery(ChangedOnly(processor.GetEntityQuery()))));
			}

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
			_auditedThisLoad = false;
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
			// A pass that failed leaves loading-complete to run its own.
			_indexedAtGameLoaded = RunIndex(true);
			Enabled = true;
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

			if (_uniqueAssets is not null)
			{
				_uniqueAssets.EventUniqueAssetStatusChanged -= OnUniqueAssetStatusChanged;
			}

			base.OnDestroy();
		}

		/// <summary>A full pass when the dictionary changes: at once for a new language, once the
		/// sources settle for anything else.</summary>
		/// <remarks>Names are resolved at index time and cached, so only a full pass follows a language
		/// change. The game raises this for every source a mod adds too, on the main thread already;
		/// those are coalesced by LocaleReindexPolicy and fired from OnUpdate, so a burst is one pass.</remarks>
		private void OnActiveDictionaryChanged()
		{
			var localeId = GameManager.instance.localizationManager.activeLocaleId;

			if (_localeReindex.Observe(localeId, IndexClock.Elapsed) == LocaleReindexDecision.Immediate)
			{
				Mod.Log.Info($"Full pass at locale change (locale={localeId})");
				RunIndex(true);
			}
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

			if (_localeReindex.TryFireDeferred(IndexClock.Elapsed))
			{
				Mod.Log.Info("Full pass after dictionary sources settled");
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
				if ((prefab.Thumbnail ?? prefab.FallbackThumbnail) is not { Length: > 0 } thumbnail)
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

		/// <summary>Re-reads the mods the processors adapt to, before the pass that reads them.</summary>
		/// <remarks>
		/// Every full pass, the first included; see docs/indexing.md, "Load timing". The type is
		/// looked up among the loaded assemblies, so a renamed one is logged once and filters
		/// nothing rather than throwing into the game's load.
		/// </remarks>
		private void RefreshModCompatibility()
		{
			try
			{
				Mod.RefreshEnabledMods();
			}
			catch (Exception ex)
			{
				// The last answer stands; a pass is worth more than knowing a mod joined.
				Mod.Log.Warn(ex, "Could not read the enabled mods; keeping the last answer");
			}

			if (_roadBuilderDiscarded.HasValue || !Mod.IsRoadBuilderEnabled)
			{
				return;
			}

			Exception? failure = null;

			try
			{
				var type = AppDomain.CurrentDomain.GetAssemblies()
					.FirstOrDefault(assembly => assembly.GetName().Name == "RoadBuilder")
					?.GetType("RoadBuilder.Domain.Components.DiscardedRoadBuilderPrefab", throwOnError: false);

				if (type is not null)
				{
					_roadBuilderDiscarded = new ComponentType(type, ComponentType.AccessMode.ReadOnly);
					return;
				}
			}
			catch (Exception ex)
			{
				failure = ex;
			}

			if (_warnedRoadBuilderDiscarded)
			{
				return;
			}

			_warnedRoadBuilderDiscarded = true;
			const string message = "Road Builder is enabled, but its DiscardedRoadBuilderPrefab could not be read; roads it discards stay listed";

			if (failure is null)
			{
				Mod.Log.Warn(message);
			}
			else
			{
				Mod.Log.Warn(failure, message);
			}
		}

		/// <summary>Narrows a processor's query to prefabs created or changed this frame.</summary>
		/// <remarks>Edits the descriptions in place, so it is handed a copy of its own: processors build
		/// new ones on every call. A description with an Any of its own is left whole, since it cannot
		/// take a second; that processor's partial passes read everything it matches.</remarks>
		private static EntityQueryDesc[] ChangedOnly(EntityQueryDesc[] descs)
		{
			foreach (var desc in descs)
			{
				if (desc.Any is not { Length: > 0 })
				{
					desc.Any = new[] { ComponentType.ReadOnly<Created>(), ComponentType.ReadOnly<Updated>() };
				}
			}

			return descs;
		}

		/// <returns>False when a full pass threw and the previous index was kept.</returns>
		private bool RunIndex(bool full)
		{
			var stopWatch = Stopwatch.StartNew();
			var census = new Dictionary<string, List<int>>(StringComparer.Ordinal);
			// A full pass rebuilds everything the panel reads. One that threw halfway would leave
			// it half-built and throw into the game's load or locale dispatch, so the old index is
			// put back instead. See docs/indexing.md, "A pass that fails".
			var previous = full ? CaptureIndex() : null;

			try
			{
				BuildIndex(full, census);
			}
			catch (Exception ex) when (previous is not null)
			{
				RestoreIndex(previous);
				Mod.Log.Error(ex, "Full prefab indexing failed; the previous index stands");

				return false;
			}

			BuildingMenuUtil.IsReady = true;
			IndexGeneration++;

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
				PrimeSilhouettes();

				// Once per load, at Info so a player's log carries it: a language change
				// or a lock-state recheck repeats the pass, not the menus it reports on.
				// Every pass with Debug on.
				if (!_auditedThisLoad || Mod.Log.isLevelEnabled(Level.Debug))
				{
					_auditedThisLoad = true;

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

					// A prefab two processors claimed keeps the later one's category,
					// whatever the earlier one decided. Each pair is named once.
					foreach (var overlap in ProcessorOverlap.Find(_processors.Select(entry => entry.Processor.GetType().Name), census))
					{
						var example = all.TryGetValue(overlap.ExampleId, out var indexed) ? indexed.PrefabName : overlap.ExampleId.ToString(CultureInfo.InvariantCulture);

						Mod.Log.Info($"[PROCESSOR-OVERLAP] {overlap.Later} replaced {overlap.Earlier} for {overlap.Count} prefab(s), e.g. {example}");
					}

					LogVanillaMenuCoverage();
					LogVanillaMenuAudit();
				}

				// Whatever brought this pass about, the names are now this locale's.
				_localeReindex.MarkIndexed(GameManager.instance.localizationManager.activeLocaleId);
			}

			return true;
		}

		/// <summary>Everything a pass writes to the index.</summary>
		private void BuildIndex(bool full, Dictionary<string, List<int>> census)
		{
			if (full)
			{
				RefreshModCompatibility();

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

			foreach (var (processor, allQuery, changedQuery) in _processors)
			{
				if (full)
				{
					Mod.Log.Debug($"Indexing prefabs with {processor.GetType().Name}");
				}

				try
				{
					// A partial pass reads only what changed. The full query would re-index
					// every road on the main thread for one Road Builder edit.
					var query = full ? allQuery : changedQuery;

					if (!full && query.IsEmptyIgnoreFilter)
					{
						continue;
					}

					var entities = query.ToEntityArray(Allocator.Temp);

					if (full)
					{
						Mod.Log.Debug($"\tTotal Entities Count: {entities.Length}");
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

						PrefabIndex? prefabIndex = null;

						try
						{
							if (_roadBuilderDiscarded.HasValue && EntityManager.HasComponent(entity, _roadBuilderDiscarded.Value))
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
								if (prefab.TryGet<EditorAssetCategoryOverride>(out var overrides) && overrides is not null)
								{
									var categoryOverride = FindItCategoryOverride.Read(overrides.m_IncludeCategories, overrides.m_ExcludeCategories);

									// An author's exclusion is honoured only for assets the game does
									// not itself place in a menu. Removed as well as skipped, so a
									// partial pass drops what an earlier pass indexed.
									if (categoryOverride.Excluded && !IsPlacedInVanillaMenu(entity.Index))
									{
										BuildingMenuUtil.RemoveItem(entity);

										continue;
									}

									if (categoryOverride is { Category: { } category, SubCategory: { } subCategory })
									{
										prefabIndex.Category = category;
										prefabIndex.SubCategory = subCategory;
									}

									if (categoryOverride.PdxModsId is not null)
									{
										prefabIndex.PdxModsId = categoryOverride.PdxModsId;
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
							else if (Mod.Log.isLevelEnabled(Level.Debug))
							{
								Mod.Log.Debug($"\t\tSkipped: {prefab.name}");
							}
						}
						catch (Exception ex)
						{
							Mod.Log.Error(ex, $"Prefab indexing failed for prefab '{prefab.name}'" + (prefabIndex?.PdxModsId is { Length: > 0 } pdxModsId ? $" (Pdx Mods ID: {pdxModsId})" : ""));
						}
					}
				}
				catch (Exception ex)
				{
					Mod.Log.Error(ex, $"Prefab indexing failed for processor {processor.GetType().Name}");
				}
			}

			// Partial passes too: one re-read prefab takes back its plain name, and its
			// namesakes' numbers are only right if all of them are counted again.
			AddNumberToDuplicatePrefabNames();

			if (full)
			{
				CleanupBrandPrefabs();
			}
		}

		/// <summary>What a full pass replaces, held so a pass that throws can put it back.</summary>
		/// <remarks>References are enough: each Index* step builds new collections and assigns them
		/// at its end, and AddAllCategories gives every category new lists, so a pass never writes to
		/// the old ones.</remarks>
		private sealed record IndexSnapshot(
			KeyValuePair<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>>[] Categories,
			Dictionary<int, VanillaMenuPlacement> MenuPlacements,
			Dictionary<int, VanillaAssetFacts> ZoneFacts,
			Dictionary<Entity, ZoneTypeFilter> ZoneTypes,
			Dictionary<Entity, ZoneTypeFilter> ZoneDensities,
			Dictionary<Entity, ZoneLotSizes> ZoneLotSizes,
			List<ZoneCatalogEntry> ZoneCatalog,
			Dictionary<int, string> AssetMenuNames,
			Dictionary<string, Entity> AssetMenuEntities,
			IReadOnlyList<VanillaMenuCategory> AssetMenus,
			Dictionary<string, List<VanillaMenuCategory>> AssetCategories,
			Dictionary<int, string> MilestoneNames,
			Dictionary<Entity, (string Label, string Icon, int Depth, string Service)> DevTreeBranches,
			Dictionary<string, (string Label, string Icon, int Depth)> DevTreeRoots);

		private IndexSnapshot CaptureIndex() => new(
			BuildingMenuUtil.CategorizedPrefabs.ToArray(),
			_menuPlacements,
			_zoneFacts,
			_zoneTypeCache,
			_zoneDensityCache,
			_zoneLotSizeCache,
			_zoneCatalog,
			_assetMenuNames,
			_assetMenuEntities,
			_assetMenus,
			_assetCategories,
			_milestoneNames,
			_devTreeBranches,
			_devTreeRoots);

		private void RestoreIndex(IndexSnapshot snapshot)
		{
			BuildingMenuUtil.CategorizedPrefabs.Clear();

			foreach (var pair in snapshot.Categories)
			{
				BuildingMenuUtil.CategorizedPrefabs[pair.Key] = pair.Value;
			}

			// Before the first pass there is no index to keep. An empty one, laid out, is what
			// every reader of CategorizedPrefabs expects to find.
			if (snapshot.Categories.Length == 0)
			{
				AddAllCategories();
			}

			_menuPlacements = snapshot.MenuPlacements;
			_zoneFacts = snapshot.ZoneFacts;
			_zoneTypeCache = snapshot.ZoneTypes;
			_zoneDensityCache = snapshot.ZoneDensities;
			_zoneLotSizeCache = snapshot.ZoneLotSizes;
			_zoneCatalog = snapshot.ZoneCatalog;
			_assetMenuNames = snapshot.AssetMenuNames;
			_assetMenuEntities = snapshot.AssetMenuEntities;
			_assetMenus = snapshot.AssetMenus;
			_assetCategories = snapshot.AssetCategories;
			_milestoneNames = snapshot.MilestoneNames;
			_devTreeBranches = snapshot.DevTreeBranches;
			_devTreeRoots = snapshot.DevTreeRoots;
		}

		private void AddPrefab(PrefabBase prefab, Entity entity, PrefabIndex prefabIndex)
		{
			prefabIndex.Id = entity.Index;
			prefabIndex.PrefabName = prefab.name;
			prefabIndex.AssetName = GetAssetName(prefab);
			prefabIndex.Name = prefabIndex.AssetName;
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
			var required = CollectRequirements(entity);
			(prefabIndex.UnlockMilestone, var unlockRequirements) = UnlockRequirementsOf(required);
			prefabIndex.UnlockRequirements = prefabIndex.IsLocked ? unlockRequirements : Array.Empty<string>();

			// The other half of the progression, and the half that splits a service
			// menu. After UiMenuName above: an asset the tree never gated falls into
			// its service's root bucket, and the menu is what names the service.
			(prefabIndex.DevTreeBranch, prefabIndex.DevTreeBranchIcon, prefabIndex.DevTreeBranchDepth) =
				DevTreeBranchOf(entity, required, prefabIndex.UiMenuName);
			prefabIndex.IsRandom = prefabIndex.SubCategory is not PrefabSubCategory.Networks_Pillars && EntityManager.HasComponent<PlaceholderObjectData>(entity);

			if (prefab.asset?.database == AssetDatabase<ParadoxMods>.instance)
			{
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

			// Asset packs come off the prefab's own AssetPackItem and are
			// independent of DLC ownership, so they are read for every prefab.
			if (prefab.TryGet<AssetPackItem>(out var assetPackItem) && assetPackItem.m_Packs is not null)
			{
				prefabIndex.AssetPacks = assetPackItem.m_Packs.Where(pack => pack is not null).ToArray();
			}
			else
			{
				prefabIndex.AssetPacks = new AssetPackPrefab[0];
			}

			if (prefab.TryGet<ContentPrerequisite>(out var contentPrerequisites)
				&& contentPrerequisites.m_ContentPrerequisite.TryGet<DlcRequirement>(out var dlcRequirements))
			{
				prefabIndex.DlcId = dlcRequirements.m_Dlc;
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

			BuildingMenuUtil.File(BuildingMenuUtil.CategorizedPrefabs, prefabIndex);
		}

		private string GetAssetName(PrefabBase prefab)
		{
			_prefabUISystem.GetTitleAndDescription(_prefabSystem.GetEntity(prefab), out var titleId, out var _);

			var localized = GameManager.instance.localizationManager.activeDictionary.TryGetValue(titleId, out var name)
				? name
				: null;

			return WordFormat.GameText(localized) ?? prefab.name.Replace('_', ' ').FormatWords();
		}

		/// <summary>Numbers the display names indexed prefabs share. See <see cref="DuplicateNameNumbering"/>.</summary>
		private static void AddNumberToDuplicatePrefabNames()
		{
			var all = BuildingMenuUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any];
			// Upgrades are left out of the numbering. Every school type has an
			// "Extension Wing"; they are never listed beside each other, only on
			// their own parent's picker, where "Extension Wing 2" has no referent.
			var numbered = all.Where(x => !x.IsServiceUpgrade).ToList();
			var names = DuplicateNameNumbering.Names(numbered.Select(x => (x.AssetName, x.PrefabName)).ToList());

			for (var i = 0; i < numbered.Count; i++)
			{
				numbered[i].Name = names[i];
			}

			// The name order was sorted on the names just replaced.
			all.ResetOrder();
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
		/// <remarks>Fires on both edges, so the state goes stale in neither direction. Not a re-index:
		/// nothing about the PREFAB changed, only what the city holds, and the generation is enough for
		/// the panel to republish.</remarks>
		private void OnUniqueAssetStatusChanged(Entity prefab, bool placed)
		{
			PlacedUniqueRegistry.Set(prefab.Index, placed);
			IndexGeneration++;
		}
	}
}
