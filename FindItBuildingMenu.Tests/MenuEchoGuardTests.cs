using FindItBuildingMenu.Domain;
using Xunit;

namespace FindItBuildingMenu.Tests
{
	public sealed class MenuEchoGuardTests
	{
		[Fact]
		public void LetsThroughASelectionWhenNothingWasRecentlyApplied()
		{
			// No preset applied yet, so nothing can be an echo of one.
			Assert.False(MenuEchoGuard.IsEcho(appliedFrame: null, appliedIndex: 0, currentFrame: 500, incomingIndex: 17109));
		}

		[Fact]
		public void SuppressesADifferentMenuArrivingInTheSameFrame()
		{
			// Observed live: clicking Garbage emits Garbage, then the game
			// re-asserts the armed tool's menu (Education) in the same tick.
			// Routing that echo reverts the selection the player just made.
			Assert.True(MenuEchoGuard.IsEcho(appliedFrame: 500, appliedIndex: 17101, currentFrame: 500, incomingIndex: 17098));
		}

		[Fact]
		public void SuppressesAnEchoArrivingAFrameOrTwoLater()
		{
			Assert.True(MenuEchoGuard.IsEcho(appliedFrame: 500, appliedIndex: 17101, currentFrame: 501, incomingIndex: 17098));
			Assert.True(MenuEchoGuard.IsEcho(appliedFrame: 500, appliedIndex: 17101, currentFrame: 502, incomingIndex: 17098));
		}

		[Fact]
		public void LetsThroughAGenuineClickOnceTheWindowHasPassed()
		{
			// Nobody clicks two menus within three frames, so a later selection
			// is a real one. The window must not be so wide that switching
			// menus quickly feels broken.
			Assert.False(MenuEchoGuard.IsEcho(appliedFrame: 500, appliedIndex: 17101, currentFrame: 503, incomingIndex: 17098));
		}

		[Fact]
		public void LetsThroughAReselectionOfTheMenuJustApplied()
		{
			// Same menu is not an echo of itself; re-clicking a menu should
			// still re-apply its preset.
			Assert.False(MenuEchoGuard.IsEcho(appliedFrame: 500, appliedIndex: 17101, currentFrame: 500, incomingIndex: 17101));
		}

		[Fact]
		public void SurvivesTheFrameCounterWrappingOrGoingBackwards()
		{
			// Defensive: a negative delta must not be read as "inside the
			// window" and silently swallow every future selection.
			Assert.False(MenuEchoGuard.IsEcho(appliedFrame: 500, appliedIndex: 17101, currentFrame: 499, incomingIndex: 17098));
		}
	}
}
