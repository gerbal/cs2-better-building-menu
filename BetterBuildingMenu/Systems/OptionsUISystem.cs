using BetterBuildingMenu.Utilities;
using Game.Prefabs;
using Game.SceneFlow;
using Game.UI.InGame;

using System;

namespace BetterBuildingMenu.Systems
{
    internal abstract partial class OptionsUISystem : ExtendedUISystemBase
	{
		private PrefabSystem _prefabSystem;
		private PrefabUISystem _prefabUISystem;

		protected override void OnCreate()
		{
			base.OnCreate();

			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_prefabUISystem = World.GetOrCreateSystemManaged<PrefabUISystem>();
		}

		public abstract void RefreshOptions();

		// The three members below bridge the building-lens facet state (query
		// engine + filter rail) into the options bank, for short facet groups
		// that belong beside Theme and Pack rather than in the rail. See
		// BetterBuildingMenu.Domain.Options.BuildingLensFacetOptionBase.

		public string GetAssetName(PrefabBase prefab)
		{
			_prefabUISystem.GetTitleAndDescription(_prefabSystem.GetEntity(prefab), out var titleId, out var _);

			if (GameManager.instance.localizationManager.activeDictionary.TryGetValue(titleId, out var name))
			{
				return name;
			}

			return prefab.name.Replace('_', ' ').FormatWords();
		}
	}
}
