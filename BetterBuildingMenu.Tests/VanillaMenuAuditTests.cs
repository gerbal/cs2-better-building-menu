using System.Linq;
using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The mapping from a vanilla toolbar section to what the asset menu shows, pinned by
	/// tests rather than by a runtime census. Fixtures stay small enough to name
	/// what each one asserts.
	/// </summary>
	public sealed class VanillaMenuAuditTests
	{
		private static VanillaMenuPlacementFact Places(int id, string name, string menu, string category = "Cat") =>
			new(id, name, menu, category);

		private static IndexedMenuFact Ours(int id, string name, string menu, bool isServiceUpgrade = false) =>
			new(id, name, menu, isServiceUpgrade);

		private static VanillaMenuAuditReport Compare(
			VanillaMenuPlacementFact[] vanilla,
			IndexedMenuFact[] ours,
			int[]? held = null) =>
			VanillaMenuAudit.Compare(
				vanilla,
				ours,
				held ?? ours.Select(entry => entry.EntityIndex).ToArray());

		[Fact]
		public void AMenuWeCoverCompletelyIsClean()
		{
			var report = Compare(
				new[] { Places(1, "Alley", "Roads"), Places(2, "Gravel Road", "Roads") },
				new[] { Ours(1, "Alley", "Roads"), Ours(2, "Gravel Road", "Roads") });

			Assert.True(report.IsClean);

			var roads = Assert.Single(report.Menus);
			Assert.Equal("Roads", roads.Menu);
			Assert.Equal(2, roads.VanillaPlaces);
			Assert.Equal(2, roads.Held);
			Assert.Equal(2, roads.Ours);
			Assert.Empty(roads.Missing);
		}

		[Fact]
		public void AnAssetVanillaPlacesAndWeDoNotHoldIsNamed()
		{
			// The failure the audit exists for: the asset menu is short something the
			// vanilla menu offers. Named rather than counted, because the name says
			// which asset and a count only says that one is gone.
			var report = Compare(
				new[] { Places(1, "Alley", "Roads"), Places(2, "Gravel Road", "Roads") },
				new[] { Ours(1, "Alley", "Roads") });

			Assert.False(report.IsClean);

			var roads = Assert.Single(report.Menus);
			Assert.Equal(1, roads.Held);
			Assert.Equal(new[] { "Gravel Road" }, roads.Missing);
		}

		[Fact]
		public void HoldingAnAssetOutsideTheMenuStillCountsAsHeld()
		{
			// Held is "do we have it at all", not "do we file it under this menu":
			// the game places zones under Zones, we hold them in a separate catalog.
			var report = Compare(
				new[] { Places(1, "Residential Low", "Zones") },
				ours: System.Array.Empty<IndexedMenuFact>(),
				held: new[] { 1 });

			var zones = Assert.Single(report.Menus);
			Assert.Equal(1, zones.Held);
			Assert.Empty(zones.Missing);
			Assert.Equal(0, zones.Ours);
		}

		[Fact]
		public void AServiceUpgradeWeIndexButVanillaDoesNotPlaceIsAnExpectedExtra()
		{
			// The one recorded divergence: the game runs FilterOutUpgrades over every
			// menu because an upgrade is placed from its parent building's row. We
			// match that in the list but keep them indexed so the parent names them.
			var report = Compare(
				new[] { Places(1, "Crematorium01", "Health & Deathcare") },
				new[]
				{
					Ours(1, "Crematorium01", "Health & Deathcare"),
					Ours(2, "Crematorium01 Hearse Garage", "Health & Deathcare", isServiceUpgrade: true),
				});

			// Expected, so it does not make the report dirty.
			Assert.True(report.IsClean);

			var health = Assert.Single(report.Menus);
			Assert.Equal(new[] { "Crematorium01 Hearse Garage" }, health.ExpectedExtras);
			Assert.Empty(health.UnexplainedExtras);
		}

		[Fact]
		public void AnExtraNoDivergenceExplainsIsReportedAsUnexplained()
		{
			// Something we offer that vanilla does not place, with no divergence on
			// record, is either a new divergence to write down or a bug — which is
			// why the divergence is a rule rather than a list of names.
			var report = Compare(
				new[] { Places(1, "Crematorium01", "Health & Deathcare") },
				new[]
				{
					Ours(1, "Crematorium01", "Health & Deathcare"),
					Ours(2, "Area Hub", "Health & Deathcare"),
				});

			Assert.False(report.IsClean);

			var health = Assert.Single(report.Menus);
			Assert.Equal(new[] { "Area Hub" }, health.UnexplainedExtras);
			Assert.Empty(health.ExpectedExtras);
		}

		[Fact]
		public void AMenuNameVanillaHasNoMenuForIsReported()
		{
			// The reverse question: a menu name the game does not have is one nothing
			// can ever open.
			var report = Compare(
				new[] { Places(1, "Alley", "Roads") },
				new[] { Ours(1, "Alley", "Roads"), Ours(2, "Invented", "Our Own Menu") });

			Assert.False(report.IsClean);
			Assert.Equal(new[] { "Our Own Menu" }, report.InventedMenus);
		}

		[Fact]
		public void EntriesWithNoMenuNameAreNotCountedAsOurs()
		{
			// Most of the index has no menu name at all; counting those as ours would
			// give every menu a crowd of extras.
			var report = Compare(
				new[] { Places(1, "Alley", "Roads") },
				new[] { Ours(1, "Alley", "Roads"), Ours(2, "Some Prop", string.Empty) });

			Assert.True(report.IsClean);
			Assert.Equal(1, report.IndexedCount);
			Assert.Equal(1, Assert.Single(report.Menus).Ours);
		}

		[Fact]
		public void CategoriesAreCountedDistinctlyPerMenu()
		{
			// The count of categories per menu is part of the same contract: the
			// strip draws its tabs from it.
			var report = Compare(
				new[]
				{
					Places(1, "Bus Stop", "Transportation", "Bus"),
					Places(2, "Bus Depot", "Transportation", "Bus"),
					Places(3, "Train Station", "Transportation", "Train"),
				},
				new[]
				{
					Ours(1, "Bus Stop", "Transportation"),
					Ours(2, "Bus Depot", "Transportation"),
					Ours(3, "Train Station", "Transportation"),
				});

			Assert.Equal(2, Assert.Single(report.Menus).Categories);
		}

		[Fact]
		public void MenusAreReportedInAStableOrder()
		{
			// The report is read by eye against the previous boot's, so the order
			// has to be the same both times or the diff is unreadable.
			var report = Compare(
				new[]
				{
					Places(1, "Train Station", "Transportation"),
					Places(2, "Alley", "Roads"),
					Places(3, "Park", "Parks & Recreation"),
				},
				new[]
				{
					Ours(1, "Train Station", "Transportation"),
					Ours(2, "Alley", "Roads"),
					Ours(3, "Park", "Parks & Recreation"),
				});

			Assert.Equal(
				new[] { "Parks & Recreation", "Roads", "Transportation" },
				report.Menus.Select(line => line.Menu).ToArray());
		}

		[Fact]
		public void APlacementWithNoMenuIsFiledRatherThanDropped()
		{
			// The walk can return a placement whose menu it could not resolve.
			// Dropping it would shrink the placement count and hide the failure;
			// it gets a name instead.
			var report = Compare(
				new[] { new VanillaMenuPlacementFact(1, "Orphan", null!, "Cat") },
				new[] { Ours(1, "Orphan", "Roads") });

			Assert.Equal("(none)", Assert.Single(report.Menus).Menu);
			Assert.Equal(1, report.PlacementCount);
		}
	}
}
