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
	// The zone catalog: every assignable zone, its density and lot sizes, and the extractor areas.
	public partial class PrefabIndexingSystem
	{
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
				+ Cap(unplaced.Select(entry => $"{entry.Name} [{entry.PrefabName}]").ToList()));

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
		public static ZoneLotSizes? GetZoneLotSizes(Entity zonePrefab) =>
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
	}
}
