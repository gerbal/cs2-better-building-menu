using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using BetterBuildingMenu.Services;

using System.Linq;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The sort columns are the ones the picker offers; any other id sorts by name.
	/// </summary>
	public sealed class BuildingCatalogSortColumnsTests
	{
		// Ascending by name, descending by every field a column the picker does not offer could read.
		private static readonly BuildingCatalogEntry[] Set =
		{
			TestEntries.Make(1, "Alpha", subCategory: "Zeta", zoneType: ZoneTypeFilter.High) with
			{
				ElectricityConsumption = 3, WaterConsumption = 3, GarbageAccumulation = 3, WaterCapacity = 3,
				SewageCapacity = 3, GroundPollution = 3, AirPollution = 3, NoisePollution = 3,
			},
			TestEntries.Make(2, "Beta", subCategory: "Eta", zoneType: ZoneTypeFilter.Medium) with
			{
				ElectricityConsumption = 2, WaterConsumption = 2, GarbageAccumulation = 2, WaterCapacity = 2,
				SewageCapacity = 2, GroundPollution = 2, AirPollution = 2, NoisePollution = 2,
			},
			TestEntries.Make(3, "Gamma", subCategory: "Delta", zoneType: ZoneTypeFilter.Low) with
			{
				ElectricityConsumption = 1, WaterConsumption = 1, GarbageAccumulation = 1, WaterCapacity = 1,
				SewageCapacity = 1, GroundPollution = 1, AirPollution = 1, NoisePollution = 1,
			},
		};

		[Theory]
		[InlineData("SubCategory")]
		[InlineData("ZoneType")]
		[InlineData("Electricity")]
		[InlineData("ElectricityConsumption")]
		[InlineData("Water")]
		[InlineData("WaterConsumption")]
		[InlineData("Garbage")]
		[InlineData("GarbageAccumulation")]
		[InlineData("WaterCapacity")]
		[InlineData("SewageCapacity")]
		[InlineData("Sewage")]
		[InlineData("GroundPollution")]
		[InlineData("AirPollution")]
		[InlineData("NoisePollution")]
		[InlineData("Noise")]
		public void AColumnThePickerDoesNotOfferSortsByName(string column)
		{
			var page = BuildingCatalogQueryEngine.Query(Set, new BuildingCatalogQuery(SortColumn: column));

			Assert.Equal(new[] { "Alpha", "Beta", "Gamma" }, page.Items.Select(entry => entry.Name).ToArray());

			// Judged by name too: two rows that differ only in this field cannot be reordered by it.
			var twins = new[] { Set[0], Set[1] with { Name = "Alpha" } };

			Assert.Empty(BuildingCatalogQueryEngine.ReorderableSortColumns(twins, new BuildingCatalogQuery(), new[] { column }));
		}
	}
}
