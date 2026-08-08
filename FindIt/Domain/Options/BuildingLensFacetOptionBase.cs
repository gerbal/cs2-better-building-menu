using FindItBuildingMenu.Domain.Interfaces;
using FindItBuildingMenu.Domain.UIBinding;
using FindItBuildingMenu.Systems;

using System;
using System.Linq;

namespace FindItBuildingMenu.Domain.Options
{
	/// <summary>
	/// A building-lens facet dimension (Availability, Provenance, Placement)
	/// projected into the options bank as an icon row — the shape Theme and
	/// Pack already use — instead of the filter rail, which is for dimensions
	/// too large to scan as icons.
	/// </summary>
	/// <remarks>
	/// "Short" is read from the live facet state rather than assumed: a
	/// dimension that grows past <see cref="BankThreshold"/> options (matching
	/// UI/src/domain/filterRail.ts's RAIL_BANK_THRESHOLD) declines here instead
	/// of spilling a wall of icons the vanilla asset menu would never show this
	/// way. The rail stays that dimension's home in that case, so a facet can
	/// move between the two as its option count changes with the player's
	/// catalog rather than being pinned to one or the other.
	///
	/// Selections write straight to the same BuildingCatalogQuery the rail
	/// writes to, through FindItUISystem.ToggleBuildingLensFacetOption, so a
	/// pick here and a pick in the rail are the same state, not two.
	/// </remarks>
	internal abstract class BuildingLensFacetOptionBase : IOptionSection
	{
		// Matches filterRail.ts's RAIL_BANK_THRESHOLD.
		private const int BankThreshold = 8;

		private readonly OptionsUISystem _optionsUISystem;
		private readonly string _facetId;
		private BuildingCatalogFacetOption[] _options = Array.Empty<BuildingCatalogFacetOption>();

		protected BuildingLensFacetOptionBase(OptionsUISystem optionsUISystem, int id, string facetId)
		{
			_optionsUISystem = optionsUISystem;
			Id = id;
			_facetId = facetId;
		}

		public int Id { get; }

		protected abstract string SectionName { get; }

		protected virtual string OptionName(BuildingCatalogFacetOption option) => option.Label;

		protected abstract string OptionIcon(BuildingCatalogFacetOption option);

		public OptionSectionUIEntry AsUIEntry()
		{
			return new OptionSectionUIEntry
			{
				Id = Id,
				Name = SectionName,
				Options = _options.Select((option, index) => new OptionItemUIEntry
				{
					Id = index,
					Name = OptionName(option),
					Icon = OptionIcon(option),
					Selected = option.Selected,
				}).ToArray(),
			};
		}

		/// <summary>
		/// Also refreshes the cached option list, which <see cref="AsUIEntry"/>
		/// and <see cref="OnOptionClicked"/> both read — the same caching
		/// ThemeOption and PackOption do for their prefab lists.
		/// </summary>
		public bool IsVisible()
		{
			var group = _optionsUISystem.BuildingLensEnabled
				? _optionsUISystem.GetBuildingLensFacetGroup(_facetId)
				: null;

			_options = group?.Options ?? Array.Empty<BuildingCatalogFacetOption>();

			return _options.Length > 0 && _options.Length <= BankThreshold;
		}

		public void OnOptionClicked(int optionId, int value)
		{
			if (optionId < 0 || optionId >= _options.Length)
			{
				return;
			}

			_optionsUISystem.ToggleBuildingLensFacetOption(_facetId, _options[optionId].Id);
		}

		public void OnReset()
		{
			foreach (var option in _options)
			{
				if (option.Selected)
				{
					_optionsUISystem.ToggleBuildingLensFacetOption(_facetId, option.Id);
				}
			}
		}

		public bool IsDefault()
		{
			return !_options.Any(option => option.Selected);
		}
	}
}
