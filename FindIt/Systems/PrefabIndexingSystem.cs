using Colossal.Core;
using Colossal.Entities;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.Mathematics;
using Colossal.PSI.Common;
using Colossal.Serialization.Entities;

using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Domain.Interfaces;
using FindItBuildingMenu.Utilities;

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
using System.IO;
using System.Linq;
using System.Reflection;

using Unity.Collections;
using Unity.Entities;
using Unity.Mathematics;

namespace FindItBuildingMenu.Systems
{
	public partial class PrefabIndexingSystem : GameSystemBase
	{
		private PrefabSystem _prefabSystem;
		private ImageSystem _imageSystem;
		private PrefabUISystem _prefabUISystem;
		private FindItUISystem _finditUISystem;
		private HashSet<string> _blackList;
		private ComponentType? roadBuilderDiscarded;
		private static Dictionary<Entity, ZoneTypeFilter> _zoneTypeCache;
		private EntityQuery _unlockEventQuery;
		// Guards against queueing a second pass while one is already pending:
		// the locale event fires more than once per change. See
		// OnActiveDictionaryChanged.
		private bool _localeChanged;
		private static List<ZoneCatalogEntry> _zoneCatalog = new();
		private static Dictionary<int, string> _assetMenuNames = new();
		// Vanilla's second tier, keyed by menu name. See VanillaMenuCategory.
		private static Dictionary<string, List<VanillaMenuCategory>> _assetCategories = new();
		// Milestone index -> the name the rest of the game calls it. ~20 entries,
		// resolved once per index pass rather than per locked asset.
		private static Dictionary<int, string> _milestoneNames = new();
		private readonly List<IPrefabCategoryProcessor> _prefabCategoryProcessors = new();

