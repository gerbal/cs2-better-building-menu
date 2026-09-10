using BetterBuildingMenu.Domain;

using System;

using Xunit;

namespace BetterBuildingMenu.Tests
{
	/// <summary>
	/// The search debounce: one refresh, a fixed delay after the LAST keystroke.
	/// </summary>
	/// <remarks>
	/// A deadline polled from OnUpdate is the whole mechanism: no thread, no
	/// cancellation token and no flag.
	/// </remarks>
	public sealed class SearchDebounceTests
	{
		private static readonly TimeSpan Delay = TimeSpan.FromMilliseconds(250);

		[Fact]
		public void DoesNotFireBeforeTheDelayHasPassed()
		{
			var debounce = new SearchDebounce(Delay);

			debounce.Schedule(TimeSpan.FromSeconds(10));

			Assert.True(debounce.Pending);
			Assert.False(debounce.TryFire(TimeSpan.FromSeconds(10)));
			Assert.False(debounce.TryFire(TimeSpan.FromSeconds(10) + TimeSpan.FromMilliseconds(249)));
			Assert.True(debounce.Pending);
		}

		[Fact]
		public void FiresOnceWhenTheDelayHasPassed()
		{
			var debounce = new SearchDebounce(Delay);

			debounce.Schedule(TimeSpan.FromSeconds(10));

			Assert.True(debounce.TryFire(TimeSpan.FromSeconds(10) + Delay));
			Assert.False(debounce.Pending);
			// Firing consumes the deadline: the next frame must not fire again.
			Assert.False(debounce.TryFire(TimeSpan.FromSeconds(11)));
		}

		[Fact]
		public void ReschedulingPushesTheDeadlineOut()
		{
			// Keystrokes in quick succession produce ONE refresh, timed from the last.
			var debounce = new SearchDebounce(Delay);

			debounce.Schedule(TimeSpan.FromSeconds(10));
			debounce.Schedule(TimeSpan.FromSeconds(10) + TimeSpan.FromMilliseconds(100));

			Assert.False(debounce.TryFire(TimeSpan.FromSeconds(10) + TimeSpan.FromMilliseconds(300)));
			Assert.True(debounce.TryFire(TimeSpan.FromSeconds(10) + TimeSpan.FromMilliseconds(350)));
		}

		[Fact]
		public void CancelDropsThePendingDeadline()
		{
			var debounce = new SearchDebounce(Delay);

			debounce.Schedule(TimeSpan.FromSeconds(10));
			debounce.Cancel();

			Assert.False(debounce.Pending);
			Assert.False(debounce.TryFire(TimeSpan.FromSeconds(20)));
		}

		[Fact]
		public void NeverFiresWhenNothingWasScheduled()
		{
			var debounce = new SearchDebounce(Delay);

			Assert.False(debounce.Pending);
			Assert.False(debounce.TryFire(TimeSpan.Zero));
			Assert.False(debounce.TryFire(TimeSpan.FromDays(1)));
		}
	}
}
