using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// When a size the player drags to counts as the one the settings already hold.
	/// </summary>
	public sealed class AssetMenuSizeTests
	{
		[Theory]
		[InlineData(420f, 420f)]
		[InlineData(420f, 420.05f)]
		[InlineData(420.05f, 420f)]
		public void SizesWithinATenthAreTheSame(float stored, float size)
		{
			Assert.True(AssetMenuSize.Same(stored, size));
		}

		[Theory]
		[InlineData(420f, 420.2f)]
		[InlineData(420.2f, 420f)]
		[InlineData(420f, 421f)]
		public void SizesFurtherApartAreNot(float stored, float size)
		{
			Assert.False(AssetMenuSize.Same(stored, size));
		}
	}
}
