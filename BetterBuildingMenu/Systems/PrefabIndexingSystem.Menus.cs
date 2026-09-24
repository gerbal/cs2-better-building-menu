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

		/// <summary>Whether the vanilla build menu offers this prefab to the player.</summary>
		/// <remarks>The index's tie-breaker: whatever the game puts in front of the player, the lens
		/// carries too, whichever of our own rules — the blacklist, the brush filter — would drop it.</remarks>
		public static bool IsPlacedInVanillaMenu(int entityIndex) =>
			_menuPlacements.ContainsKey(entityIndex);

		/// <summary>The vanilla menu that holds an asset, as an entity the game's toolbar accepts.</summary>
		/// <remarks>Fails for anything the game places in no menu — most assets — so the caller needs a
		/// fallback.</remarks>
		public static bool TryGetMenuEntityFor(int assetEntityIndex, out Entity menu)
		{
			menu = Entity.Null;

			return _menuPlacements.TryGetValue(assetEntityIndex, out var placement)
				&& placement.Menu is not null
				&& _assetMenuEntities.TryGetValue(placement.Menu.Trim(), out menu);
		}

		/// <summary>A menu's own entity, by the name the lens scopes itself with.</summary>
		/// <remarks>The same table <see cref="TryGetMenuEntityFor"/> reaches through, keyed straight
		/// off the menu name: the lens knows which menu it took over without holding an asset from it.</remarks>
		public static bool TryGetAssetMenuEntity(string menu, out Entity entity)
		{
			entity = Entity.Null;

			return !string.IsNullOrWhiteSpace(menu)
				&& _assetMenuEntities.TryGetValue(menu.Trim(), out entity);
		}

		/// <summary>Whether the game places this asset in that named menu.</summary>
		/// <remarks>The downward read. Its opposite number, <c>PrefabIndex.UiMenuName</c>, reads upward
		/// from an asset we hold, so it can only ever describe assets some processor indexed.</remarks>
		public static bool IsPlacedInMenu(int entityIndex, string menu) =>
			_menuPlacements.TryGetValue(entityIndex, out var placement)
			&& string.Equals(placement.Menu?.Trim(), menu, System.StringComparison.OrdinalIgnoreCase);

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

		/// <summary>Whether the game places this asset in any menu at all.</summary>
		/// <remarks>The guard on the Roads menu's network gathering: the index also holds networks the
		/// game never offers, and admitting those would put unplaceable rows in that menu.</remarks>
		public static bool IsPlacedInAnyMenu(int entityIndex) =>
			_menuPlacements.ContainsKey(entityIndex);

		/// <summary>Caches the vanilla toolbar's asset menus by entity index, so a menu selection
		/// arriving from the UI can be resolved to a prefab name.</summary>
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

			_assetMenuNames = names;
			_assetMenuEntities = entities;
			_assetMenus = list;
			Mod.Log.Info($"Indexed Asset Menus Count: {_assetMenuNames.Count}");
		}

		/// <summary>Caches each menu's category tabs, which are vanilla's second tier.</summary>
		/// <remarks>A category that names no menu is not a build-menu tab — UIAssetCategoryPrefab adds
		/// UIAssetCategoryData only when m_Menu is set — so that check is belt and braces.</remarks>
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

			_assetCategories = byMenu;
			Mod.Log.Info($"Indexed Asset Categories: {byMenu.Count} menus, {byMenu.Values.Sum(list => list.Count)} tabs");
		}

		/// <summary>The tab strip for a menu, empty when the menu has none.</summary>
		/// <remarks>Roads gets more tabs than the game gives it: the lens gathers every network there
		/// (see <see cref="NetworkMenuExtension"/>), so the strip has to offer the extras too.</remarks>
		public static IReadOnlyList<VanillaMenuCategory> GetMenuCategories(CatalogIndex index, string? menuName)
		{
			var tabs = menuName is not null && _assetCategories.TryGetValue(menuName, out var found)
				? found
				: (IReadOnlyList<VanillaMenuCategory>)Array.Empty<VanillaMenuCategory>();

			if (!NetworkMenuExtension.IsExtended(menuName) || tabs.Count == 0)
			{
				return tabs;
			}

			return tabs.Concat(GetExtraNetworkCategories(index)).ToArray();
		}

		/// <summary>A tab for each kind of network the Roads menu does not already hold.</summary>
		/// <remarks>Built from what is indexed rather than from the enum, so a subcategory with nothing
		/// in it draws no tab. Ids match what NetworkMenuExtension.Reframe writes onto the entries.</remarks>
		private static IEnumerable<VanillaMenuCategory> GetExtraNetworkCategories(CatalogIndex index)
		{
			foreach (var pair in index.ListsIn(PrefabCategory.Networks).OrderBy(pair => (int)pair.Key))
			{
				if (pair.Key == PrefabSubCategory.Any || pair.Value.Count == 0)
				{
					continue;
				}

				// Only the ones that arrive through the extension. A subcategory whose
				// members are all in the Roads menu already has vanilla tabs covering
				// them, and a second tab over the same assets would split the roads.
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

		/// <summary>Every vanilla menu that has something in it, in the game's order.</summary>
		/// <remarks>Filtered to menus with at least one category tab, the same test vanilla applies
		/// before drawing one: a menu whose categories are all empty is a button the game hides.</remarks>
		public static IReadOnlyList<VanillaMenuCategory> GetAssetMenus() =>
			_assetMenus.Where(menu => _assetCategories.ContainsKey(menu.Id)).ToArray();

		/// <summary>The prefab name of a vanilla toolbar asset menu, by entity index.</summary>
		/// <remarks>The UI reads the game's toolbar.selectedAssetMenu binding but receives only an
		/// entity, and entity indices are runtime values that must not be persisted.</remarks>
		public static string? GetAssetMenuName(int entityIndex) => _assetMenuNames.TryGetValue(entityIndex, out var name)
			? name
			: null;
	}
}
