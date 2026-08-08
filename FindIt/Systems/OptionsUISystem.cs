using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Utilities;
using Game.Prefabs;
using Game.SceneFlow;
using Game.UI.InGame;

using System;

namespace FindItBuildingMenu.Systems
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

		public abstract void TriggerSearch();
		public abstract void RefreshOptions();
		public abstract void UpdateCategoriesAndPrefabList();

		// The three members below bridge the building-lens facet state (query
		// engine + filter rail) into the options bank, for short facet groups
		// that belong beside Theme and Pack rather than in the rail. See
		// FindItBuildingMenu.Domain.Options.BuildingLensFacetOptionBase.
		public abstract bool BuildingLensEnabled { get; }
		public abstract BuildingCatalogFacetGroup? GetBuildingLensFacetGroup(string facetId);
		public abstract void ToggleBuildingLensFacetOption(string facetId, string optionId);

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
