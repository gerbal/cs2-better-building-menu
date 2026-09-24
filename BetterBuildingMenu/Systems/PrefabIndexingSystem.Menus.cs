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
	// The vanilla build menus: where the game places each asset, and the menus and categories it draws.
	public partial class PrefabIndexingSystem
	{
		/// <summary>Records where the vanilla build menu places each asset, walking the game's own
		/// group tree from the menus downward.</summary>
		/// <remarks>The direction is the whole point; see docs/indexing.md, "The vanilla menu walk".</remarks>
		private Dictionary<int, VanillaMenuPlacement> IndexVanillaMenuPlacements()
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

			Mod.Log.Info($"Indexed Vanilla Menu Placements: {placements.Count}");

			return placements;
		}

		/// <summary>Reads the vanilla toolbar's asset menus: by entity index, so a menu selection
		/// arriving from the UI can be resolved to a prefab name, and by name, so the lens can open one.</summary>
		/// <remarks>The list is in the bottom bar's order; see <see cref="ToolbarOrder"/>.</remarks>
		private (Dictionary<int, string> Names, Dictionary<string, Entity> Entities, List<VanillaMenuCategory> Menus) IndexAssetMenus()
		{
			var query = GetEntityQuery(
				ComponentType.ReadOnly<UIAssetMenuData>(),
				ComponentType.ReadOnly<PrefabData>());
			var menus = query.ToEntityArray(Allocator.Temp);
			var names = new Dictionary<int, string>();
			var entities = new Dictionary<string, Entity>(System.StringComparer.OrdinalIgnoreCase);
			var found = new List<(Entity Menu, VanillaMenuCategory Record)>();

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
				found.Add((menus[i], new VanillaMenuCategory(
					Id: prefab.name,
					Name: prefab.name,
					Icon: IconPath.Normalize(CategoryIcon.Resolve(uIObject?.m_Icon, _imageSystem.GetIconOrGroupIcon(menus[i]))) ?? string.Empty,
					Priority: uIObject?.m_Priority ?? 0)));
			}

			// A menu the bottom bar does not hold goes last, by priority and then query
			// order; if the toolbar walk fails, every menu does.
			Dictionary<Entity, int> onToolbar;

			try
			{
				onToolbar = ToolbarOrder();
			}
			catch (Exception ex)
			{
				Mod.Log.Error(ex, "Reading the bottom bar's menu order failed; menus fall back to priority order");
				onToolbar = new Dictionary<Entity, int>();
			}

			var list = found
				.OrderBy(menu => onToolbar.TryGetValue(menu.Menu, out var place) ? place : int.MaxValue)
				.ThenBy(menu => menu.Record.Priority)
				.Select(menu => menu.Record)
				.ToList();

			Mod.Log.Info($"Indexed Asset Menus Count: {names.Count}");

			return (names, entities, list);
		}

		/// <summary>Where each asset menu sits on the bottom bar, counted from 0.</summary>
		/// <remarks>ToolbarUISystem's own steps: the groups by UIToolbarGroupData.m_Priority, then
		/// each group's members by UIObjectInfo. That sort is not stable, so only the same steps give
		/// the player's order.</remarks>
		private Dictionary<Entity, int> ToolbarOrder()
		{
			var order = new Dictionary<Entity, int>();
			var query = GetEntityQuery(
				ComponentType.ReadOnly<PrefabData>(),
				ComponentType.ReadOnly<UIGroupElement>(),
				ComponentType.ReadOnly<UIToolbarGroupData>());

			using var groups = query.ToEntityArray(Allocator.Temp);
			using var groupData = query.ToComponentDataArray<UIToolbarGroupData>(Allocator.Temp);
			// Not a using: a using variable cannot be written through its indexer.
			var sortedGroups = new NativeArray<UIObjectInfo>(groups.Length, Allocator.Temp);

			try
			{
				for (var i = 0; i < groups.Length; i++)
				{
					sortedGroups[i] = new UIObjectInfo(groups[i], groupData[i].m_Priority);
				}

				sortedGroups.Sort();

				foreach (var group in sortedGroups)
				{
					using var members = UIObjectInfo.GetObjects(
						EntityManager,
						EntityManager.GetBuffer<UIGroupElement>(group.entity, isReadOnly: true),
						Allocator.Temp);
					members.Sort();

					foreach (var member in members)
					{
						if (EntityManager.HasComponent<UIAssetMenuData>(member.entity) && !order.ContainsKey(member.entity))
						{
							order[member.entity] = order.Count;
						}
					}
				}
			}
			finally
			{
				sortedGroups.Dispose();
			}

			return order;
		}

		/// <summary>Reads each menu's category tabs, which are vanilla's second tier, in the order the
		/// game draws them.</summary>
		/// <remarks>A category joins its menu's UIGroupElement buffer when UIAssetCategoryPrefab
		/// initializes, so the menu's members are its categories. See <see cref="SortedCategories"/>.</remarks>
		private Dictionary<string, List<VanillaMenuCategory>> IndexAssetCategories()
		{
			var query = GetEntityQuery(
				ComponentType.ReadOnly<UIAssetMenuData>(),
				ComponentType.ReadOnly<UIGroupElement>(),
				ComponentType.ReadOnly<PrefabData>());
			using var menus = query.ToEntityArray(Allocator.Temp);
			var byMenu = new Dictionary<string, List<VanillaMenuCategory>>();

			for (var i = 0; i < menus.Length; i++)
			{
				if (!_prefabSystem.TryGetPrefab<PrefabBase>(menus[i], out var menu) || menu?.name is not string menuName)
				{
					continue;
				}

				// A member removed late in the frame can break GetObjects; that costs
				// this menu its tabs for the pass, not the pass.
				NativeList<UIObjectInfo> sorted;

				try
				{
					sorted = SortedCategories(menus[i]);
				}
				catch (Exception ex)
				{
					Mod.Log.Error(ex, $"Reading the tabs of menu {menuName} failed; it has none this pass");
					continue;
				}

				using var disposeSorted = sorted;

				foreach (var tab in sorted)
				{
					if (!_prefabSystem.TryGetPrefab<PrefabBase>(tab.entity, out var prefab) || prefab?.name is null)
					{
						continue;
					}

					prefab.TryGet<UIObject>(out var uIObject);

					// Two menus sharing a prefab name share one list.
					if (!byMenu.TryGetValue(menuName, out var tabs))
					{
						tabs = new List<VanillaMenuCategory>();
						byMenu[menuName] = tabs;
					}

					tabs.Add(new VanillaMenuCategory(
						Id: prefab.name,
						Name: prefab.name,
						Icon: IconPath.Normalize(CategoryIcon.Resolve(uIObject?.m_Icon, _imageSystem.GetIconOrGroupIcon(tab.entity))) ?? string.Empty,
						// The priority the tabs were sorted by, UIObjectData's, so the UI's
						// stable re-sort by it leaves them in vanilla's order.
						Priority: tab.priority));
				}
			}

			Mod.Log.Info($"Indexed Asset Categories: {byMenu.Count} menus, {byMenu.Values.Sum(list => list.Count)} tabs");

			return byMenu;
		}

		/// <summary>A menu's category tabs, as ToolbarUISystem.GetSortedCategories orders them.</summary>
		/// <remarks>Transcribed step for step: a member that is not a category, or is empty, is
		/// removed swap-back, then Unity's unstable sort by priority, so only the same steps give the
		/// player's order.</remarks>
		private NativeList<UIObjectInfo> SortedCategories(Entity menu)
		{
			var objects = UIObjectInfo.GetObjects(
				EntityManager,
				EntityManager.GetBuffer<UIGroupElement>(menu, isReadOnly: true),
				Allocator.Temp);

			for (var i = objects.Length - 1; i >= 0; i--)
			{
				if (!EntityManager.HasComponent<UIAssetCategoryData>(objects[i].entity)
					|| !EntityManager.TryGetBuffer<UIGroupElement>(objects[i].entity, true, out var members)
					|| members.Length == 0)
				{
					objects.RemoveAtSwapBack(i);
				}
			}

			objects.Sort();

			return objects;
		}
	}
}
