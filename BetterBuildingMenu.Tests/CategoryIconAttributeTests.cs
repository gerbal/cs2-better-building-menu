using System;
using BetterBuildingMenu.Domain;
using BetterBuildingMenu.Domain.Enums;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class CategoryIconAttributeTests
	{
		[Fact]
		public void AnswersEachValueOnceAndThenFromTheCache()
		{
			var first = CategoryIconAttribute.GetAttribute(PrefabSubCategory.Props_Branding);

			Assert.Same(first, CategoryIconAttribute.GetAttribute(PrefabSubCategory.Props_Branding));
			Assert.False(string.IsNullOrEmpty(first.Icon));
		}

		[Fact]
		public void KeepsThrowingForAnUndefinedValue()
		{
			var undefined = (PrefabSubCategory)987654;

			Assert.Throws<ArgumentException>(() => CategoryIconAttribute.GetAttribute(undefined));
			Assert.Throws<ArgumentException>(() => CategoryIconAttribute.GetAttribute(undefined));
		}
	}
}
