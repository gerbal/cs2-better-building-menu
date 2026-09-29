using BetterBuildingMenu.Utilities;
using Game.Prefabs;
using Game.Tools;

using System;

namespace BetterBuildingMenu.Systems
{
    internal partial class BuildingMenuUISystem : ExtendedUISystemBase
	{
		internal void TryActivatePrefabTool(int id)
		{
			var prefabBase = _indexer.Index.GetPrefab(id);
			_interactionBoundary.TryActivatePrefab(
				id,
				prefabBase is not null,
				_toolSystem.activePrefab == prefabBase,
				// The boundary calls this only when the prefab exists, which the lambda cannot see.
				() => ActivatePrefabTool(
					id,
					prefabBase ?? throw new InvalidOperationException($"Prefab {id} was armed without existing.")));
		}

		private void ActivatePrefabTool(int id, PrefabBase prefabBase)
		{
			settingPrefab = true;
			_toolSystem.ActivatePrefabTool(prefabBase);
			_ActivePrefabId.Value = id;
			settingPrefab = false;
		}

		private void OnPrefabChanged(PrefabBase prefab)
		{
			// A prefab we did not arm ourselves normally means the player picked something in
			// vanilla's own UI, and the polite answer is to get out of its way. The binding is
			// mirrored first: it is a fact about what the GAME has armed, not a record of who set it.
			if (prefab is null)
			{
				_ActivePrefabId.Value = 0;
			}
			else if (_prefabSystem.TryGetEntity(prefab, out var entity))
			{
				_ActivePrefabId.Value = entity.Index;
			}

			if (!settingPrefab)
			{
				SetAssetMenuOpen(false);
			}
		}

		private void OnToolChanged(ToolBaseSystem tool)
		{
			if (tool.toolID is "RoadBuilderTool" or "MoveItTool" or "Terrain Tool")
			{
				// Another tool brings its own UI and wants the screen. Ours goes.
				SetAssetMenuOpen(false);
				return;
			}

			// The Zone tool is deliberately not one of those. Picking a zone arms it, so vacating
			// here would close the Zones menu the instant it was used, and the still-selected
			// vanilla Zones menu would draw its own grid into the space.
			if (tool.toolID is "Zone Tool")
			{
				return;
			}

			if (settingPrefab || tool != _defaultToolSystem)
			{
				return;
			}

			// The tool went back to default: Escape, a right-click cancel, or a finished placement,
			// and this handler cannot tell them apart. Deliberately NOT CloseAssetMenu and deliberately
			// not touching the selection, or the game's Escape chain opens the pause menu instead.
			SetAssetMenuOpen(false);
		}
	}
}
