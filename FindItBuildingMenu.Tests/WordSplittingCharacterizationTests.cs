using FindItBuildingMenu.Utilities;

using System.Linq;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// How names are split into words, pinned before the regex is removed.
	/// </summary>
	/// <remarks>
	/// cm-yfd5. GetWords ran Regex.Matches against a pattern rebuilt by string
	/// interpolation on every call, and AbbreviationCheck reaches it twice per
	/// asset — tens of thousands of regex operations per keystroke. Replacing
	/// it is only safe if the tokens come out identical, and the apostrophe
	/// rule is the part a naive split gets wrong: the pattern captures only the
	/// stem, so "Mayor's" is ONE word, "Mayor".
	/// </remarks>
	public sealed class WordSplittingCharacterizationTests
	{
		[Theory]
		[InlineData("Down Town Hospital", "Down|Town|Hospital")]
		[InlineData("Mayor's Office", "Mayor|Office")]
		[InlineData("  padded   spacing  ", "padded|spacing")]
		[InlineData("Hyphen-Separated Name", "Hyphen|Separated|Name")]
		[InlineData("Trailing'", "Trailing")]
		[InlineData("", "")]
		[InlineData("   ", "")]
		public void SplitsWordsTheSameWayWithNumbers(string text, string expected)
		{
			Assert.Equal(expected, string.Join("|", text.GetWords(true)));
		}

		[Theory]
		// Without numbers, a token that STARTS with a digit is dropped whole.
		[InlineData("2 Lane Bridge", "Lane|Bridge")]
		[InlineData("Route 66 Diner", "Route|Diner")]
		// "A1" starts with a letter, so the lookahead does not block it — only a
		// token whose FIRST character is a digit is dropped.
		[InlineData("A1 Garage", "A1|Garage")]
		public void DropsNumberLedTokensWhenNumbersAreExcluded(string text, string expected)
		{
			Assert.Equal(expected, string.Join("|", text.GetWords(false)));
		}

		[Theory]
		[InlineData("2 Lane Bridge", "2|Lane|Bridge")]
		[InlineData("Route 66 Diner", "Route|66|Diner")]
		public void KeepsNumberLedTokensWhenNumbersAreIncluded(string text, string expected)
		{
			Assert.Equal(expected, string.Join("|", text.GetWords(true)));
		}

		[Theory]
		// Initials, except a pure-number word which is kept whole.
		[InlineData("Down Town Hospital", "DTH")]
		[InlineData("Route 66 Diner", "R66D")]
		[InlineData("Mayor's Office", "MO")]
		public void BuildsAnAbbreviationFromInitials(string text, string expected)
		{
			Assert.Equal(expected, text.GetAbbreviation());
		}
	}
}
