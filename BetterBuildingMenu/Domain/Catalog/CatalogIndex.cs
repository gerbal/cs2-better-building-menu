using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Utilities;

using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.Linq;

namespace BetterBuildingMenu.Domain.Catalog
{
	/// <summary>
	/// Every indexed prefab, filed twice: under everything, and under its subcategory.
	/// </summary>
	/// <remarks>
	/// A load publishes an empty one at preload, and a full pass builds a new one aside and
	/// publishes it when the pass succeeds. PrefabIndexingSystem is the only writer, on the
	/// main thread, and a partial pass or an unlock edits the published one in place, then
	/// bumps the generation. See docs/indexing.md, "A pass that fails".
	/// </remarks>
	public sealed class CatalogIndex
	{
		private readonly Dictionary<PrefabCategory, Dictionary<PrefabSubCategory, IndexedPrefabList>> _lists = new();

		// Prefab name -> entry, built on first use and dropped by anything that files,
		// removes or renames. See GetByPrefabName.
		private Dictionary<string, PrefabIndex>? _byPrefabName;

		/// <summary>An empty index with every list laid out, over the tables a full pass has read.</summary>
		/// <remarks>A table left out is empty, as before the first pass; tests build only what they read.</remarks>
		public CatalogIndex(
			VanillaMenuIndex? menus = null,
			ZoneIndex? zones = null,
			ProgressionIndex? progression = null,
			ModCompatibility? mods = null)
		{
			Menus = menus ?? VanillaMenuIndex.Empty;
			Zones = zones ?? ZoneIndex.Empty;
			Progression = progression ?? ProgressionIndex.Empty;
			Mods = mods ?? ModCompatibility.None;

			foreach (PrefabCategory category in Enum.GetValues(typeof(PrefabCategory)))
			{
				_lists[category] = new() { { PrefabSubCategory.Any, new() } };

				if (category == PrefabCategory.Any)
				{
					continue;
				}

				// A subcategory's value sits just above its category's, within the next hundred.
				foreach (PrefabSubCategory subCategory in Enum.GetValues(typeof(PrefabSubCategory)))
				{
					if ((int)subCategory > (int)category && (int)subCategory < (int)category + 100)
					{
						_lists[category][subCategory] = new();
					}
				}
			}

			All = _lists[PrefabCategory.Any][PrefabSubCategory.Any];
		}

		/// <summary>The game's own build menus, as the pass that built this index read them.</summary>
		public VanillaMenuIndex Menus { get; }

		/// <summary>The zones, as the pass that built this index read them.</summary>
		public ZoneIndex Zones { get; }

		/// <summary>The milestones and the development tree, as the pass that built this index read them.</summary>
		public ProgressionIndex Progression { get; }

		/// <summary>The mods this index adapted to, as of the pass that built it.</summary>
		public ModCompatibility Mods { get; }

		/// <summary>Whether a pass has filled it; until then the panel shows the indexing notice.</summary>
		public bool IsReady { get; internal set; }

		/// <summary>Every entry, in name order.</summary>
		public IndexedPrefabList All { get; }

		/// <summary>The entries filed under one subcategory, or null for a pair that is not laid out.</summary>
		public IndexedPrefabList? List(PrefabCategory category, PrefabSubCategory subCategory) =>
			_lists.TryGetValue(category, out var subCategories) && subCategories.TryGetValue(subCategory, out var list)
				? list
				: null;

		/// <summary>A category's lists, its own <see cref="PrefabSubCategory.Any"/> included.</summary>
		/// <remarks>Projected rather than the dictionary itself, which a caller could cast back and edit.</remarks>
		public IEnumerable<KeyValuePair<PrefabSubCategory, IndexedPrefabList>> ListsIn(PrefabCategory category) =>
			_lists.TryGetValue(category, out var subCategories)
				? subCategories.Select(pair => pair)
				: Enumerable.Empty<KeyValuePair<PrefabSubCategory, IndexedPrefabList>>();

		/// <summary>The entry for a prefab entity's index, or null when nothing indexed it.</summary>
		public PrefabIndex? Get(int id) => All.TryGetValue(id, out var entry) ? entry : null;

		/// <summary>The entry a prefab name resolves to, or null when nothing indexed carries it.</summary>
		/// <remarks>
		/// Two prefab types can carry one name, and then the first entry in name order answers,
		/// for every caller: the extension picker drawing an upgrade's row and a partial pass
		/// replacing a prefab the game recreated. Built once, on the first lookup after a
		/// change, rather than kept in step with every edit: a pass files thousands of entries
		/// and looks names up rarely.
		/// </remarks>
		public PrefabIndex? GetByPrefabName(string prefabName)
		{
			if (_byPrefabName is null)
			{
				_byPrefabName = new Dictionary<string, PrefabIndex>(StringComparer.Ordinal);

				foreach (var entry in All)
				{
					if (entry.PrefabName is { Length: > 0 } name && !_byPrefabName.ContainsKey(name))
					{
						_byPrefabName[name] = entry;
					}
				}
			}

			return _byPrefabName.TryGetValue(prefabName, out var found) ? found : null;
		}