		protected override void OnCreate()
		{
			base.OnCreate();

			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_imageSystem = World.GetOrCreateSystemManaged<ImageSystem>();
			_prefabUISystem = World.GetOrCreateSystemManaged<PrefabUISystem>();
			_finditUISystem = World.GetOrCreateSystemManaged<FindItUISystem>();

			GameManager.instance.localizationManager.onActiveDictionaryChanged += OnActiveDictionaryChanged;

			using var stream = typeof(Mod).Assembly.GetManifestResourceStream("FindItBuildingMenu.Resources.Blacklist.txt");
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

			// Unlock events are the third trigger. UnlockSystem.UnlockPrefab
			// disables the Locked component and raises an Unlock event, but
			// never marks the prefab Updated — so without this the lock state
			// captured at index time would stay stale until the next reload,
			// and a milestone would silently stop being reflected.
			_unlockEventQuery = GetEntityQuery(ComponentType.ReadOnly<Unlock>());

			RequireForUpdate(GetEntityQuery(new EntityQueryDesc
			{
				All = new[] { ComponentType.ReadOnly<PrefabData>() },
				Any = new[]
				{
					ComponentType.ReadOnly<Created>(),
					ComponentType.ReadOnly<Updated>(),
				}
			}));

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

				//World.GetExistingSystemManaged<FindItUISystem>()
				//	.SetAllThumbnails(FindItUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].Select(x => x.Thumbnail));

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

		protected override void OnUpdate()
		{
			// An unlock changes lock state without touching the prefab, so the
			// incremental pass would not see it. Rare enough that a full pass
			// is the honest response rather than a targeted patch that could
			// drift from what the index otherwise holds.
			RunIndex(!_unlockEventQuery.IsEmptyIgnoreFilter);
		}

		private void RunIndex(bool full)
		{
			var stopWatch = Stopwatch.StartNew();
			var existingMeshes = new List<string>();

			if (full)
			{
				FindItUtil.CategorizedPrefabs.Clear();

				AddAllCategories();

				IndexZones();
				IndexAssetMenus();
				IndexAssetCategories();
				IndexMilestones();
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
							queries[i].None = queries[i].None.Concat(new[] { ComponentType.ReadOnly<PlaceholderObjectData>() }).ToArray();
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

						if (_blackList.Contains(prefab.name))
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
								FindItUtil.RemoveItem(entity);

								continue;
							}

							if (!full && EntityManager.HasComponent<Created>(entity) && FindItUtil.Find(_prefabSystem.GetPrefab<PrefabBase>(entity), false, out var oldId))
							{
								FindItUtil.RemoveItem(oldId);
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
									if (overrides?.m_ExcludeCategories?.Any(IsFindItCategoryOverride) ?? false)
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

			FindItUtil.IsReady = true;

			_finditUISystem.TriggerSearch();

			stopWatch.Stop();

			Mod.Log.Info($"{(full ? "Full" : "Partial")} Prefab Indexing completed in {stopWatch.Elapsed.TotalSeconds:0.000}s");
			Mod.Log.Info($"Indexed Prefabs Count: {FindItUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].Count}");

			if (full)
			{
				LogVanillaMenuTree();
			}
		}

			/// <summary>
			/// SPIKE (cm-e98i). Dumps the build-menu tree as the GAME describes it,
			/// so it can be diffed against what the vanilla menu actually renders.
			///
			/// The question this exists to answer: does reading UIObject.m_Group
			/// reproduce vanilla's menus exactly? If it does, VanillaBuildMenuTaxonomy
			/// — which reconstructs the same relationship from our own category
			/// enums, and which is why Healthcare showed 15 against vanilla's 8 —
			/// can be deleted rather than patched.
			///
			/// Counts are reported both raw and with vanilla's own exclusion applied
			/// (ToolbarUISystem.FilterOutUpgrades drops service upgrades), because
			/// that single rule is the whole of the Healthcare discrepancy.
			///
			/// Delete this method with the two PrefabIndex fields once decided.
			/// </summary>
			private void LogVanillaMenuTree()
			{
				try
				{
					var indexed = FindItUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any];
					var placed = indexed.Where(p => p.UiMenuName is not null).ToList();

					Mod.Log.Info($"[MENU-TREE] indexed={indexed.Count} placedInAMenu={placed.Count} unplaced={indexed.Count - placed.Count}");

					foreach (var menu in placed.GroupBy(p => p.UiMenuName).OrderBy(g => g.Key, StringComparer.Ordinal))
					{
						foreach (var category in menu.GroupBy(p => p.UiCategoryName).OrderBy(g => g.Key, StringComparer.Ordinal))
						{
							// An upgrade is an extension by our own detection, which is
							// the same population vanilla removes.
							var buildable = category.Where(p => p.ExtensionIds is null || p.ExtensionIds.Length == 0).ToList();
							var names = string.Join(",", buildable.OrderBy(p => p.UIOrder).Select(p => p.PrefabName));

							Mod.Log.Info(
								$"[MENU-TREE] menu=\"{menu.Key}\" category=\"{category.Key}\" "
								+ $"all={category.Count()} buildable={buildable.Count} names={names}");
						}
					}
				}
				catch (Exception ex)
				{
					Mod.Log.Error(ex, "[MENU-TREE] dump failed");
				}
			}

			private static bool IsFindItCategoryOverride(string category)
			{
				return category == "FindIt"
					|| category.StartsWith("FindIt/", StringComparison.Ordinal)
					|| category == "FindItBuildingMenu"
					|| category.StartsWith("FindItBuildingMenu/", StringComparison.Ordinal);
			}

			private void AddPrefab(PrefabBase prefab, Entity entity, PrefabIndex prefabIndex)
		{
			prefabIndex.Id = entity.Index;
			prefabIndex.PrefabName = prefab.name;
			prefabIndex.Name = GetAssetName(prefab);
			prefabIndex.Thumbnail = IconPath.Normalize(prefabIndex.Thumbnail ?? ImageSystem.GetThumbnail(prefab));
			prefabIndex.IsFavorited = FindItUtil.IsFavorited(prefab.name);
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
			prefabIndex.IsVanilla = prefab.isBuiltin || prefab.Has<FindItGenerated>();
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
			// recurses per prefab, and an unlock event triggers a FULL re-index
			// (see OnUpdate) — so running it across all 17,898 prefabs every time
			// the player passes a milestone would be the expensive thing here.
			// Restricted this way the cost is highest at load, when a full index
			// runs anyway, and falls towards zero exactly as unlocks get more
			// frequent.
			prefabIndex.Bonuses = GetBonuses(entity);

			if (prefabIndex.IsLocked)
			{
				(prefabIndex.UnlockMilestone, prefabIndex.UnlockRequirements) = GetUnlockRequirements(entity);
			}
			else
			{
				prefabIndex.UnlockMilestone = 0;
				prefabIndex.UnlockRequirements = Array.Empty<string>();
			}
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
			// broke FindIt's own pack filter (Filters.MatchesAssetPack) for
			// every asset in the game.
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

			if (!Mod.Settings.HideBrandsFromAny || prefabIndex.SubCategory is not PrefabSubCategory.Props_Branding)
			{
				FindItUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any][prefabIndex.Id] = prefabIndex;
			}

			FindItUtil.CategorizedPrefabs[prefabIndex.Category][PrefabSubCategory.Any][prefabIndex.Id] = prefabIndex;

			FindItUtil.CategorizedPrefabs[prefabIndex.Category][prefabIndex.SubCategory][prefabIndex.Id] = prefabIndex;

			if (prefabIndex.IsFavorited)
			{
				FindItUtil.CategorizedPrefabs[PrefabCategory.Favorite][PrefabSubCategory.Any][prefabIndex.Id] = prefabIndex;

				if (!FindItUtil.CategorizedPrefabs[PrefabCategory.Favorite].ContainsKey(prefabIndex.SubCategory))
				{
					FindItUtil.CategorizedPrefabs[PrefabCategory.Favorite][prefabIndex.SubCategory] = new();
				}

				FindItUtil.CategorizedPrefabs[PrefabCategory.Favorite][prefabIndex.SubCategory][prefabIndex.Id] = prefabIndex;
			}

			//FindItUtil.UpdateFavoritesPack(prefabIndex);
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

			for (var i = 0; i < milestones.Length; i++)
			{
				if (EntityManager.TryGetComponent<MilestoneData>(milestones[i], out var data)
					&& _prefabSystem.TryGetPrefab<PrefabBase>(milestones[i], out var prefab))
				{
					names[data.m_Index] = GetAssetName(prefab);
				}
			}

			_milestoneNames = names;
			Mod.Log.Info($"Indexed Milestones: {names.Count}");
		}

