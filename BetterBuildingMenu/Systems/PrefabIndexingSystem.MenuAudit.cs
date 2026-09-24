using Colossal.Core;
using Colossal.Entities;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.Mathematics;
using Colossal.PSI.Common;
using Colossal.Serialization.Entities;

using BetterBuildingMenu.Domain;
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
	// The census and coverage report that check the index against the game's own menus. The
	// counting and wording live in VanillaMenuAudit, VanillaMenuCoverage and IndexAuditLog; what
	// stays here asks the game about prefabs and logs the lines.
	public partial class PrefabIndexingSystem
	{
		/// <summary>A per-menu census of the vanilla build menu, in both directions.</summary>
		/// <remarks>A census rather than an alarm, logged at Info whether or not anything is wrong.
		/// See docs/indexing.md, "The menu audit".</remarks>
		private void LogVanillaMenuAudit()
		{
			try
			{
				// Null when the prefab cannot be resolved, so the line names the entity,
				// as the coverage report does, rather than printing a blank.
				var report = VanillaMenuAudit.Gather(
					Index,
					placement => _prefabSystem.TryGetPrefab<PrefabBase>(placement.Entity, out var placed)
						? placed?.name
						: null);

				Log(IndexAuditLog.MenuAuditHeader(report, Index.All.Count, Index.Zones.Catalog.Count));
				LogDlcAudit();
				Log(IndexAuditLog.MenuAuditBody(report));
			}
			catch (Exception ex)
			{
				Mod.Log.Error(ex, "[MENU-AUDIT] failed");
			}
		}

		/// <summary>What the first-party content packs actually contribute.</summary>
		/// <remarks>Two very different causes look identical from the UI: the prefabs may be absent,
		/// or present and filtered for being unowned. This says which.</remarks>
		private void LogDlcAudit()
		{
			try
			{
				var platform = PlatformManager.instance;

				var byDlc = Index.All
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
		}

		/// <summary>Reports every asset the vanilla build menu shows that our index does not.</summary>
		/// <remarks>Logged rather than thrown: a gap is a real state of the game — a mod can add a menu
		/// whose assets we have no processor for — and a short menu beats a dead one.</remarks>
		private void LogVanillaMenuCoverage()
		{
			try
			{
				Log(IndexAuditLog.MenuCoverage(VanillaMenuCoverage.Compare(Index, DescribeMissing)));
			}
			catch (Exception ex)
			{
				Mod.Log.Error(ex, "[MENU-COVERAGE] report failed");
			}
		}

		/// <summary>Why an asset vanilla places is not in the index: the editor categories the
		/// processors read, and the components their queries key on.</summary>
		/// <remarks>The prefab's own type is reported because it names what a processor would have
		/// to query to reach it, which is the next question every gap raises.</remarks>
		private string DescribeMissing(VanillaMenuPlacement placement)
		{
			var assetEntity = placement.Entity;

			if (!_prefabSystem.TryGetPrefab<PrefabBase>(assetEntity, out var assetPrefab) || assetPrefab?.name is null)
			{
				return $"entity:{assetEntity.Index}";
			}

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

		private static void Log(IEnumerable<AuditLine> lines)
		{
			foreach (var line in lines)
			{
				if (line.Severity == AuditSeverity.Warn)
				{
					Mod.Log.Warn(line.Text);
				}
				else
				{
					Mod.Log.Info(line.Text);
				}
			}
		}
	}
}
