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
	// The census and coverage report that check the index against the game's own menus.
	public partial class PrefabIndexingSystem
	{
		/// <summary>A per-menu census of the vanilla build menu, in both directions.</summary>
		/// <remarks>A census rather than an alarm, logged at Info whether or not anything is wrong; the
		/// arithmetic lives in <see cref="VanillaMenuAudit"/>. See docs/indexing.md, "The menu audit".</remarks>
		private void LogVanillaMenuAudit()
		{
			try
			{
				var indexed = Index.All;

				// Everything we hold at all, menu or not. Zones included
				// deliberately — leaving them out is the blindness this exists
				// to remove.
				var held = new HashSet<int>(indexed.Select(entry => entry.Id));

				foreach (var zone in _zoneCatalog)
				{
					held.Add(zone.Id);
				}

				var report = VanillaMenuAudit.Compare(
					Index.Menus.Placements.Values.Select(placement => new VanillaMenuPlacementFact(
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
				var indexed = Index.All;
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

				foreach (var placement in Index.Menus.Placements.Values)
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

				var summary = $"[MENU-COVERAGE] vanilla shows {Index.Menus.Placements.Count} assets across its menus; "
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
	}
}
