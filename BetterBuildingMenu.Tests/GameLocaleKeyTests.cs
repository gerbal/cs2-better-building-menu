using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class GameLocaleKeyTests
	{
		[Fact]
		public void NamesTheGamesOwnKeyForEveryServiceMenu()
		{
			// These paths come from the shipped Locale.cok, one
			// Editor.ASSET_CATEGORY_TITLE entry per category, and they are the same
			// leaf names the toolbar's menu prefabs carry.
			Assert.Equal(
				"Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Health & Deathcare]",
				GameLocaleKeys.For(nameof(PrefabSubCategory.ServiceBuildings_Health)));
			Assert.Equal(
				"Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Water & Sewage]",
				GameLocaleKeys.For(nameof(PrefabSubCategory.ServiceBuildings_Water)));
			Assert.Equal(
				"Editor.ASSET_CATEGORY_TITLE[Buildings/Services/Education & Research]",
				GameLocaleKeys.For(nameof(PrefabSubCategory.ServiceBuildings_EducationResearch)));
		}

		[Fact]
		public void CoversEveryServiceSubcategoryTheLensNavigatesTo()
		{
			// A gap here is a heading that stays English while the ones beside
			// it translate, which reads worse than none of them translating.
			var services = new[]
			{
				PrefabSubCategory.ServiceBuildings_Health,
				PrefabSubCategory.ServiceBuildings_Water,
				PrefabSubCategory.ServiceBuildings_Electricity,
				PrefabSubCategory.ServiceBuildings_Garbage,
				PrefabSubCategory.ServiceBuildings_EducationResearch,
				PrefabSubCategory.ServiceBuildings_Fire,
				PrefabSubCategory.ServiceBuildings_Police,
				PrefabSubCategory.ServiceBuildings_Parks,
				PrefabSubCategory.ServiceBuildings_Communications,
				PrefabSubCategory.ServiceBuildings_Transportation,
				PrefabSubCategory.ServiceBuildings_Roads,
			};

			foreach (var service in services)
			{
				Assert.NotNull(GameLocaleKeys.For(service.ToString()));
			}
		}

		[Fact]
		public void DeclinesWhatTheGameHasNoCounterpartFor()
		{
			// Networks has none — the game splits it across Roads, Bridges and
			// Tracks — and the vocabulary the lens invented is genuinely ours.
			Assert.Null(GameLocaleKeys.For("Networks"));
			Assert.Null(GameLocaleKeys.For("GroupBy_cost"));
			Assert.Null(GameLocaleKeys.For("Cards"));
			Assert.Null(GameLocaleKeys.For(null));
			Assert.Null(GameLocaleKeys.For(""));
			Assert.Null(GameLocaleKeys.For("   "));
		}

		[Fact]
		public void EveryKeyIsAWellFormedGameName()
		{
			// The lookup cannot verify the game actually ships a key, so the
			// shape is asserted here and a miss degrades to the mod's string.
			var families = new[] { "Editor.ASSET_CATEGORY_TITLE[", "Services.NAME[", "SubServices.NAME[" };

			foreach (var key in GameLocaleKeys.All.Values)
			{
				Assert.Contains(families, family => key.StartsWith(family, StringComparison.Ordinal));
				Assert.EndsWith("]", key);
				Assert.DoesNotContain("[]", key);
			}
		}

		[Fact]
		public void NamesZonesAsTheToolbarsZonesMenuDoes()
		{
			// The Zones menu's tabs, as vanilla titles them in every language.
			Assert.Equal("Services.NAME[Zones]", GameLocaleKeys.For(nameof(PrefabCategory.Zones)));
			Assert.Equal("SubServices.NAME[ZonesResidential]", GameLocaleKeys.For(nameof(PrefabSubCategory.Zones_Residential)));
			Assert.Equal("SubServices.NAME[ZonesExtractors]", GameLocaleKeys.For(nameof(PrefabSubCategory.Zones_Extractors)));
		}

		[Fact]
		public void NamesPropsByTheLandscapingTabsVanillaFilesThemUnder()
		{
			// VanillaCategoryMapping reads these same ids off the game's categories.
			foreach (var id in new[] { "PropsResidential", "PropsCommercial", "PropsIndustrial" })
			{
				var subCategory = VanillaCategoryMapping.PropSubCategoryFor(id);

				Assert.NotNull(subCategory);
				Assert.Equal($"SubServices.NAME[{id}]", GameLocaleKeys.For(subCategory.ToString()));
			}
		}

		[Fact]
		public void LeavesTheLensOwnWordingWhereTheGamesSaysLess()
		{
			// The game's "Park" and "Lights" drop the "props" that places them, its
			// German "Fences" is untranslated, and its "Foliage" leaves out the rocks
			// and spawners the lens files beside trees.
			Assert.Null(GameLocaleKeys.For(nameof(PrefabSubCategory.Props_Park)));
			Assert.Null(GameLocaleKeys.For(nameof(PrefabSubCategory.Props_Lights)));
			Assert.Null(GameLocaleKeys.For(nameof(PrefabSubCategory.Props_Fences)));
			Assert.Null(GameLocaleKeys.For(nameof(PrefabCategory.Trees)));
		}

		[Fact]
		public void NamesAThemeByTheKeyTheGamesThemePickerReads()
		{
			Assert.Equal("Assets.THEME[European]", GameLocaleKeys.ForTheme("European"));
			Assert.Equal("Assets.THEME[North American]", GameLocaleKeys.ForTheme(" North American "));
			Assert.Null(GameLocaleKeys.ForTheme(null));
			Assert.Null(GameLocaleKeys.ForTheme("  "));
		}

		[Fact]
		public void AThemeWithNoLocalizationManagerKeepsItsOwnName()
		{
			// Tests run without the game, which is the missing-key path in game too.
			Assert.Equal("North American", BuildingCatalogLabels.ForTheme("North American"));
			Assert.Equal("Mod Theme", BuildingCatalogLabels.ForTheme("ModTheme"));
		}

		[Fact]
		public void NamesARoleAfterItsPlainBuildingOrItsTab()
		{
			Assert.Equal("Assets.NAME[Hospital01]", GameLocaleKeys.ForRole("Hospital"));
			Assert.Equal("Assets.NAME[SewageOutlet01]", GameLocaleKeys.ForRole(" SewageOutlet "));
			Assert.Equal("SubServices.NAME[CommunicationsPost]", GameLocaleKeys.ForRole("PostFacility"));
		}

		[Fact]
		public void LeavesTheRolesWithNoSingleGameNameToUs()
		{
			// School spans four levels, a power plant is no one building and the
			// game's only "Electricity" names the whole service, and the plain
			// shelter is the "Small" one.
			Assert.Null(GameLocaleKeys.ForRole("School"));
			Assert.Null(GameLocaleKeys.ForRole("PowerPlant"));
			Assert.Null(GameLocaleKeys.ForRole("EmergencyShelter"));
			Assert.Null(GameLocaleKeys.ForRole(null));
			Assert.Null(GameLocaleKeys.ForRole(" "));
		}

		[Fact]
		public void NamesOnlyRolesTheIndexerProducesEachUnderItsOwnKey()
		{
			// Two roles under one key would draw one heading for both, since the
			// page merges consecutive headings by their text.
			Assert.All(GameLocaleKeys.Roles.Keys, role => Assert.Contains(role, BuildingRole.Known));
			Assert.Equal(GameLocaleKeys.Roles.Count, GameLocaleKeys.Roles.Values.Distinct().Count());
		}

		[Fact]
		public void ARoleWithNoLocalizationManagerKeepsItsSplitId()
		{
			Assert.Equal("Fire Station", BuildingCatalogLabels.ForRole("FireStation"));
			Assert.Equal("Battery", BuildingCatalogLabels.ForRole("Battery"));
		}

		[Fact]
		public void MapsNoIdentifierTwice()
		{
			Assert.Equal(GameLocaleKeys.All.Count, GameLocaleKeys.All.Keys.Distinct().Count());
		}

		[Fact]
		public void IgnoresSurroundingWhitespace()
		{
			Assert.Equal(
				GameLocaleKeys.For(nameof(PrefabSubCategory.ServiceBuildings_Health)),
				GameLocaleKeys.For("  ServiceBuildings_Health  "));
		}
		[Fact]
		public void NamesEveryZoneTypeTheOptionsRowCanShow()
		{
			// ZoneTypeOption projects its chips from a hand-built dictionary rather
			// than from the enum, so a member with no entry fails silently. Asserting
			// against Enum.GetValues is the point: a hand-written list is forgotten too.
			var keys = LoadLocaleKeys();
			var missing = Enum.GetValues(typeof(ZoneTypeFilter))
				.Cast<ZoneTypeFilter>()
				.Where(density => density != ZoneTypeFilter.Any)
				.Where(density => !keys.Contains($"Tooltip.LABEL[BetterBuildingMenu.Zone{density}]"))
				.ToArray();

			Assert.True(
				missing.Length == 0,
				$"No tooltip in Locale.json for: {string.Join(", ", missing)}");
		}

		private static HashSet<string> LoadLocaleKeys()
		{
			// The mod assembly's own embedded copy, so this cannot pass by finding
			// a stale file on disk.
			using var stream = typeof(ZoneTypeFilter).Assembly
				.GetManifestResourceStream("BetterBuildingMenu.Locale.json");

			Assert.NotNull(stream);

			using var reader = new StreamReader(stream!);
			var keys = new HashSet<string>(StringComparer.Ordinal);

			foreach (var line in reader.ReadToEnd().Split('\n'))
			{
				var start = line.IndexOf('"');

				if (start < 0)
				{
					continue;
				}

				var end = line.IndexOf('"', start + 1);

				if (end > start)
				{
					keys.Add(line.Substring(start + 1, end - start - 1));
				}
			}

			return keys;
		}
	}
}
