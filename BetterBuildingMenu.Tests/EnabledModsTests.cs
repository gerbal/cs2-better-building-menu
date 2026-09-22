using BetterBuildingMenu.Domain;
using Xunit;

namespace BetterBuildingMenu.Tests
{
	public sealed class EnabledModsTests
	{
		private static readonly string[] Enabled =
		{
			"RoadBuilder, Version=1.2.3.0, Culture=neutral, PublicKeyToken=null",
			"ExtraDetailingTools, Version=2.0.0.0, Culture=neutral, PublicKeyToken=null",
		};

		[Fact]
		public void FindsAModByItsAssemblyName()
		{
			Assert.True(EnabledMods.Contains(Enabled, "RoadBuilder"));
			Assert.True(EnabledMods.Contains(Enabled, "ExtraDetailingTools"));
			Assert.True(EnabledMods.Contains(new[] { "RoadBuilder" }, "RoadBuilder"));
		}

		[Fact]
		public void DoesNotMatchAnotherModWhoseNameStartsTheSame()
		{
			Assert.False(EnabledMods.Contains(new[] { "RoadBuilderExtras, Version=1.0.0.0" }, "RoadBuilder"));
			Assert.False(EnabledMods.Contains(Enabled, "Road"));
		}

		[Fact]
		public void MatchesCaseExactly()
		{
			Assert.False(EnabledMods.Contains(Enabled, "roadbuilder"));
		}

		[Fact]
		public void ToleratesAMissingList()
		{
			Assert.False(EnabledMods.Contains(null, "RoadBuilder"));
			Assert.False(EnabledMods.Contains(new string?[] { null }, "RoadBuilder"));
		}
	}
}
