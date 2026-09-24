using System;

namespace BetterBuildingMenu.Domain
{
	public enum LocaleReindexDecision
	{
		/// <summary>Nothing indexed yet: the first full pass will read the dictionary as it stands.</summary>
		None,
		/// <summary>The indexed names are in the wrong language: a pass on the next update.</summary>
		Immediate,
		/// <summary>A source came or went in the indexed language; one pass, once the sources settle.</summary>
		Deferred,
	}

	/// <summary>
	/// Whether a dictionary change earns a full pass on the next update, later, or not at all.
	/// </summary>
	/// <remarks>
	/// The game raises its dictionary-changed event for every source a mod adds
	/// or removes, not only for a language change, and a full pass costs seconds
	/// of the main thread. A language change is due on the next update, because every
	/// cached name is wrong. Anything else is a deadline, a quiet interval after the
	/// last change, so a burst is one pass. Both are taken from OnUpdate, never from
	/// the event, so a pass runs only while a city is loaded; a full pass run for any
	/// other reason covers either. Takes the clock as an argument so the tests need no
	/// real time.
	/// </remarks>
	public sealed class LocaleReindexPolicy
	{
		private readonly SearchDebounce _deferred;
		private string? _indexedLocaleId;
		private bool _languageChanged;

		public LocaleReindexPolicy(TimeSpan quiet)
		{
			_deferred = new SearchDebounce(quiet);
		}

		/// <summary>The locale the names were last resolved in; a full pass reports it here.</summary>
		public void MarkIndexed(string localeId)
		{
			_indexedLocaleId = localeId;
			_languageChanged = false;
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
				_languageChanged = true;
				return LocaleReindexDecision.Immediate;
			}

			_deferred.Schedule(now);
			return LocaleReindexDecision.Deferred;
		}

		/// <summary>The pass that is due now, if any, taken so it is answered once.</summary>
		/// <returns>Immediate for a language change, on the first poll after it; Deferred once per
		/// settled burst, on the first poll past the quiet interval; None otherwise.</returns>
		public LocaleReindexDecision TakeDue(TimeSpan now)
		{
			if (_languageChanged)
			{
				_languageChanged = false;
				return LocaleReindexDecision.Immediate;
			}

			return _deferred.TryFire(now) ? LocaleReindexDecision.Deferred : LocaleReindexDecision.None;
		}
	}
}
