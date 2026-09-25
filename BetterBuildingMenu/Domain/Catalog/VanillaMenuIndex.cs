using System;
using System.Collections.Generic;
using System.Linq;

using Unity.Entities;

namespace BetterBuildingMenu.Domain.Catalog
{
	/// <summary>
	/// The game's own build menus as a full pass read them: where each asset is placed, as the
	/// latest pass read it, and the menus and category tabs it draws.
	/// </summary>
	/// <remarks>
	/// Not changed once built; a new pass builds a new one, handing over tables it keeps no hold on,
	/// and a partial pass swaps in a copy with its placements read again. The walk that fills it is
	/// in PrefabIndexingSystem; see docs/indexing.md, "The vanilla menu walk".
	/// </remarks>
	public sealed class VanillaMenuIndex
	{
		private readonly IReadOnlyDictionary<int, VanillaMenuPlacement> _placements;
		private readonly IReadOnlyDictionary<int, string> _menuNames;
		private readonly IReadOnlyDictionary<string, Entity> _menuEntities;
		private readonly IReadOnlyList<VanillaMenuCategory> _menus;
		private readonly IReadOnlyDictionary<string, List<VanillaMenuCategory>> _categories;

		/// <summary>No menus at all, as before the first pass.</summary>
		public static VanillaMenuIndex Empty { get; } = new(
			new Dictionary<int, VanillaMenuPlacement>(),
			new Dictionary<int, string>(),
			new Dictionary<string, Entity>(),
			Array.Empty<VanillaMenuCategory>(),
			new Dictionary<string, List<VanillaMenuCategory>>());

		/// <param name="placements">Where the game places each asset, by prefab entity index.</param>
		/// <param name="menuNames">Each menu's prefab name, by its entity index.</param>
		/// <param name="menuEntities">Each menu's entity, by prefab name. Looked up ignoring case,
		/// whatever comparer the caller's dictionary has.</param>
		/// <param name="menus">Every menu, in the game's order.</param>
		/// <param name="categories">Each menu's category tabs, by menu name, in the game's order.</param>
		public VanillaMenuIndex(
			IReadOnlyDictionary<int, VanillaMenuPlacement> placements,
			IReadOnlyDictionary<int, string> menuNames,
			IReadOnlyDictionary<string, Entity> menuEntities,
			IReadOnlyList<VanillaMenuCategory> menus,
			IReadOnlyDictionary<string, List<VanillaMenuCategory>> categories)
		{
			_placements = placements;
			_menuNames = menuNames;
			_menuEntities = IgnoringCase(menuEntities);
			_menus = menus;
			_categories = categories;
		}

		/// <summary>Every placement, for the audits and AddPrefab's placement override.</summary>
		public IReadOnlyDictionary<int, VanillaMenuPlacement> Placements => _placements;

		/// <summary>The same menus and tabs over placements read again.</summary>
		/// <remarks>A partial pass's: the game moves a recreated prefab to a new entity, and the
		/// placements are keyed by entity. The menus and their tabs wait for the next full pass.</remarks>
		public VanillaMenuIndex WithPlacements(IReadOnlyDictionary<int, VanillaMenuPlacement> placements) =>
			new(placements, _menuNames, _menuEntities, _menus, _categories);

		/// <summary>Whether the game offers this prefab in any of its build menus.</summary>
		/// <remarks>The index's tie-breaker: whatever the game puts in front of the player, the lens
		/// carries too, whichever of our own rules would drop it. It also keeps networks the game never
		/// offers out of the Roads menu's gathering.</remarks>
		public bool IsPlaced(int entityIndex) => _placements.ContainsKey(entityIndex);

		/// <summary>Whether the game places this asset in that named menu.</summary>
		/// <remarks>The downward read. Its opposite number, <c>PrefabIndex.UiMenuName</c>, reads upward
		/// from an asset we hold, so it can only ever describe assets some processor indexed.</remarks>
		public bool IsPlacedIn(int entityIndex, string menu) =>
			_placements.TryGetValue(entityIndex, out var placement)
			&& string.Equals(placement.Menu?.Trim(), menu, StringComparison.OrdinalIgnoreCase);

		/// <summary>The vanilla menu category an asset is placed in, when the game places it at all.</summary>
		public bool TryGetCategory(int entityIndex, out string category)
		{
			category = string.Empty;

			if (!_placements.TryGetValue(entityIndex, out var placement) || placement.Category?.Trim() is not { Length: > 0 } trimmed)
			{
				return false;
			}

			category = trimmed;
			return true;
		}

		/// <summary>A menu's own entity, by the name the lens scopes itself with.</summary>
		/// <remarks>Keyed off the menu name: the lens knows which menu it took over without holding
		/// an asset from it.</remarks>
		public bool TryGetMenuEntity(string menu, out Entity entity)
		{
			// Entity.Null is default(Entity), spelt so because the mock game assemblies
			// the tests run against give that getter no body.
			entity = default;

			return menu?.Trim() is { Length: > 0 } trimmed
				&& _menuEntities.TryGetValue(trimmed, out entity);
		}

		/// <summary>The prefab name of a vanilla toolbar asset menu, by entity index.</summary>
		/// <remarks>The UI reads the game's toolbar.selectedAssetMenu binding but receives only an
		/// entity, and entity indices are runtime values that must not be persisted.</remarks>
		public string? MenuName(int entityIndex) => _menuNames.TryGetValue(entityIndex, out var name) ? name : null;

		/// <summary>Every vanilla menu that has something in it, in the game's order.</summary>
		/// <remarks>Filtered to menus with at least one category tab, the same test vanilla applies
		/// before drawing one: a menu whose categories are all empty is a button the game hides.</remarks>
		public IReadOnlyList<VanillaMenuCategory> AssetMenus() =>
			_menus.Where(menu => _categories.ContainsKey(menu.Id)).ToArray();

		/// <summary>A menu's own category tabs, empty when it has none.</summary>
		public IReadOnlyList<VanillaMenuCategory> CategoriesOf(string? menu) =>
			menu is not null && _categories.TryGetValue(menu, out var tabs)
				? tabs
				: Array.Empty<VanillaMenuCategory>();

		/// <summary>A category's tab in its menu's strip: its place there, counted from 0, and the
		/// priority the strip was sorted by. Null when the menu draws no such tab.</summary>
		public (int Position, int Priority)? TabOf(string? menu, string? category)
		{
			if (category?.Trim() is not { Length: > 0 } trimmed)
			{
				return null;
			}

			var tabs = CategoriesOf(menu);

			for (var i = 0; i < tabs.Count; i++)
			{
				if (string.Equals(tabs[i].Id, trimmed, StringComparison.Ordinal))
				{
					return (i, tabs[i].Priority);
				}
			}

			return null;
		}

		// The UI names a menu the way the player's toolbar does, which need not match the
		// prefab's case. A copy, so the comparison holds whoever built the dictionary.
		private static Dictionary<string, Entity> IgnoringCase(IReadOnlyDictionary<string, Entity> byName)
		{
			var copy = new Dictionary<string, Entity>(StringComparer.OrdinalIgnoreCase);

			foreach (var pair in byName)
			{
				copy[pair.Key] = pair.Value;
			}

			return copy;
		}
	}
}
