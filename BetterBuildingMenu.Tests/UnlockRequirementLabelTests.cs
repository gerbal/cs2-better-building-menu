using System;
using System.Collections.Generic;
using BetterBuildingMenu.Utilities;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// A requirement with no reference still has something to say.
	/// </summary>
	public sealed class UnlockRequirementLabelTests
	{
		private static Func<string, string?> Dictionary(params (string Key, string Text)[] entries)
		{
			var map = new Dictionary<string, string>(StringComparer.Ordinal);

			foreach (var (key, text) in entries)
			{
				map[key] = text;
			}

			return key => map.TryGetValue(key, out var text) ? text : null;
		}

		[Fact]
		public void ReturnsTheAuthoredWording()
		{
			// A requirement gated on placing a subway depot can only say so through
			// its label.
			var translate = Dictionary(("Requirement.SUBWAY_DEPOT", "Build a subway depot"));

			Assert.Equal("Build a subway depot", UnlockRequirementLabel.Resolve("Requirement.SUBWAY_DEPOT", translate));
		}

		[Fact]
		public void SaysNothingWhenTheKeyDoesNotTranslate()
		{
			// A raw key on a tooltip reads as a bug, not as a condition — worse
			// than the silence it would replace.
			Assert.Equal("", UnlockRequirementLabel.Resolve("Requirement.MISSING", Dictionary()));
		}

		[Fact]
		public void SaysNothingWhenThereIsNoLabelAtAll()
		{
			var translate = Dictionary(("", "should never be asked for"));

			Assert.Equal("", UnlockRequirementLabel.Resolve(null, translate));
			Assert.Equal("", UnlockRequirementLabel.Resolve("", translate));
			Assert.Equal("", UnlockRequirementLabel.Resolve("   ", translate));
		}

		[Fact]
		public void TreatsAWhitespaceTranslationAsAbsent()
		{
			// A key present but empty in the dictionary is an unfinished string,
			// and a blank line in the condition list says nothing while taking
			// the place of something that might have.
			Assert.Equal("", UnlockRequirementLabel.Resolve("K", Dictionary(("K", "   "))));
		}

		[Fact]
		public void TrimsTheKeyAndTheResult()
		{
			Assert.Equal("Build a depot", UnlockRequirementLabel.Resolve(" K ", Dictionary(("K", " Build a depot "))));
		}

		[Fact]
		public void RefusesToRunWithoutADictionary()
		{
			Assert.Throws<ArgumentNullException>(() => UnlockRequirementLabel.Resolve("K", null!));
		}
	}
}
