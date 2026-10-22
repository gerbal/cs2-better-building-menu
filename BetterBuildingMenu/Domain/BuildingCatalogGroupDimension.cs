using System;
using System.Collections.Generic;

namespace BetterBuildingMenu.Domain
{
	/// <summary>One way to group the asset menu: the keys its groups order by and the headings they
	/// file under. Resolved once per query with <see cref="BuildingCatalogGrouping.Find"/>, since
	/// the keys run for every entry and the headings for every row of a page.</summary>
	public sealed class BuildingCatalogGroupDimension : IDescriptor
	{
		private readonly DescriptorIds _ids;
		private readonly Func<BuildingCatalogEntry, string> _primaryKey;
		private readonly Func<BuildingCatalogEntry, string> _secondaryKey;
		private readonly Func<BuildingCatalogEntry, IReadOnlyList<string>?, IReadOnlyDictionary<int, string>?, BuildingCatalogGrouping.GroupLabels> _labels;

		internal BuildingCatalogGroupDimension(
			string id,
			Func<BuildingCatalogEntry, string> primaryKey,
			Func<BuildingCatalogEntry, string> secondaryKey,
			Func<BuildingCatalogEntry, IReadOnlyList<string>?, IReadOnlyDictionary<int, string>?, BuildingCatalogGrouping.GroupLabels> labels,
			bool isGrouped = true)
		{
			Id = id;
			_ids = new DescriptorIds(id);
			IsGrouped = isGrouped;
			_primaryKey = primaryKey;
			_secondaryKey = secondaryKey;
			_labels = labels;
		}

		/// <summary>The id the picker sends.</summary>
		public string Id { get; }

		/// <summary>Whether this groups at all: false for none, and for no choice.</summary>
		public bool IsGrouped { get; }

		/// <summary>The outermost group key; empty for a dimension that keys nothing.</summary>
		public string PrimaryKey(BuildingCatalogEntry entry) => entry is null ? string.Empty : _primaryKey(entry);

		/// <summary>The key of the group beneath, for a dimension that has one; otherwise empty.</summary>
		public string SecondaryKey(BuildingCatalogEntry entry) => entry is null ? string.Empty : _secondaryKey(entry);

		DescriptorIds IDescriptor.Ids => _ids;

		/// <summary>The headings an entry files under.</summary>
		/// <param name="schoolTierNames">The game's name for each school level, from
		/// CatalogIndex.SchoolTierNames; English for a level it has none for.</param>
		public BuildingCatalogGrouping.GroupLabels Labels(
			BuildingCatalogEntry entry,
			IReadOnlyList<string>? milestoneNames = null,
			IReadOnlyDictionary<int, string>? schoolTierNames = null) =>
			entry is null
				? new BuildingCatalogGrouping.GroupLabels(Array.Empty<string>(), null)
				: _labels(entry, milestoneNames, schoolTierNames);
	}
}
