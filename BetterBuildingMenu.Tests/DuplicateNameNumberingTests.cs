using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class DuplicateNameNumberingTests
	{
		[Fact]
		public void NumbersNamesakesInPrefabNameOrder()
		{
			var names = DuplicateNameNumbering.Names(new[]
			{
				("Custom Two-Lane Road", "RB_b"),
				("Clinic", "Clinic01"),
				("Custom Two-Lane Road", "RB_a"),
			});

			Assert.Equal(new[] { "Custom Two-Lane Road 2", "Clinic", "Custom Two-Lane Road 1" }, names);
		}

		[Fact]
		public void RenumbersTheSameWayWhenOneNamesakeIsReadAgain()
		{
			// A partial pass re-reads one prefab and hands back its plain name. The
			// numbering starts from asset names, so the pair stays told apart.
			var first = DuplicateNameNumbering.Names(new[] { ("Foo", "a"), ("Foo", "b") });
			var again = DuplicateNameNumbering.Names(new[] { ("Foo", "b"), ("Foo", "a") });

			Assert.Equal(new[] { "Foo 1", "Foo 2" }, first);
			Assert.Equal(new[] { "Foo 2", "Foo 1" }, again);
		}

		[Fact]
		public void DropsTheNumberOnceANameIsUniqueAgain()
		{
			Assert.Equal(new[] { "Foo" }, DuplicateNameNumbering.Names(new[] { ("Foo", "a") }));
		}

		[Fact]
		public void PadsToTheWidthOfTheCount()
		{
			var items = Enumerable.Range(0, 10).Select(i => ("Foo", $"p{i:00}")).ToArray();

			var names = DuplicateNameNumbering.Names(items);

			Assert.Equal("Foo 01", names[0]);
			Assert.Equal("Foo 10", names[9]);
		}

		[Fact]
		public void TellsNamesApartByCase()
		{
			// Two names that differ only in case are already distinct on screen.
			Assert.Equal(new[] { "Foo", "FOO" }, DuplicateNameNumbering.Names(new[] { ("Foo", "a"), ("FOO", "b") }));
		}
	}
}
