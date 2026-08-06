using Colossal.Core;
using Colossal.Entities;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.PSI.Common;
using Colossal.Serialization.Entities;

using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using FindItBuildingMenu.Domain.Interfaces;
using FindItBuildingMenu.Utilities;

using Game;
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
			prefabIndex.IsVanilla = prefab.isBuiltin || prefab.Has<FindItGenerated>();
			prefabIndex.HasParking = prefabIndex.Category is PrefabCategory.Buildings or PrefabCategory.ServiceBuildings && HasParking(prefab);
			// Enableable: presence alone would mark every unlockable asset
			// locked forever, including the ones already earned.
			prefabIndex.IsLocked = EntityManager.HasEnabledComponent<Locked>(entity);
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

		private void PopulateAnalyticalData(Entity entity, PrefabIndex prefabIndex)
		{
			if (prefabIndex.Category is not PrefabCategory.Buildings and not PrefabCategory.ServiceBuildings)
			{
				return;
			}

			if (EntityManager.TryGetComponent<PlaceableObjectData>(entity, out var placeableData))
			{
				prefabIndex.ConstructionCost = placeableData.m_ConstructionCost;
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

		private bool HasParking(PrefabBase prefab)
		{
			if (prefab.TryGet<SpawnLocation>(out var spawnLocation) && spawnLocation.m_ConnectionType == RouteConnectionType.Parking)
			{
				return true;
			}

			if (prefab.TryGet<ObjectSubLanes>(out var subLanes) && subLanes.m_SubLanes is not null)
			{
				foreach (var lane in subLanes.m_SubLanes)
				{
					if (lane.m_LanePrefab.Has<ParkingLane>())
					{
						return true;
					}
				}
			}

			if (prefab.TryGet<ObjectSubObjects>(out var subObjects) && subObjects.m_SubObjects is not null)
			{
				foreach (var obj in subObjects.m_SubObjects)
				{
					if (obj.m_Object is not null && HasParking(obj.m_Object))
					{
						return true;
					}
				}
			}

			return false;
		}
	}
}
