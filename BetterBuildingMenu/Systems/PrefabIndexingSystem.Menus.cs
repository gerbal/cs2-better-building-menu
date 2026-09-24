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
		/// <remarks>The direction is the whole point; see docs/indexing.md, "The vanilla menu walk".
		/// A partial pass walks again, since the game moves a recreated prefab to a new entity.</remarks>
		/// <returns>False when the walk threw; <paramref name="placements"/> then holds what it read
		/// before that.</returns>
		private bool TryIndexVanillaMenuPlacements(bool full, out Dictionary<int, VanillaMenuPlacement> placements)
		{
			placements = new Dictionary<int, VanillaMenuPlacement>();
			var complete = true;

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
						if (!IsLive(categoryEntity)
							|| !EntityManager.HasComponent<UIAssetCategoryData>(categoryEntity)
							|| !EntityManager.TryGetBuffer<UIGroupElement>(categoryEntity, true, out var assets)
							|| assets.Length == 0
							|| !_prefabSystem.TryGetPrefab<PrefabBase>(categoryEntity, out var categoryPrefab))
						{
							continue;
						}

						for (var a = 0; a < assets.Length; a++)
						{
							var assetEntity = assets[a].m_Prefab;

							if (!IsLive(assetEntity) || EntityManager.HasComponent<ServiceUpgradeData>(assetEntity))
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
				complete = false;
				Mod.Log.Error(ex, "[MENU-COVERAGE] walk failed");
			}

			// A partial pass can run every frame a mod edits prefabs.
			var message = $"Indexed Vanilla Menu Placements: {placements.Count}";

			if (full)
			{
				Mod.Log.Info(message);
			}
			else
			{
				Mod.Log.Debug(message);
			}

			return complete;
		}

		/// <summary>Whether a group's member is still a prefab the game holds.</summary>
		/// <remarks>PrefabSystem.RemovePrefab only marks the entity Deleted: it stays in its group's
		/// buffer, and still does once the frame's clean-up destroys it, when its index can be handed
		/// to another entity. ReplacePrefabSystem takes a recreated prefab's old entity out itself.</remarks>
		private bool IsLive(Entity entity) =>
			EntityManager.Exists(entity) && !EntityManager.HasComponent<Deleted>(entity);

		/// <summary>Reads the vanilla toolbar's asset menus: by entity index, so a menu selection
		/// arriving from the UI can be resolved to a prefab name, and by name, so the lens can open one.</summary>
		private (Dictionary<int, string> Names, Dictionary<string, Entity> Entities, List<VanillaMenuCategory> Menus) IndexAssetMenus()
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

			Mod.Log.Info($"Indexed Asset Menus Count: {names.Count}");

			return (names, entities, list);
		}

		/// <summary>Reads each menu's category tabs, which are vanilla's second tier.</summary>
		/// <remarks>A category that names no menu is not a build-menu tab — UIAssetCategoryPrefab adds
		/// UIAssetCategoryData only when m_Menu is set — so that check is belt and braces.</remarks>
		private Dictionary<string, List<VanillaMenuCategory>> IndexAssetCategories()
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

			Mod.Log.Info($"Indexed Asset Categories: {byMenu.Count} menus, {byMenu.Values.Sum(list => list.Count)} tabs");

			return byMenu;
		}
	}
}
