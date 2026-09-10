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
		public void EveryKeyIsAWellFormedCategoryTitle()
		{
			// The lookup cannot verify the game actually ships a key, so the
			// shape is asserted here and a miss degrades to the mod's string.
			foreach (var key in GameLocaleKeys.All.Values)
			{
				Assert.StartsWith("Editor.ASSET_CATEGORY_TITLE[", key);
				Assert.EndsWith("]", key);
				Assert.DoesNotContain("[]", key);
			}
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
