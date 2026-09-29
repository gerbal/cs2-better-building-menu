using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Catalog;
using BetterBuildingMenu.Utilities;
using Colossal.Entities;
using Game.Prefabs;

using Unity.Entities;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		/// <summary>
		/// Re-publishes the extension picker's entries when the selection changes.
		/// </summary>
		/// <remarks>
		/// Polled rather than subscribed to SelectedInfoUISystem's event, because the index can
		/// change under a fixed selection too, so the generation is part of the key. The upgradable
		/// resolves as vanilla's UpgradeMenuUISystem does: an extension answers for its parent.
		/// </remarks>
		private void RefreshExtensionMenu()
		{
			var selected = _selectedInfoUISystem.selectedEntity;
			var upgradable = EntityManager.TryGetComponent<Game.Objects.Attached>(selected, out var attached)
				? attached.m_Parent
				: selected;

			if (upgradable == _extensionMenuFor && _indexer.Generation == _extensionMenuGeneration)
			{
				return;
			}

			_extensionMenuFor = upgradable;
			// Rescanned first, as a catalog refresh does: a tracker switched off raises no
			// event, and the rescan can move the generation read next.
			_indexer.SyncPlacedUniques();
			_extensionMenuGeneration = _indexer.Generation;

			if (upgradable == Entity.Null
				|| !EntityManager.TryGetComponent<PrefabRef>(upgradable, out var prefabRef)
				|| _indexer.Index.Get(prefabRef.m_Prefab.Index) is not { } building)
			{
				_BuildingExtensionMenu.Value = BuildingExtensionMenu.Empty;
				return;
			}

			PublishExtensionMenu(building, _indexer.Source);
		}

		// Its own method so the lookup's closure is allocated only on a rebuild, not on
		// every frame RefreshExtensionMenu polls and returns early.
		private void PublishExtensionMenu(PrefabIndex building, CatalogSource source)
		{
			_BuildingExtensionMenu.Value = BuildingExtensionMenu.Build(
				building.Name ?? building.PrefabName ?? string.Empty,
				// Prefab names, not the display names the hover card shows:
				// the UI joins these to vanilla's rows, which are keyed by
				// prefab.name.
				building.SupportedUpgradePrefabNames,
				prefabName => _buildingCatalogAdapter.EntryForPrefabName(source, prefabName));
		}
	}
}
