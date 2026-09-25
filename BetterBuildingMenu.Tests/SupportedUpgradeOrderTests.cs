using BetterBuildingMenu.Domain;

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
		public void UpgradesSharingAPriorityKeepTheBuffersOrder()
		{
			// The three at 20 are in neither alphabetical order nor its reverse, by name or by
			// prefab name, so only a stable sort keeps them as the buffers hold them.
			var offers = new[]
			{
				new UpgradeOffer(20, "Helipad", "HospitalHelipad"),
				new UpgradeOffer(10, "Extra Wing", "HospitalWing"),
				new UpgradeOffer(20, "Ambulance Depot", "HospitalAmbulance"),
				// A module after the service upgrades, as the indexer reads the two buffers.
				new UpgradeOffer(20, "Research Wing", "HospitalResearch"),
			};

			var (names, prefabNames) = SupportedUpgrades.InMenuOrder(offers);

			Assert.Equal(new[] { "Extra Wing", "Helipad", "Ambulance Depot", "Research Wing" }, names);
			Assert.Equal(new[] { "HospitalWing", "HospitalHelipad", "HospitalAmbulance", "HospitalResearch" }, prefabNames);
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
