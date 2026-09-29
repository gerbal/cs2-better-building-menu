using Colossal.Core;
using Colossal.Entities;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.Mathematics;
using Colossal.PSI.Common;
using Colossal.Serialization.Entities;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
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
		private EntityQuery _unlockEventQuery;
		// Prefabs the game created or changed this frame — the incremental
		// pass's own trigger. A field rather than a RequireForUpdate gate,
		// which would hold the system shut for unlock events too.
		private EntityQuery _changedPrefabQuery;
		// Prefab entities the game is replacing or removing, until the frame's clean-up.
		// The entity is the only link to their entry: Road Builder renames a road on every edit.
		private EntityQuery _deletedPrefabQuery;
		// One full pass per settled burst of dictionary changes, on the next update for
		// a language change. See OnActiveDictionaryChanged.
		private readonly LocaleReindexPolicy _localeReindex = new(TimeSpan.FromSeconds(1));
		private static readonly System.Diagnostics.Stopwatch IndexClock = System.Diagnostics.Stopwatch.StartNew();
		private UniqueAssetTrackingSystem? _uniqueAssets;
		// Every indexed prefab the game flags Unique, rebuilt with the index. The
		// placed-unique rescan walks these rather than all 17k prefabs, so it can
		// afford to run on every catalog publish. See PlacedUniqueScan.
		private List<(int Id, PrefabBase Prefab)> _uniqueCandidates = new();
		// The count the last rescan logged, so a rescan that found nothing new stays quiet.
		private int _loggedUniqueCandidateCount = -1;
		// The thresholds a building's pollution is graded by, read at the start of every pass.
		private PollutionScale? _pollutionScale;
#if DEBUG
		// The assets a pass indexed without an icon, logged as one line when it ends: one line
		// each came to thousands per full pass, repeated on every language change.
		private readonly List<string> _missingIcons = new();
