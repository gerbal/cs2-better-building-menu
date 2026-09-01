using System;

namespace FindItBuildingMenu.Domain
{
	/// <summary>
	/// A deadline that fires once, a fixed delay after the last time it was set.
	/// </summary>
	/// <remarks>
	/// Polled from the UI system's OnUpdate rather than run on a timer or a
	/// worker: the refresh it gates must happen on the main thread anyway, so
	/// the cheapest correct debounce is a timestamp compared once per frame.
	/// Takes the clock as an argument so the tests need no real time.
	/// </remarks>
	public sealed class SearchDebounce
	{
		private readonly TimeSpan _delay;
		private TimeSpan? _dueAt;

		public SearchDebounce(TimeSpan delay)
		{
			_delay = delay;
		}

		public bool Pending => _dueAt.HasValue;

		public void Schedule(TimeSpan now) => _dueAt = now + _delay;

		public void Cancel() => _dueAt = null;

		/// <summary>True exactly once per Schedule, the first poll at or past the deadline.</summary>
		public bool TryFire(TimeSpan now)
		{
			if (_dueAt is not { } dueAt || now < dueAt)
			{
				return false;
			}

			_dueAt = null;
			return true;
		}
	}
}
