using System;

namespace FindItBuildingMenu.Utilities
{
	/// <summary>
	/// The authored wording a requirement carries for itself.
	/// </summary>
	/// <remarks>
	/// Reported by the user: a building gated on a subway depot being PLACED
	/// said nothing at all — the tile read "locked" with no reachable reason.
	///
	/// The obvious diagnosis was wrong. ObjectBuiltRequirementData looked
	/// unhandled, but it is deliberately skipped, and for a good reason:
	/// ObjectBuiltRequirementPrefab carries `m_MinimumCount` and NOTHING else
	/// — decompiled to confirm — so it cannot name what to build and could only
	/// ever say "build 1".
	///
	/// What it does carry is `m_LabelID`, on UnlockRequirementPrefab itself, and
	/// vanilla binds that for every requirement kind
	/// (PrefabUISystem.BindUnlockRequirementProperties). The subject is authored
	/// text, not a reference — which is why looking for a reference found
	/// nothing and concluded there was nothing to say.
	///
	/// Kept separate from the composed descriptions rather than replacing them:
	/// "12,000 population" beats whatever generic label sits beside it, so the
	/// formatters keep priority and this answers for the kinds they do not.
	/// </remarks>
	public static class UnlockRequirementLabel
	{
		/// <summary>
		/// The requirement's own label, translated, or empty when it has none.
		/// </summary>
		/// <param name="labelId">`UnlockRequirementPrefab.m_LabelID`.</param>
		/// <param name="translate">
		/// Dictionary lookup; returns null when the key is absent.
		/// </param>
		public static string Resolve(string? labelId, Func<string, string?> translate)
		{
			if (translate is null)
			{
				throw new ArgumentNullException(nameof(translate));
			}

			var key = (labelId ?? string.Empty).Trim();

			if (key.Length == 0)
			{
				return string.Empty;
			}

			// An untranslated key is not a sentence. Showing
			// "Requirement.SUBWAY_DEPOT" to a player is worse than showing
			// nothing, because it reads as a bug rather than as a condition.
			var translated = translate(key);

			return string.IsNullOrWhiteSpace(translated) ? string.Empty : translated!.Trim();
		}
	}
}