#endif
		// Each processor with its query, and that query narrowed to prefabs created or changed this
		// frame, which is all a partial pass reads. Built once, in OnCreate.
		private readonly List<(IPrefabCategoryProcessor Processor, EntityQuery All, EntityQuery Changed)> _processors = new();

		/// <summary>Bumped whenever an indexed fact changes: a re-index, an unlock, a unique built or
		/// bulldozed, a load emptying the index. The catalog's snapshot cache is keyed on it, so
		/// a stale projection cannot outlive the change that staled it, and the asset menu polls it to
		/// know when to republish.</summary>
		/// <remarks>Never reset: the caches compare it as a plain int, so a count that started again
		/// could land on a number an older projection was stored under.</remarks>
		public int Generation { get; private set; } = 1;

		/// <summary>The index the asset menu reads. A load empties it at preload; a full pass builds its
		/// replacement aside and publishes it only when the pass succeeds; a partial pass edits it in
		/// place. See <see cref="RunIndex"/>.</summary>
		public CatalogIndex Index { get; private set; } = new();

		/// <summary>The unique assets the city has already got one of, kept in step with the game's
		/// tracker.</summary>
		public PlacedUniques PlacedUniques { get; private set; } = new();

		/// <summary>What a catalog refresh reads, taken once, after <see cref="SyncPlacedUniques"/>.</summary>
		public CatalogSource Source => new(Index, PlacedUniques, Generation);

		// Set when this system is created inside a running city: the game adds a
		// newly subscribed mod to a session after the save is deserialised, so
		// OnGameLoaded has already fired and would leave the menu empty until
		// loading-complete.
		private bool _indexOnFirstUpdate;

		protected override void OnCreate()
		{
			base.OnCreate();

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
			_deletedPrefabQuery = GetEntityQuery(ComponentType.ReadOnly<PrefabData>(), ComponentType.ReadOnly<Deleted>());

			Enabled = false;

			if (GameManager.instance.gameMode is GameMode.Game or GameMode.Editor && !GameManager.instance.isGameLoading)
			{
				_indexOnFirstUpdate = true;
				Enabled = true;
			}
		}

		/// <summary>A new load starts from nothing the last city left behind.</summary>
		/// <remarks>A fresh index rather than a shared empty one, because a partial pass files into
		/// the published index in place. See docs/indexing.md, "Load timing".</remarks>
		protected override void OnGamePreload(Purpose purpose, GameMode mode)
		{
			base.OnGamePreload(purpose, mode);

			Enabled = false;
			// The load indexes the next city itself.
			_indexOnFirstUpdate = false;

			Index = new CatalogIndex(mods: Index.Mods);
			PlacedUniques = new PlacedUniques();
			_uniqueCandidates = new List<(int Id, PrefabBase Prefab)>();
			// So the next city's placed-unique line is logged, whatever its count, once its
			// index is ready.
			_loggedUniqueCandidateCount = -1;
			Generation++;

			Mod.Log.Debug($"Index emptied at preload (purpose={purpose}, mode={mode}); indexing waits for a city");
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

			Mod.Log.Debug($"Full pass at OnGameLoaded (purpose={serializationContext.purpose})");
			// A pass that failed leaves the index empty and not ready, and loading-complete
			// runs its own.
			RunIndex(true);
			Enabled = true;
		}

		/// <summary>How many indexed prefabs hold a lock state that differs from the game's.</summary>
		/// <remarks>Lock state is the only thing the OnGameLoaded pass could read too early, and this is
		/// the exact test for it: the read ApplyUnlocks uses, over every indexed prefab.</remarks>
		private int LockStateDrift()
		{
			var drift = 0;

			foreach (var prefabIndex in Index.All)
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
				// Ready means a full pass has succeeded since this load's preload: the
				// OnGameLoaded pass, or a locale pass that ran after it. Partial passes cannot
				// make it so, because they skip an index that is not ready.
				if (Index.IsReady)
				{
					var drift = LockStateDrift();

					if (drift == 0)
					{
						Mod.Log.Debug("Skipped full pass at OnGameLoadingComplete: indexed earlier in this load and lock state agrees");
						Enabled = true;
						return;
					}

					Mod.Log.Debug($"Full pass at OnGameLoadingComplete: {drift} prefab(s) changed lock state since OnGameLoaded");
				}
				else
				{
					Mod.Log.Debug($"Full pass at OnGameLoadingComplete (purpose={purpose}, mode={mode})");
				}

				RunIndex(true);

				Enabled = true;
			}
		}

		protected override void OnDestroy()
		{
			GameManager.instance.localizationManager.onActiveDictionaryChanged -= OnActiveDictionaryChanged;

			if (_uniqueAssets is not null)
			{
				_uniqueAssets.EventUniqueAssetStatusChanged -= OnUniqueAssetStatusChanged;
			}

			base.OnDestroy();
		}

		/// <summary>Notes that the dictionary changed; the full pass it earns runs from OnUpdate.</summary>
		/// <remarks>Never a pass from here: the event also fires at the main menu and during a
		/// load, and OnUpdate runs only while a city is loaded. LocaleReindexPolicy makes a burst
		/// of sources one pass. See docs/indexing.md, "Language changes".</remarks>
		private void OnActiveDictionaryChanged()
		{
			var localeId = GameManager.instance.localizationManager.activeLocaleId;

			if (_localeReindex.Observe(localeId, IndexClock.Elapsed) == LocaleReindexDecision.Immediate)
			{
				// Enabled says whether a city is loaded: the log line that confirms, in game,
				// that the main menu keeps the system off.
				Mod.Log.Debug(Enabled
					? $"Locale changed to {localeId}; full pass on the next update"
					: $"Locale changed to {localeId} with no city loaded; the next city's pass indexes in it");
			}
		}

		/// <remarks>Registered at UIUpdate only, which follows PrefabSystem and UnlockSystem in
		/// the same frame. See docs/indexing.md, "Partial passes".</remarks>
		protected override void OnUpdate()
		{
			if (_indexOnFirstUpdate)
			{
				_indexOnFirstUpdate = false;
				Mod.Log.Debug("Full pass at first update: the mod joined a running game");
				// There is no load to retry it: if this fails, the index stays empty until the
				// next load, and the asset menu shows its indexing notice. With no pass behind it, a
				// language change has no indexed locale to differ from, so it cannot retry.
				RunIndex(true);
			}

			switch (_localeReindex.TakeDue(IndexClock.Elapsed))
			{
				case LocaleReindexDecision.Immediate:
					Mod.Log.Debug($"Full pass at locale change (locale={GameManager.instance.localizationManager.activeLocaleId})");
					RunIndex(true);
					break;
				case LocaleReindexDecision.Deferred:
					Mod.Log.Debug("Full pass after dictionary sources settled");
					RunIndex(true);
					break;
			}

			// Nothing to patch until a full pass has filled the index, and the next one reads
			// this frame's unlocks and changes afresh. See docs/indexing.md, "A pass that fails".
			if (!Index.IsReady)
			{
				return;
			}

			if (!_unlockEventQuery.IsEmptyIgnoreFilter)
			{
				// Caught here so it cannot cost this frame's partial pass: the changed prefabs'
				// tags are gone after the frame's clean-up. The next full pass reads lock state.
				try
				{
					ApplyUnlocks();
				}
				catch (Exception ex)
				{
					Mod.Log.Error(ex, "Applying unlocks failed");
				}
			}

			if (_changedPrefabQuery.IsEmptyIgnoreFilter && _deletedPrefabQuery.IsEmptyIgnoreFilter)
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
				var prefabIndex = Index.Get(entity.Index);

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

			Mod.Log.Debug($"Unlocked {changed} indexed prefab(s)");

			// The catalog is served from a cached search, so the rows keep their
			// old lock state until it is rebuilt — and an Availability filter set
			// to Unlocked would still be excluding them.
			Generation++;
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

			foreach (var prefab in Index.All)
			{
				if ((prefab.Thumbnail ?? prefab.FallbackThumbnail) is not { Length: > 0 } thumbnail)
				{
					continue;
				}

				// Cheap and self-limiting: the cache returns immediately for a
				// raster, and remembers a miss as readily as a hit.
				Mod.Silhouettes.UrlFor(thumbnail);
				seen++;
			}

			Mod.Log.Debug(
				$"Primed silhouettes for {seen} prefab(s) in {timer.Elapsed.TotalSeconds:0.000}s "
				+ $"({Mod.Silhouettes.Generated} generated)");
		}

		/// <summary>Re-reads the mods the processors adapt to, for the pass about to read them.</summary>
		/// <param name="fallback">The answer to keep if the read fails: the published index's.</param>
		/// <remarks>
		/// Every full pass, the first included; see docs/indexing.md, "Load timing". The type is
		/// looked up among the loaded assemblies, so a renamed one is logged once and filters
		/// nothing rather than throwing into the game's load.
		/// </remarks>
		private ModCompatibility RefreshModCompatibility(ModCompatibility fallback)
		{
			var mods = fallback;

			try
			{
				mods = Mod.ReadEnabledMods();
			}
			catch (Exception ex)
			{
				// The last answer stands; a pass is worth more than knowing a mod joined.
				Mod.Log.Warn(ex, "Could not read the enabled mods; keeping the last answer");
			}

			if (_roadBuilderDiscarded.HasValue || !mods.RoadBuilder)
			{
				return mods;
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
					return mods;
				}
			}
			catch (Exception ex)
			{
				failure = ex;
			}

			if (_warnedRoadBuilderDiscarded)
			{
				return mods;
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

			return mods;
		}

		/// <summary>Drops the entries of prefab entities the game is deleting this frame.</summary>
		/// <remarks>PrefabSystem.UpdatePrefab marks the old entity Deleted and files the prefab under
		/// a new one, so without this the old row stays listed until the next full pass.</remarks>
		private void RemoveDeletedPrefabs(CatalogIndex target)
		{
			var deleted = _deletedPrefabQuery.ToEntityArray(Allocator.Temp);

			for (var i = 0; i < deleted.Length; i++)
			{
				target.Remove(deleted[i].Index);
			}

			deleted.Dispose();
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
#if DEBUG
			_missingIcons.Clear();
#endif
			CatalogIndex built;

			try
			{
				built = BuildIndex(full, census);
			}
			catch (Exception ex) when (full)
			{
				// A full pass files into an index of its own, so one that threw halfway
				// never touched the published index, and nothing reaches the game's load
				// or update loop. See docs/indexing.md, "A pass that fails".
				Mod.Log.Error(ex, "Full prefab indexing failed; the previous index stands");

				return false;
			}

			// A full pass publishes the index it built; a partial pass built into the
			// published one, so this assigns it to itself.
			built.IsReady = true;
			Index = built;
			Generation++;

			// Rescan the placed uniques against the city that just loaded: the
			// tracker's loaded-asset events may already have run this frame, and a
			// previous city's entries would otherwise survive into this one. Partial
			// passes too, so a prefab a mod added at runtime joins the candidates.
			RefreshPlacedUniques(rebuildCandidates: true);

			stopWatch.Stop();

			// The one line a player's log gets per load: release logging stays this
			// small, and everything else a pass has to say is at Debug.
			var summary = $"{(full ? "Full" : "Partial")} prefab indexing: {Index.All.Count} prefabs"
				+ $" ({Index.All.Count(p => p.IsLocked)} locked) in {stopWatch.Elapsed.TotalSeconds:0.000}s";
			if (full)
			{
				Mod.Log.Info(summary);
			}
			else
			{
				Mod.Log.Debug(summary);
			}
#if DEBUG
			if (_missingIcons.Count > 0)
			{
				Mod.Log.Debug($"[MISSINGICON] {_missingIcons.Count} indexed asset(s) have no icon, e.g. {string.Join(", ", _missingIcons.Take(8))}");
			}
#endif
			if (full)
			{
				PrimeSilhouettes();

				// Diagnostics for development, about 10 KB a pass: only with Debug on,
				// and not even computed otherwise. See docs/indexing.md.
				if (Mod.Log.isLevelEnabled(Level.Debug))
				{
					// Which processors feed anything the asset menu can show.
					Log(IndexAuditLog.ProcessorCensus(census, Index));
					var all = Index.All;

					// A prefab two processors claimed keeps the later one's category,
					// whatever the earlier one decided. Each pair is named once.
					foreach (var overlap in ProcessorOverlap.Find(_processors.Select(entry => entry.Processor.GetType().Name), census))
					{
						var example = all.TryGetValue(overlap.ExampleId, out var indexed) ? indexed.PrefabName : overlap.ExampleId.ToString(CultureInfo.InvariantCulture);

						Mod.Log.Debug($"[PROCESSOR-OVERLAP] {overlap.Later} replaced {overlap.Earlier} for {overlap.Count} prefab(s), e.g. {example}");
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
		/// <returns>The index the pass filed into: a new one in a full pass, which the caller
		/// publishes only if this returns, or the published one, edited in place, in a partial
		/// pass.</returns>
		private CatalogIndex BuildIndex(bool full, Dictionary<string, List<int>> census)
		{
			// Assigned in both branches, so nothing in a full pass's prologue can reach
			// the published index through it before the new one exists.
			CatalogIndex target;
			_pollutionScale = ReadPollutionScale();

			if (full)
			{
				if (_pollutionScale is null)
				{
					Mod.Log.Debug("No pollution thresholds in the game's settings: cards draw no pollution levels");
				}

				var mods = RefreshModCompatibility(fallback: Index.Mods);

				// Before IndexZones and before the processors: the zone catalog
				// inherits the game's own Zones menu, and the blacklist check below
				// consults the placements too.
				// A walk that threw still hands over what it read: a full pass has no
				// table of its own to keep, and the menus it did read are still right.
				TryIndexVanillaMenuPlacements(full: true, out var placements);
				var zones = IndexZones(placements);
				var (menuNames, menuEntities, menus) = IndexAssetMenus();
				var categories = IndexAssetCategories();
				var milestones = IndexMilestones();
				var (branches, roots) = IndexDevTreeBranches();

				// Built before the processors run, which read these tables back, and
				// kept aside until the pass succeeds.
				target = new CatalogIndex(
					new VanillaMenuIndex(placements, menuNames, menuEntities, menus, categories),
					zones,
					new ProgressionIndex(milestones, branches, roots),
					mods);
			}
			else
			{
				target = Index;
				RemoveDeletedPrefabs(target);

				// Before the processors, which read the placements back: a recreated prefab
				// is placed under its new entity. A walk that threw keeps the old table.
				if (TryIndexVanillaMenuPlacements(full: false, out var placements))
				{
					target.RefreshPlacements(placements);
				}
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
						if (_blackList.Contains(prefab.name) && !target.Menus.IsPlaced(entity.Index))
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
							// A recreated prefab's old entries: every namesake the game has
							// replaced. A namesake of another type is live, and so is the entry
							// an earlier processor just filed for this entity.
							// An entity the game has already replaced, as when it creates and
							// recreates a prefab in one frame, is stale whatever its tags.
							if (!full && !IsCurrent(prefab, entity.Index))
							{
								target.Remove(entity.Index);

								continue;
							}

							if (!full && EntityManager.HasComponent<Created>(entity))
							{
								target.RemoveNamesakes(prefab.name, IsReplaced);
							}

							if (_roadBuilderDiscarded.HasValue && EntityManager.HasComponent(entity, _roadBuilderDiscarded.Value))
							{
								target.Remove(entity.Index);

								continue;
							}

							if (processor.TryCreatePrefabIndex(prefab, entity, target, out prefabIndex))
							{
								if (prefab.TryGet<EditorAssetCategoryOverride>(out var overrides) && overrides is not null)
								{
									var categoryOverride = FindItCategoryOverride.Read(overrides.m_IncludeCategories, overrides.m_ExcludeCategories);

									// An author's exclusion is honoured only for assets the game does
									// not itself place in a menu. Removed as well as skipped, so a
									// partial pass drops what an earlier pass indexed.
									if (categoryOverride.Excluded && !target.Menus.IsPlaced(entity.Index))
									{
										target.Remove(entity.Index);

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

								AddPrefab(prefab, entity, prefabIndex, target);

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

			target.NumberDuplicateNames();

			return target;
		}

		private void AddPrefab(PrefabBase prefab, Entity entity, PrefabIndex prefabIndex, CatalogIndex target)
		{
			prefabIndex.Id = entity.Index;
			prefabIndex.PrefabName = prefab.name;
			prefabIndex.AssetName = GetAssetName(prefab);
			prefabIndex.Name = prefabIndex.AssetName;
			prefabIndex.Thumbnail = prefabIndex.Thumbnail ?? ImageSystem.GetThumbnail(prefab);
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
			var groupCategory = uIObject?.m_Group?.name;
			var groupMenu = (uIObject?.m_Group as UIAssetCategoryPrefab)?.m_Menu?.name;
			// The category's own priority, so a group of assets can be ordered the
			// way the tab strip above it is. Guarded on UIAssetCategoryPrefab rather
			// than on m_Group: a menu's priority ranks menus, a different space.
			var groupPriority =
				uIObject?.m_Group is UIAssetCategoryPrefab category
				&& category.TryGet<UIObject>(out var categoryUi)
					? categoryUi.m_Priority
					: 0;
			// The entity world's placement wins: mods that regroup the menu at
			// runtime edit it there and leave the managed group on the stock tab.
			// One assignment of all three, so the priority cannot drift from its category.
			(prefabIndex.UiCategoryName, prefabIndex.UiMenuName, prefabIndex.UiCategoryPriority) =
				target.Menus.Placements.TryGetValue(entity.Index, out var placed)
					? MenuPlacementOverride.Resolve(
						groupCategory, groupMenu, groupPriority, placed.Category, placed.Menu, placed.CategoryPriority)
					: (groupCategory, groupMenu, groupPriority);
			prefabIndex.IsVanilla = prefab.isBuiltin;
			// Every category, not only buildings: a parking lot reached through the
			// Roads menu is a network, and parking is the whole point of one.
			prefabIndex.ParkingSlots = GetParkingSlots(prefab);
			prefabIndex.HasParking = prefabIndex.ParkingSlots > 0;
			// Enableable: presence alone would mark every unlockable asset
			// locked forever, including the ones already earned.
			prefabIndex.IsLocked = EntityManager.HasEnabledComponent<Locked>(entity);
			prefabIndex.Bonuses = GetBonuses(DetailsSource(entity));

			// Milestone kept whatever the lock state; requirements only while
			// locked. See the matching note in ApplyUnlocks.
			var required = CollectRequirements(entity);
			(prefabIndex.UnlockMilestone, var unlockRequirements) = UnlockRequirementsOf(required);
			prefabIndex.UnlockRequirements = prefabIndex.IsLocked ? unlockRequirements : Array.Empty<string>();

			// The other half of the progression, and the half that splits a service
			// menu. After UiMenuName above: an asset the tree never gated falls into
			// its service's root bucket, and the menu is what names the service.
			(prefabIndex.DevTreeBranch, prefabIndex.DevTreeBranchIcon, prefabIndex.DevTreeBranchDepth) =
				DevTreeBranchOf(entity, required, prefabIndex.UiMenuName, target.Progression);
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
					_missingIcons.Add(prefab.name);

					if (Mod.Log.isLevelEnabled(Level.Debug))
					{
						Mod.Log.Debug("MISSINGICON: " + prefab.name);
					}
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

			PopulateAnalyticalData(entity, prefabIndex, target.Zones);

			target.File(prefabIndex);
		}

		/// <summary>Whether the game has moved the entry's prefab to another entity.</summary>
		/// <remarks>PrefabSystem.UpdatePrefab keeps the PrefabBase, marks its entity Deleted and
		/// points the prefab at a new one, so this holds for the old entry only.</remarks>
		private bool IsReplaced(PrefabIndex entry) => !IsCurrent(entry.Prefab, entry.Id);

		/// <summary>Whether the game maps this prefab to the entity with this index.</summary>
		private bool IsCurrent(PrefabBase prefab, int id) =>
			_prefabSystem.TryGetEntity(prefab, out var current) && current.Index == id;

		private string GetAssetName(PrefabBase prefab)
		{
			_prefabUISystem.GetTitleAndDescription(_prefabSystem.GetEntity(prefab), out var titleId, out var _);

			var localized = GameManager.instance.localizationManager.activeDictionary.TryGetValue(titleId, out var name)
				? name
				: null;

			return WordFormat.GameText(localized) ?? prefab.name.Replace('_', ' ').FormatWords();
		}

		/// <summary>
		/// Asks the game which unique assets the city already holds, for the asset menu to
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
				PlacedUniques.Reset(null);
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

			var moved = PlacedUniques.Reset(PlacedUniqueScan.Collect(candidates));

			if (moved)
			{
				// Same reason as the event path: the prefabs are untouched but the
				// projections built from them are stale.
				Generation++;
			}

			// On a change only, as the rescan runs on every catalog publish, and only once a
			// pass has made the index ready: at the main menu "0 of 0" means no city, but in a
			// city it means unique detection found nothing.
			if (Index.IsReady && (moved || _uniqueCandidates.Count != _loggedUniqueCandidateCount))
			{
				_loggedUniqueCandidateCount = _uniqueCandidates.Count;
				Mod.Log.Debug($"Placed unique assets: {PlacedUniques.Count} of {_uniqueCandidates.Count} unique assets");
			}
		}

		/// <summary>Rescans the placed uniques for whoever is about to draw them.</summary>
		/// <remarks>
		/// Does not republish the catalog: the caller is already on its way to doing that,
		/// and a republish from here would recurse.
		/// </remarks>
		public void SyncPlacedUniques() => RefreshPlacedUniques(rebuildCandidates: false);

		private void CollectUniqueCandidates()
		{
			var candidates = new List<(int Id, PrefabBase Prefab)>();

			foreach (var prefabIndex in Index.All)
			{
				if (prefabIndex.IsUnique && prefabIndex.Prefab is not null)
				{
					candidates.Add((prefabIndex.Id, prefabIndex.Prefab));
				}
			}

			_uniqueCandidates = candidates;
		}

		/// <summary>Keeps the placed-unique set in step with the city.</summary>
		/// <remarks>Fires on both edges, so the state goes stale in neither direction. Not a re-index:
		/// nothing about the PREFAB changed, only what the city holds, and the generation is enough for
		/// the asset menu to republish.</remarks>
		private void OnUniqueAssetStatusChanged(Entity prefab, bool placed)
		{
			PlacedUniques.Set(prefab.Index, placed);
			Generation++;
		}
	}
}
