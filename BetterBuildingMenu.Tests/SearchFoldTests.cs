using System.Globalization;
using System.Linq;
using System.Text;

using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>Search compares text folded: lower case, accents and letter variants dropped.</summary>
	public sealed class SearchFoldTests
	{
		[Theory]
		[InlineData("Café", "cafe")]
		[InlineData("Hauptstraße", "hauptstrasse")]
		[InlineData("ŒUVRE", "oeuvre")]
		[InlineData("Żłobek", "zlobek")]
		[InlineData("École Élémentaire", "ecole elementaire")]
		[InlineData("Ștefan Țara", "stefan tara")]
		[InlineData("Ёлка", "елка")]
		[InlineData("Ĳsselmeer", "ijsselmeer")]
		[InlineData("Coal Power Plant", "coal power plant")]
		[InlineData("Bahnhof_01", "bahnhof_01")]
		[InlineData("", "")]
		[InlineData(null, "")]
		public void FoldsCaseAccentsAndLetterVariants(string? text, string expected)
		{
			Assert.Equal(expected, SearchFold.Fold(text));
		}

		[Fact]
		public void FoldsEveryLatinLetterAsUnicodeDecomposesIt()
		{
			// The table is written out rather than built with string.Normalize, which Mono may
			// lack. This checks it against Unicode: compatibility decomposition, marks dropped,
			// lower-cased, for Latin-1 and Latin Extended-A. The letters Unicode does not
			// decompose are folded by hand and listed here.
			const string byHand = "ÆæÐðØøÞþßĐđĦħıĲĳĸĿŀŁłŉŒœŦŧſ";

			var differ = Enumerable.Range(0xC0, 0x180 - 0xC0)
				.Select(code => (char)code)
				.Where(c => byHand.IndexOf(c) < 0 && c != '×' && c != '÷' && c != 'Ŋ' && c != 'ŋ')
				.Select(c => (c, expected: Decomposed(c), actual: SearchFold.Fold(c.ToString())))
				.Where(x => x.expected != x.actual)
				.Select(x => $"{x.c}: '{x.expected}' vs '{x.actual}'")
				.ToArray();

			Assert.Empty(differ);
		}

		[Theory]
		[InlineData("ß", "ss")]
		[InlineData("Æ", "ae")]
		[InlineData("ø", "o")]
		[InlineData("Đ", "d")]
		[InlineData("ð", "d")]
		[InlineData("Ł", "l")]
		[InlineData("þ", "th")]
		[InlineData("ı", "i")]
		[InlineData("Ħ", "h")]
		[InlineData("ŧ", "t")]
		[InlineData("ŀ", "l")]
		[InlineData("ſ", "s")]
		[InlineData("×", "×")]
		[InlineData("Ŋ", "ŋ")]
		public void FoldsTheLettersUnicodeDoesNotDecompose(string letter, string expected)
		{
			Assert.Equal(expected, SearchFold.Fold(letter));
		}

		private static string Decomposed(char c) =>
			new string(c.ToString().Normalize(NormalizationForm.FormKD)
				.Where(part => CharUnicodeInfo.GetUnicodeCategory(part) != UnicodeCategory.NonSpacingMark)
				.ToArray())
			.ToLowerInvariant();
	}

	/// <summary>A search as typed, split into the words every match must contain.</summary>
	public sealed class SearchTermsTests
	{
		private static BuildingCatalogEntry E(string name, string prefab = "", string pdx = "") =>
			new BuildingCatalogEntry(
				Id: 1, PrefabName: prefab, Name: name, Category: "", SubCategory: "", Thumbnail: "",
				LotWidth: 1, LotDepth: 1, BuildingLevel: 1, ZoneType: ZoneTypeFilter.Any,
				HasParking: false, IsVanilla: true, PdxModsId: pdx);

		[Fact]
		public void SplitsAtAnyRunOfWhitespace()
		{
			var terms = SearchTerms.From("  Police\t STATION ");

			Assert.Equal(new[] { "police", "station" }, terms.Words);
			Assert.Equal("police station", terms.Text);
		}

		[Fact]
		public void NothingTypedIsEmpty()
		{
			Assert.True(SearchTerms.From("   ").IsEmpty);
			Assert.True(SearchTerms.From(null).IsEmpty);
		}

		[Fact]
		public void FindsTheWordsInAnyOrder()
		{
			Assert.True(SearchTerms.From("station police").FoundIn(E("Police Station")));
			Assert.False(SearchTerms.From("station fire").FoundIn(E("Police Station")));
		}

		[Fact]
		public void EachWordMayComeFromAnyOfTheSearchedFields()
		{
			Assert.True(SearchTerms.From("police 158589").FoundIn(E("Police Station", pdx: "158589")));
			Assert.True(SearchTerms.From("eu station").FoundIn(E("Police Station", prefab: "EU_PoliceStation01")));
		}

		[Fact]
		public void IgnoresAccentsOnEitherSide()
		{
			Assert.True(SearchTerms.From("cafe").FoundIn(E("Café Terrace")));
			Assert.True(SearchTerms.From("café").FoundIn(E("Cafe Terrace")));
			Assert.True(SearchTerms.From("strasse").FoundIn(E("Hauptstraße")));
		}

		[Fact]
		public void AFoldedNameFollowsAWithCopy()
		{
			// A copy that renames the entry must not keep searching the old name.
			var renamed = E("Coal Power Plant") with { Name = "Medical Clinic" };

			Assert.True(SearchTerms.From("clinic").FoundIn(renamed));
			Assert.False(SearchTerms.From("coal").FoundIn(renamed));
		}

		[Fact]
		public void EntriesThatDifferOnlyInWhatWasFoldedStayEqual()
		{
			Assert.Equal(E("Café"), E("Café"));
			Assert.Equal(E("Café").GetHashCode(), E("Café").GetHashCode());
			Assert.NotEqual(E("Café"), E("Cafe"));
		}
	}
}
