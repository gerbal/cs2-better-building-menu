using Colossal.UI.Binding;

namespace BetterBuildingMenu.Domain
{
	/// <summary>
	/// One effect, as vanilla's modifier binders bind it: the delta ModifierUIUtils.GetModifierDelta
	/// gives, and the unit the binder names for it.
	/// </summary>
	/// <remarks>
	/// The number goes to the UI unformatted, as vanilla's does, so the card draws it with the
	/// game's own number format: its rounding for the unit, its sign, and the player's separators.
	/// The label is ours, the effect's type in words.
	/// </remarks>
	public readonly record struct EffectLine(string Label, float Delta, string Unit) : IJsonWritable
	{
		/// <summary>The game's whole-number percentage unit.</summary>
		public const string Percentage = "percentage";

		/// <summary>The game's one-decimal unit.</summary>
		public const string FloatSingleFraction = "floatSingleFraction";

		public void Write(IJsonWriter writer)
		{
			writer.TypeBegin(GetType().FullName);
			writer.PropertyName("label");
			writer.Write(Label ?? string.Empty);
			writer.PropertyName("delta");
			writer.Write(Delta);
			writer.PropertyName("unit");
			writer.Write(Unit ?? string.Empty);
			writer.TypeEnd();
		}
	}
}
