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

		/// <summary>
		/// True while a section is applying its own click or reset inside
		/// <see cref="OptionClicked"/>.
		/// </summary>
		/// <remarks>
		/// The three building-lens facet sections write straight through to
		/// <see cref="FindItUISystem.ToggleBuildingLensFacetOption"/>, which now
		/// refreshes this bank itself once the catalog's facet bindings settle
		/// (see FindItUISystem.Methods.cs's RefreshBuildingCatalog). Without this
		/// guard that inner refresh would run, and then the explicit call these
		/// two methods make afterward would run again on the same click — same
		/// result both times, but computed twice. The guard collapses that to
		/// the single call made once the section has finished reacting, which
		/// is also the only one guaranteed to run after every section's state —
		/// facet-backed or not — has settled.
		/// </remarks>
		private bool _applyingOptionChange;

		protected override void OnCreate()
		{
			base.OnCreate();

			_prefabSystem = World.GetOrCreateSystemManaged<PrefabSystem>();
			_prefabUISystem = World.GetOrCreateSystemManaged<PrefabUISystem>();
			_findItUISystem = World.GetOrCreateSystemManaged<FindItUISystem>();

			CreateTrigger<int, int, int>("OptionClicked", OptionClicked);
		}

		public override void RefreshOptions()
		{
			if (_applyingOptionChange)
			{
				return;
			}

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

		private void OptionClicked(int sectionId, int optionId, int value)
		{
			if (!_sections.TryGetValue(sectionId, out var section))
			{
				return;
			}

			_applyingOptionChange = true;
			try
			{
				section.OnOptionClicked(optionId, value);
			}
			finally
			{
				_applyingOptionChange = false;
			}

			RefreshOptions();
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
