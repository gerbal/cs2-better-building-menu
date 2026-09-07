using System;
using System.Collections.Generic;

using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
#nullable enable
	/// <summary>
	/// What our extension picker shows for the selected building: the catalog
	/// entry behind each upgrade the building supports, in vanilla's order.
	/// </summary>
	/// <remarks>
	/// Presentation only. Vanilla's own <c>upgradeMenu.upgrades</c> binding is
	/// the authority on WHAT may be attached and whether each row is locked or
	/// already built on this instance; the UI joins that list to these entries
	/// by prefab name and draws ours only when every vanilla row is accounted
	/// for. So a name this cannot resolve is simply absent — never invented —
	/// and the UI's response to the gap is to leave the panel to vanilla.
	/// </remarks>
	public sealed record BuildingExtensionMenu(
		string BuildingName,
		BuildingCatalogEntry[] Entries) : IJsonWritable
	{
		public static readonly BuildingExtensionMenu Empty = new(string.Empty, Array.Empty<BuildingCatalogEntry>());

		/// <param name="supportedUpgrades">
		/// <see cref="PrefabIndex.SupportedUpgradeIds"/> — prefab names, already
		/// in the order vanilla's picker lists them.
		/// </param>
		/// <param name="resolve">The catalog entry for a prefab name, or null.</param>
		public static BuildingExtensionMenu Build(
			string buildingName,
			IReadOnlyList<string>? supportedUpgrades,
			Func<string, BuildingCatalogEntry?> resolve)
		{
			if (supportedUpgrades is null || supportedUpgrades.Count == 0)
			{
				return new BuildingExtensionMenu(buildingName, Array.Empty<BuildingCatalogEntry>());
			}

			var entries = new List<BuildingCatalogEntry>(supportedUpgrades.Count);

			foreach (var name in supportedUpgrades)
			{
				if (resolve(name) is { } entry)
				{
					entries.Add(entry);
				}
			}

			return new BuildingExtensionMenu(buildingName, entries.ToArray());
		}

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);

			writer.PropertyName("buildingName");
			writer.Write(BuildingName);

			writer.PropertyName("entries");
			writer.ArrayBegin((uint)Entries.Length);
			foreach (var entry in Entries)
			{
				entry.Write(writer);
			}
			writer.ArrayEnd();

			writer.TypeEnd();
		}
	}
}
