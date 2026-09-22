using System;

namespace BetterBuildingMenu.Domain
{
	public enum LocaleReindexDecision
	{
		/// <summary>Nothing indexed yet: the first full pass will read the dictionary as it stands.</summary>
		None,
		/// <summary>The indexed names are in the wrong language.</summary>
		Immediate,
		/// <summary>A source came or went in the indexed language; one pass, once the sources settle.</summary>
		Deferred,
	}

	/// <summary>
	/// Whether a dictionary change earns a full pass now, later, or not at all.
	/// </summary>
	/// <remarks>
	/// The game raises its dictionary-changed event for every source a mod adds
	/// or removes, not only for a language change, and a full pass costs seconds
	/// of the main thread. A language change is answered at once, because every
	/// cached name is wrong. Anything else is a deadline polled from OnUpdate, a
	/// quiet interval after the last change, so a burst is one pass; a full pass
	/// run for any other reason covers it. Takes the clock as an argument so the
	/// tests need no real time.
	/// </remarks>
	public sealed class LocaleReindexPolicy
	{
		private readonly SearchDebounce _deferred;
		private string? _indexedLocaleId;

		public LocaleReindexPolicy(TimeSpan quiet)
		{
			_deferred = new SearchDebounce(quiet);
		}

		/// <summary>The locale the names were last resolved in; a full pass reports it here.</summary>
		public void MarkIndexed(string localeId)
		{
			_indexedLocaleId = localeId;
			_deferred.Cancel();
		}

		public LocaleReindexDecision Observe(string activeLocaleId, TimeSpan now)
		{
			if (_indexedLocaleId is null)
			{
				return LocaleReindexDecision.None;
			}

			if (!string.Equals(_indexedLocaleId, activeLocaleId, StringComparison.Ordinal))
			{
				_deferred.Cancel();
				return LocaleReindexDecision.Immediate;
			}

			_deferred.Schedule(now);
			return LocaleReindexDecision.Deferred;
		}

		/// <summary>True exactly once per settled burst, the first poll past the quiet interval.</summary>
		public bool TryFireDeferred(TimeSpan now) => _deferred.TryFire(now);
	}
}
