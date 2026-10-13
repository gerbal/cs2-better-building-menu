namespace BetterBuildingMenu.Domain
{
	/// <summary>How the build menu is drawn, in every menu: the Look row's values, of which the finished ones are offered.</summary>
	/// <remarks>The UI draws each look from its tokens. See docs/design-notes.md, "The looks".</remarks>
	public static class Looks
	{
		/// <summary>The look BBM recommends: a change to it reaches everyone who never picked another.</summary>
		public const string Standard = "standard";

		/// <summary>A look not yet finished: its id is kept for the release that offers it, and reads as Standard until then.</summary>
		public const string Glass = "glass";

		/// <summary>A finished look, offered after Standard, which writes its key numbers' units in words.</summary>
		public const string Plates = "plates";

		/// <summary>A look not yet finished: its id is kept for the release that offers it, and reads as Standard until then.</summary>
		public const string Line = "line";

		/// <summary>A look not yet finished: its id is kept for the release that offers it, and reads as Standard until then.</summary>
		public const string Cards = "cards";

		/// <summary>The finished looks, in the order the Look row lists them; a look joins once its checks pass.</summary>
		public static readonly IReadOnlyList<string> Shipped = new[] { Standard, Plates };

		/// <summary>A finished look, exactly; anything else, an unfinished look included, reads as Standard.</summary>
		public static string Sanitize(string? value) =>
			value is not null && Shipped.Contains(value) ? value : Standard;
	}
}
