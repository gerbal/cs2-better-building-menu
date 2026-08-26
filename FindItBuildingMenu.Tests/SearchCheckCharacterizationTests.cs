using FindItBuildingMenu.Utilities;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// What SearchCheck matches today, pinned before it is made faster.
	/// </summary>
	/// <remarks>
	/// cm-yfd5. Search costs 2.7s because the fuzzy fallbacks below run on
	/// every asset the substring test rejects. Any fix has to keep the answers
	/// identical, and nothing described what the answers were — so this
	/// characterizes the behaviour first, and the optimisation is only allowed
	/// to move the clock.
	///
	/// These are written from the four paths SearchCheck actually has: exact
	/// substring, Levenshtein within a length-derived threshold, abbreviation,
	/// and all-terms-present for a search containing a space.
	/// </remarks>
	public sealed class SearchCheckCharacterizationTests
	{
		[Theory]
		// Plain substring, case-insensitive by default.
		[InlineData("hospital", "Downtown Hospital", true)]
		[InlineData("HOSPITAL", "Downtown Hospital", true)]
		[InlineData("town hos", "Downtown Hospital", true)]
		[InlineData("zzz", "Downtown Hospital", false)]
		// The accented names this catalog really contains. Neither comparison
		// folds accents, so an unaccented query does NOT find them — pinned
		// because it is a live behaviour, not because it is desirable.
		[InlineData("coruña", "The Coruña", true)]
		[InlineData("coruna", "The Coruña", false)]
		[InlineData("gdańsk", "Olimp Gdańsk", true)]
		// Empty on both sides is a match; empty on one side is not.
		[InlineData("", "", true)]
		[InlineData("", "Anything", false)]
		[InlineData("Anything", "", false)]
		public void MatchesTheSameThingsItAlwaysHas(string term, string target, bool expected)
		{
			Assert.Equal(expected, term.SearchCheck(target));
		}

		[Theory]
		// A typo inside the threshold, which is ceiling((termLength - 3) / 5).
		// "hosptial" is 8 characters, so one edit is allowed and a transposition
		// costs two — this is the fallback's real reach, which is narrow.
		[InlineData("hosputal", "Hospital", true)]
		[InlineData("hosptial", "Hospital", false)]
		// Under four characters the threshold is zero, so only an exact prefix
		// of the same length passes the spell branch.
		[InlineData("prk", "Park", false)]
		public void ToleratesTyposOnlyWithinItsThreshold(string term, string target, bool expected)
		{
			Assert.Equal(expected, term.SearchCheck(target));
		}

		[Theory]
		// Initials of a multi-word name.
		[InlineData("dth", "Down Town Hospital", true)]
		[InlineData("xyz", "Down Town Hospital", false)]
		public void MatchesAnAbbreviationOfAMultiWordName(string term, string target, bool expected)
		{
			Assert.Equal(expected, term.SearchCheck(target));
		}

		[Theory]
		// Every space-separated term must appear, in any order.
		[InlineData("town hospital", "Downtown Hospital", true)]
		[InlineData("hospital downtown", "Downtown Hospital", true)]
		[InlineData("hospital airport", "Downtown Hospital", false)]
		public void RequiresEveryWordOfAMultiWordSearch(string term, string target, bool expected)
		{
			Assert.Equal(expected, term.SearchCheck(target));
		}
	}
}
