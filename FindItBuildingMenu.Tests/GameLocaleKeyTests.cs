using System.Linq;
using FindItBuildingMenu.Domain;
using FindItBuildingMenu.Domain.Enums;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class GameLocaleKeyTests
	{
		[Fact]
		public void NamesTheGamesOwnKeyForEveryServiceMenu()
		{
			// These paths were read out of the shipped Locale.cok, not guessed —
			// one Editor.ASSET_CATEGORY_TITLE entry per category — and they are
			// the same leaf names the toolbar's menu prefabs carry.
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
			Assert.Null(GameLocaleKeys.For(VanillaBuildMenuTaxonomy.Networks));
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
	}
}
