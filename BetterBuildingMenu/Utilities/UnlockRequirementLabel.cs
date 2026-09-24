using System;

namespace BetterBuildingMenu.Utilities
{
	/// <summary>
	/// The authored wording a requirement carries for itself.
	/// </summary>
	/// <remarks>
	/// `m_LabelID` sits on UnlockRequirementPrefab itself, so it answers for the
	/// requirement kinds that name no subject. The composed descriptions keep
	/// priority; this fills in where they have nothing to say.
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

			return translated?.Trim() ?? string.Empty;
		}
	}
}