		public PrefabBase? GetPrefab(int id) => Get(id)?.Prefab;

		/// <summary>The tab strip for a menu, empty when the menu has none.</summary>
		/// <remarks>Roads gets more tabs than the game gives it: the lens gathers every network there
		/// (see <see cref="NetworkMenuExtension"/>), so the strip has to offer the extras too.</remarks>
		public IReadOnlyList<VanillaMenuCategory> GetMenuCategories(string? menu)
		{
			var tabs = Menus.CategoriesOf(menu);

			if (!NetworkMenuExtension.IsExtended(menu) || tabs.Count == 0)
			{
				return tabs;
			}

			return tabs.Concat(ExtraNetworkCategories()).ToArray();
		}

		/// <summary>A tab for each kind of network the Roads menu does not already hold.</summary>
		/// <remarks>Built from what is indexed rather than from the enum, so a subcategory with nothing
		/// in it draws no tab. Ids match what NetworkMenuExtension.Reframe writes onto the entries.</remarks>
		private IEnumerable<VanillaMenuCategory> ExtraNetworkCategories()
		{
			foreach (var pair in ListsIn(PrefabCategory.Networks).OrderBy(pair => (int)pair.Key))
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

		/// <summary>Files an entry in the two lists it belongs to: everything, and its own subcategory's.</summary>
		/// <remarks>
		/// An entry already filed under the same id is taken out of its own list first. Two
		/// processors can claim one prefab, and the later entry would otherwise replace the
		/// earlier one only in the list they share, leaving it listed under the earlier
		/// category too. A category's <see cref="PrefabSubCategory.Any"/> list holds only the
		/// entries filed under the category alone, as a Find It override can file them, not a
		/// second copy of the whole category: nothing reads one.
		/// </remarks>
		internal void File(PrefabIndex entry)
		{
			Remove(entry.Id);

			All[entry.Id] = entry;
			_lists[entry.Category][entry.SubCategory][entry.Id] = entry;
			_byPrefabName = null;
		}

		internal void Remove(int id)
		{
			if (All.TryGetValue(id, out var entry))
			{
				All.Remove(entry);
				_lists[entry.Category][entry.SubCategory].Remove(entry);
				_byPrefabName = null;
			}
		}

		/// <summary>Numbers the display names that repeat, so each row can be told apart.</summary>
		/// <remarks>
		/// Every pass, partial ones too: one re-read prefab takes back its plain name, and its
		/// namesakes' numbers are only right if all of them are counted again. Upgrades are left
		/// out: every school type has an "Extension Wing", and they are never listed beside each
		/// other, only on their own parent's picker, where "Extension Wing 2" has no referent.
		/// </remarks>
		internal void NumberDuplicateNames()
		{
			var numbered = All.Where(entry => !entry.IsServiceUpgrade).ToList();
			var names = DuplicateNameNumbering.Names(numbered.Select(entry => (entry.AssetName, entry.PrefabName)).ToList());

			for (var i = 0; i < numbered.Count; i++)
			{
				numbered[i].Name = names[i];
			}

			// Every list is in name order, and so is the name map's choice between namesakes.
			foreach (var (_, _, list) in Lists())
			{
				list.ResetOrder();
			}

			_byPrefabName = null;
		}

		/// <summary>Takes any entry that shares a brand's prefab name out of its subcategory's list.</summary>
		/// <returns>How many it took out.</returns>
		/// <remarks>
		/// Everything and the brands' own list are left alone, so the catalog, which reads
		/// everything, still lists them; only the subcategory lists change, and the Roads menu's
		/// extra tabs are the only reader of those. Kept, and counted, until a game session
		/// shows whether it ever finds anything.
		/// </remarks>
		internal int RemoveBrandDuplicates()
		{
			var branding = List(PrefabCategory.Props, PrefabSubCategory.Props_Branding);
			var brands = new HashSet<string>(branding?.Select(entry => entry.PrefabName) ?? Enumerable.Empty<string>());
			var removed = 0;

			foreach (var (category, subCategory, list) in Lists())
			{
				if (category is PrefabCategory.Any
					|| subCategory is PrefabSubCategory.Props_Branding
					|| (category is PrefabCategory.Props && subCategory is PrefabSubCategory.Any))
				{
					continue;
				}

				foreach (var entry in list.ToList())
				{
					if (brands.Contains(entry.PrefabName))
					{
						list.Remove(entry);
						removed++;
					}
				}
			}

			return removed;
		}

		/// <summary>Every list, for the clean-up passes.</summary>
		internal IEnumerable<(PrefabCategory Category, PrefabSubCategory SubCategory, IndexedPrefabList List)> Lists() =>
			_lists.SelectMany(category => category.Value.Select(sub => (category.Key, sub.Key, sub.Value)));
	}
}
