using System;
using System.Linq;
using System.Text.RegularExpressions;

using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>The label helpers' loops against the regular expressions they replace.</summary>
	/// <remarks>Mono's Regex is slow, and these run per unlocalized name at index time and per row for
	/// group headings. The expressions are kept here as the reference the loops must match.</remarks>
	public sealed class LabelRegexParityTests
	{
		private static string FormatWordsRegex(string str) =>
			Regex.Replace(
				Regex.Replace(str, @"([a-z])([A-Z])", x => $"{x.Groups[1].Value} {x.Groups[2].Value}"),
				@"(\b)(?<!')([a-z])", x => $"{x.Groups[1].Value}{x.Groups[2].Value.ToUpperInvariant()}");

		private static string HumanizeRegex(string value)
		{
			var spaced = Regex.Replace(value, "[_-]+", " ");
			spaced = Regex.Replace(spaced, "([a-z0-9])([A-Z])", "$1 $2");
			spaced = Regex.Replace(spaced, "\\s+", " ");
			return spaced.Trim();
		}

		private static string SplitWordsRegex(string value)
		{
			var split = Regex.Replace(value, "([a-z0-9])([A-Z])", "$1 $2");
			split = Regex.Replace(split, "([A-Z]+)([A-Z][a-z])", "$1 $2");
			return split.Trim();
		}

		private static string LettersRegex(string value) => Regex.Replace(value, "[^A-Za-z]", string.Empty);

		/// <summary>Real identifiers of the kinds these helpers see, then generated ones.</summary>
		private static readonly string[] Corpus = BuildCorpus();

		private static string[] BuildCorpus()
		{
			var real = new[]
			{
				"", " ", "Hospital", "HospitalWing01", "EU_Commercial", "NA_ResidentialHigh02", "ServiceBuildings_Health",
				"DeathcareFacility", "WaterPumpingStation", "TransportationRoad", "HTMLParser", "UIAssetMenu",
				"Small Roads\r\n", "  big park ", "don't stop", "O'Brien's Pub", "école_maternelle", "Straße_01",
				"İstanbulTower", "GarbageAccumulation", "a-b_c--d__e", "Mixed2Level3Tower", "ABCdEFg", "aBcD",
				"Road_Builder-Road", "x", "X", "_", "-_-", "Zones_Misc", "TramStop01_EU", "CO2Emission",
				"PDX_Mods_158589", "  _Leading", "Trailing_  ", "tab\tseparated\nlines", "already Spaced Words",
			};

			var random = new Random(20261021);
			const string alphabet = "abcxyzABCXYZ0189_- '\t.éÉßİı";
			var generated = Enumerable.Range(0, 20000)
				.Select(_ => new string(Enumerable.Range(0, random.Next(0, 14))
					.Select(__ => alphabet[random.Next(alphabet.Length)])
					.ToArray()));

			return real.Concat(generated).Distinct().ToArray();
		}

		private static void AssertSame(Func<string, string> expected, Func<string, string> actual)
		{
			var differ = Corpus
				.Where(value => expected(value) != actual(value))
				.Select(value => $"'{value}': '{expected(value)}' vs '{actual(value)}'")
				.Take(5)
				.ToArray();

			Assert.Empty(differ);
		}

		[Fact]
		public void FormatWordsMatchesItsExpressions() => AssertSame(FormatWordsRegex, value => value.FormatWords());

		[Fact]
		public void HumanizeMatchesItsExpressions() => AssertSame(HumanizeRegex, BuildingCatalogGrouping.Humanize);

		[Fact]
		public void SplitWordsMatchesItsExpressions() => AssertSame(SplitWordsRegex, BuildingCatalogGrouping.SplitWords);

		[Fact]
		public void LettersMatchesItsExpression() => AssertSame(LettersRegex, BuildingCatalogGrouping.Letters);
	}
}
