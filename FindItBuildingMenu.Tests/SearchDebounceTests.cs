using FindItBuildingMenu.Domain;

using System;

using Xunit;

namespace FindItBuildingMenu.Tests
{
	/// <summary>
	/// The search debounce: one refresh, a fixed delay after the LAST keystroke.
	/// </summary>
	/// <remarks>
	/// This replaces a Task.Run worker that ran the legacy fuzzy search over
	/// the whole index and then raised a flag OnUpdate polled. The lens never
	/// read that search's result (cm-yfd5), so all the worker ever did for the
	/// lens was delay the refresh by 250ms plus 2.7s of wasted work. A deadline
	/// polled from OnUpdate is the same debounce with no thread, no token and
	/// no flag.
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
			// Two keystrokes 100ms apart produce ONE refresh, 250ms after the second.
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