		/// <summary>The name the game gives a milestone index.</summary>
		public static string GetMilestoneName(int index) =>
			_milestoneNames.TryGetValue(index, out var name) ? name : string.Empty;

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
			// A count with no subject is worse than silence: returning nothing
			// lets the asset's OTHER requirements have the line instead.
			if (prefab is StrictObjectBuiltRequirementPrefab strict && strict.m_Requirement is not null)
			{
				return Format(
					"Requirement.OBJECTS_BUILT",
					"build {0} × {1}",
					strict.m_MinimumCount.ToString("N0"),
					GetAssetName(strict.m_Requirement));
			}

			if (EntityManager.HasComponent<ObjectBuiltRequirementData>(entity))
			{
				return string.Empty;
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
			foreach (var grp in FindItUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].Where(x => int.TryParse(x.PdxModsId, out var id) && id > 0).GroupBy(x => x.PdxModsId))
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
			foreach (var grp in FindItUtil.CategorizedPrefabs[PrefabCategory.Any][PrefabSubCategory.Any].GroupBy(x => x.Name))
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
			var brands = new HashSet<string>(FindItUtil.CategorizedPrefabs[PrefabCategory.Props][PrefabSubCategory.Props_Branding].Select(x => x.PrefabName));

			foreach (var category in FindItUtil.CategorizedPrefabs.Keys)
			{
				if (category is PrefabCategory.Any)
				{
					continue;
				}

				foreach (var subCategory in FindItUtil.CategorizedPrefabs[category].Keys)
				{
					if (subCategory is PrefabSubCategory.Props_Branding || (category is PrefabCategory.Props && subCategory is PrefabSubCategory.Any))
					{
						continue;
					}

					foreach (var item in FindItUtil.CategorizedPrefabs[category][subCategory].ToList())
					{
						if (brands.Contains(item.PrefabName))
						{
							FindItUtil.CategorizedPrefabs[category][subCategory].Remove(item);

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
				FindItUtil.CategorizedPrefabs[category] = new()
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
						FindItUtil.CategorizedPrefabs[category][subCategory] = new();
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

			for (var i = 0; i < menus.Length; i++)
			{
				if (_prefabSystem.TryGetPrefab<PrefabBase>(menus[i], out var prefab) && prefab?.name is not null)
				{
					names[menus[i].Index] = prefab.name;
				}
			}

			_assetMenuNames = names;
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

			for (var i = 0; i < zones.Length; i++)
			{
				var zone = zones[i];
				var info = propertiesData[i];

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
					var isRowHousing = !lotSizes.TryGetValue(zone, out var sizes) || sizes.MaxWidth <= 2;

					dictionary[zone] = isRowHousing ? ZoneTypeFilter.Row : ZoneTypeFilter.Medium;
				}
				else
				{
					dictionary[zone] = ZoneTypeFilter.High;
				}
			}

			_zoneTypeCache = dictionary;

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

				catalog.Add(new ZoneCatalogEntry(
					Id: zone.Index,
					Version: zone.Version,
					PrefabName: prefab.name,
					Name: GetAssetName(prefab),
					Family: family,
					// The ZonePropertiesData derivation is residential-specific —
					// it works off m_ResidentialProperties, which is zero for
					// commercial and office zones, so they all come back as Any.
					// Their names do carry the tier ("EU Low Density Business"),
					// so fall back to reading it rather than showing every
					// non-residential zone as untiered.
					Density: dictionary.TryGetValue(zone, out var density) && density != ZoneTypeFilter.Any
						? density
						: ZoningSurfaceCatalog.ResolveDensity(prefab.name),
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
					FootprintOverflow: zoneLots?.FootprintOverflow ?? 0));
			}

			_zoneCatalog = catalog;
			Mod.Log.Info($"Indexed Zones Count: {_zoneCatalog.Count}");
		}

		/// <summary>
		/// Every assignable zone, grouped by family in the zoning hierarchy.
		/// </summary>
		public static IReadOnlyList<ZoneCatalogEntry> GetZoneCatalog() => _zoneCatalog;

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
		public static IReadOnlyList<VanillaMenuCategory> GetMenuCategories(string? menuName) =>
			menuName is not null && _assetCategories.TryGetValue(menuName, out var tabs)
				? tabs
				: Array.Empty<VanillaMenuCategory>();

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
