using BetterBuildingMenu.Domain;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The one rule every lock read follows, for buildings and zones alike: the milestone always,
	/// the requirements only while locked.
	/// </summary>
	public sealed class LockStateTests
	{
		[Fact]
		public void Locked_KeepsMilestoneAndRequirements()
		{
			var state = LockState.Of(true, 4, new[] { "100 population" });

			Assert.True(state.IsLocked);
			Assert.Equal(4, state.Milestone);
			Assert.Equal(new[] { "100 population" }, state.Requirements);
		}

		[Fact]
		public void Unlocked_KeepsMilestone_DropsRequirements()
		{
			var state = LockState.Of(false, 4, new[] { "100 population" });

			Assert.False(state.IsLocked);
			Assert.Equal(4, state.Milestone);
			Assert.Empty(state.Requirements);
		}

		[Fact]
		public void Unlocked_WithNoMilestone_StaysAtZero()
		{
			var state = LockState.Of(false, 0, new string[0]);

			Assert.Equal(0, state.Milestone);
			Assert.Empty(state.Requirements);
		}
	}
}
