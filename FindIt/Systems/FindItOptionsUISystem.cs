using Colossal.UI;

using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Interfaces;
using FindItBuildingMenu.Domain.UIBinding;
using FindItBuildingMenu.Utilities;
using Game.Prefabs;
using Game.SceneFlow;
using Game.UI.InGame;

using System;
using System.Collections.Generic;
using System.Linq;

namespace FindItBuildingMenu.Systems
{
    internal partial class FindItOptionsUISystem : OptionsUISystem
	{
		private readonly Dictionary<int, IOptionSection> _sections = new();
		private PrefabUISystem _prefabUISystem;
		private PrefabSystem _prefabSystem;
		private FindItUISystem _findItUISystem;

		protected override void OnCreate()
		{
			base.OnCreate();

			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_prefabUISystem = World.GetOrCreateSystemManaged<PrefabUISystem>();
			_findItUISystem = World.GetOrCreateSystemManaged<FindItUISystem>();
		}

		public override void RefreshOptions()
		{
			if (!FindItUtil.IsReady)
			{
				return;
			}

			if (_sections.Count == 0)
			{
				foreach (var type in typeof(OptionsUISystem).Assembly.GetTypes())
				{
					if (typeof(IOptionSection).IsAssignableFrom(type) && !type.IsAbstract && type.Namespace == "FindItBuildingMenu.Domain.Options")
					{
						var section = (IOptionSection)Activator.CreateInstance(type, this);

						section.OnReset();

						_sections.Add(section.Id, section);
					}
				}
			}

			// Nothing publishes the sections any more (cm-jjlv.3 deleted the
			// OptionsList binding the UI never read), but walking them still
			// resets any section that has stopped being visible.
			foreach (var _ in GetVisibleSections())
			{
			}
		}

		private IEnumerable<IOptionSection> GetVisibleSections()
		{
			var requireRefresh = false;

			foreach (var section in _sections.Values)
			{
				if (section.IsVisible())
				{
					yield return section;
				}
				else if (!section.IsDefault())
				{
					requireRefresh = true;
					section.OnReset();
				}
			}

			if (requireRefresh)
			{
				TriggerSearch();
			}
		}

		public override void TriggerSearch()
		{
			_findItUISystem.TriggerSearch();
		}

		public override void RefreshLens()
		{
			_findItUISystem.RefreshLens();
		}


		public override BuildingCatalogFacetGroup? GetBuildingLensFacetGroup(string facetId) =>
			_findItUISystem.GetBuildingLensFacetGroup(facetId);

		public override void ToggleBuildingLensFacetOption(string facetId, string optionId) =>
			_findItUISystem.ToggleBuildingLensFacetOption(facetId, optionId);
	}
}
