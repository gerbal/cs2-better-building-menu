using BetterBuildingMenu.Utilities;

using System;
using System.Text;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The edit-distance rewrite, checked against a textbook implementation.
	/// </summary>
	/// <remarks>
	/// cm-yfd5. SpellCheck went from an (n+1)x(m+1) matrix allocated per call to
	/// two reused rolling rows with an early exit. Rolling rows and cutoffs are
	/// easy to get subtly wrong — an off-by-one in the swap, or a cutoff that
	/// fires a row too early — and the characterization tests only reach this
	/// through a threshold comparison, so they would not notice a distance that
	/// was wrong by one in the wrong direction.
	///
	/// So this compares against the straightforward full-matrix version over
	/// generated pairs. Same answers or the rewrite is wrong.
	/// </remarks>
	public sealed class SpellCheckTests
	{
		/// <summary>The textbook form, kept here only to disagree with.</summary>
		private static int Reference(string s1, string s2)
		{
			var n = s1.Length;
			var m = s2.Length;

			if (n == 0) return m;
			if (m == 0) return n;

			var d = new int[n + 1, m + 1];

			for (var i = 0; i <= n; i++) d[i, 0] = i;
			for (var j = 0; j <= m; j++) d[0, j] = j;

			for (var i = 1; i <= n; i++)
			{
				for (var j = 1; j <= m; j++)
				{
					var cost = s2[j - 1] == s1[i - 1] ? 0 : 1;
					d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + cost);
				}
			}

			return d[n, m];
		}

		[Fact]
		public void AgreesWithTheTextbookFormOnGeneratedPairs()
		{
			// Seeded, so a failure is reproducible rather than a puzzle.
			var random = new Random(20260826);
			const string alphabet = "abcdefgh ";

			string Word(int length)
			{
				var builder = new StringBuilder(length);
				for (var i = 0; i < length; i++) builder.Append(alphabet[random.Next(alphabet.Length)]);
				return builder.ToString();
			}

			for (var trial = 0; trial < 2_000; trial++)
			{
				var left = Word(random.Next(0, 12));
				var right = Word(random.Next(0, 12));

				// Both sides normalised the way SpellCheck normalises them, because
				// the property under test is the DISTANCE, not the tidying that
				// precedes it — RemoveDoubleSpaces collapses runs and trims, and
				// its own behaviour is pinned separately in
				// WordSplittingCharacterizationTests. Comparing raw strings here
				// failed by exactly one on a generated pair carrying a double
				// space, which is the test being sensitive, not the code wrong.
				var expected = Reference(
					SearchUtil.NormalizeForSpelling(left, caseCheck: true),
					SearchUtil.NormalizeForSpelling(right, caseCheck: true));

				Assert.Equal(expected, left.SpellCheck(right, caseCheck: true));
			}
		}

		[Theory]
		[InlineData("", "", 0)]
		[InlineData("", "abc", 3)]
		[InlineData("abc", "", 3)]
		[InlineData("abc", "abc", 0)]
		[InlineData("hospital", "hosputal", 1)]
		[InlineData("hospital", "hosptial", 2)]
		public void MatchesKnownDistances(string left, string right, int expected)
		{
			Assert.Equal(expected, left.SpellCheck(right, caseCheck: true));
		}

		[Fact]
		public void ACeilingNeverTurnsAMatchIntoAMiss()
		{
			// The cutoff may return any value above the ceiling, but a distance
			// AT OR BELOW it must still come back exactly — that is the only
			// property the caller depends on.
			var random = new Random(626);
			const string alphabet = "abcde";

			string Word(int length)
			{
				var builder = new StringBuilder(length);
				for (var i = 0; i < length; i++) builder.Append(alphabet[random.Next(alphabet.Length)]);
				return builder.ToString();
			}

			for (var trial = 0; trial < 2_000; trial++)
			{
				var left = Word(random.Next(1, 10));
				var right = Word(random.Next(1, 10));
				var exact = Reference(left, right);   // alphabet has no spaces, so no normalisation to mirror

				for (var ceiling = 0; ceiling <= 4; ceiling++)
				{
					var capped = SearchUtil.SpellCheckCore(left, right, caseCheck: true, maxDistance: ceiling);

					if (exact <= ceiling)
					{
						Assert.Equal(exact, capped);
					}
					else
					{
						Assert.True(
							capped > ceiling,
							$"'{left}' vs '{right}' is {exact}, ceiling {ceiling}, but the cutoff returned {capped}");
					}
				}
			}
		}
	}
}
