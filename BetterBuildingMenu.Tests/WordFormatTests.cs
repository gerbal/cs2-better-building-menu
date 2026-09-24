using System.Globalization;
using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class WordFormatTests
	{
		[Theory]
		[InlineData("Small Roads\r\n", "Small Roads")]
		[InlineData("  Hospital\t", "Hospital")]
		[InlineData("Power Plant", "Power Plant")]
		public void GameTextLosesTheWhitespaceAroundIt(string text, string expected)
		{
			Assert.Equal(expected, WordFormat.GameText(text));
		}

		[Theory]
		[InlineData(null)]
		[InlineData("")]
		[InlineData("\r\n")]
		[InlineData("   ")]
		public void GameTextWithNoWordsIsNone(string? text)
		{
			// So a caller falls back to a name of its own rather than showing nothing.
			Assert.Null(WordFormat.GameText(text));
		}

		[Theory]
		[InlineData("GarbageAccumulation", "Garbage Accumulation")]
		[InlineData("big park", "Big Park")]
		[InlineData("don't stop", "Don't Stop")]
		public void SpellsAnIdentifierAsWords(string identifier, string expected)
		{
			Assert.Equal(expected, identifier.FormatWords());
		}

		[Theory]
		[InlineData("HospitalWing01", "Hospital Wing 01")]
		[InlineData("EU_Commercial", "EU Commercial")]
		[InlineData("EUCommercial", "EU Commercial")]
		[InlineData("Level2Building", "Level 2 Building")]
		[InlineData("big-park", "big park")]
		[InlineData("__Leading", "Leading")]
		[InlineData("", "")]
		public void SplitsAnIdentifierKeepingItsCase(string identifier, string expected)
		{
			Assert.Equal(expected, WordFormat.SplitIdentifier(identifier));
		}

		[Fact]
		public void IsTheSameUnderATurkishOs()
		{
			// Mono's culture is the OS's, not the game's language; a Turkish one
			// upper-cases "i" to "İ", so "industrial" would read "İndustrial".
			var previous = CultureInfo.CurrentCulture;

			try
			{
				CultureInfo.CurrentCulture = new CultureInfo("tr-TR");

				Assert.Equal("Industrial Zone", "industrial zone".FormatWords());
			}
			finally
			{
				CultureInfo.CurrentCulture = previous;
			}
		}
	}
}
