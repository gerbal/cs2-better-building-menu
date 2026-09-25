using BetterBuildingMenu.Domain;

using System.Linq;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The order UpgradeMenuUISystem offers a building's upgrades in: by priority, and in the order
	/// the game's buffers hold them where two share one.
	/// </summary>
	public sealed class SupportedUpgradeOrderTests
	{
		[Fact]
		public void TiesAreNotBrokenByName()
		{
			// The three at 20 are in neither alphabetical order nor its reverse, by name or by
			// prefab name, so a sort that broke the tie by either would reorder them.
			var offers = new[]
			{
				new UpgradeOffer(20, "Helipad", "HospitalHelipad"),
				new UpgradeOffer(10, "Extra Wing", "HospitalWing"),
				new UpgradeOffer(20, "Ambulance Depot", "HospitalAmbulance"),
				// Last, where a module would be: the indexer reads BuildingModule after
				// BuildingUpgradeElement. A hospital has no modules, so this upgrade stands in for one.
				new UpgradeOffer(20, "Research Wing", "HospitalResearch"),
			};

			var (names, prefabNames) = SupportedUpgrades.InMenuOrder(offers);

			Assert.Equal(new[] { "Extra Wing", "Helipad", "Ambulance Depot", "Research Wing" }, names);
			Assert.Equal(new[] { "HospitalWing", "HospitalHelipad", "HospitalAmbulance", "HospitalResearch" }, prefabNames);
		}

		[Fact]
		public void UpgradesSharingAPriorityKeepTheBuffersOrder()
		{
			// More than sixteen: .NET's own sort insertion-sorts up to sixteen, which happens to be
			// stable, so only a longer list tells a stable sort from an unstable one.
			var offers = Enumerable.Range(0, 40)
				.Select(i => new UpgradeOffer(i % 3 == 0 ? 2 : 1, $"Upgrade {i:00}", $"U{i:00}"))
				.ToArray();

			var (names, _) = SupportedUpgrades.InMenuOrder(offers);

			var expected = offers.Where(o => o.Priority == 1).Concat(offers.Where(o => o.Priority == 2)).Select(o => o.Name);
			Assert.Equal(expected, names);
		}

		[Fact]
		public void ABuildingWithNoUpgradesOffersNone()
		{
			var (names, prefabNames) = SupportedUpgrades.InMenuOrder(null);

			Assert.Empty(names);
			Assert.Empty(prefabNames);
		}
	}
}
