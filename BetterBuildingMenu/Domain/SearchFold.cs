using System.Text;

namespace BetterBuildingMenu.Domain
{
	/// <summary>Text as search compares it: lower case, with accents and letter variants folded.</summary>
	/// <remarks>
	/// "cafe" finds "Café", "strasse" "Hauptstraße" and "zlobek" "Żłobek", either way round. Find It
	/// made this an option, off by default, because a culture comparison made each search about five
	/// times slower. Folding each name once, when its entry is built, and the query once per search
	/// leaves the comparison ordinal.
	///
	/// The table is written out, not built with <c>string.Normalize</c>, which Mono may not carry.
	/// SearchFoldTests checks it against Unicode's decomposition.
	/// </remarks>
	public static class SearchFold
	{
		/// <summary>U+00C0 to U+017F folded to one ASCII letter each; '.' where that does not hold.</summary>
		private const string Latin =
			"aaaaaa.ceeeeiiiidnooooo.ouuuuy.." // U+00C0
			+ "aaaaaa.ceeeeiiiidnooooo.ouuuuy.y" // U+00E0
			+ "aaaaaaccccccccddddeeeeeeeeeegggg" // U+0100
			+ "gggghhhhiiiiiiiiii..jjkkklllllll" // U+0120
			+ "lllnnnnnnn..oooooo..rrrrrrssssss" // U+0140
			+ "ssttttttuuuuuuuuuuuuwwyyyzzzzzzs"; // U+0160

		public static string Fold(string? text)
		{
			if (string.IsNullOrEmpty(text))
			{
				return string.Empty;
			}

			var folded = new StringBuilder(text!.Length);

			foreach (var c in text)
			{
				if (c < 0x80)
				{
					folded.Append(c is >= 'A' and <= 'Z' ? (char)(c + ('a' - 'A')) : c);
					continue;
				}

				if (c >= 0xC0 && c < 0x180 && Latin[c - 0xC0] != '.')
				{
					folded.Append(Latin[c - 0xC0]);
					continue;
				}

				switch (c)
				{
					case 'Æ' or 'æ':
						folded.Append("ae");
						break;
					case 'Œ' or 'œ':
						folded.Append("oe");
						break;
					case 'Þ' or 'þ':
						folded.Append("th");
						break;
					case 'ß' or 'ẞ':
						folded.Append("ss");
						break;
					case 'Ĳ' or 'ĳ':
						folded.Append("ij");
						break;
					// Romanian's comma-below letters, in Latin Extended-B.
					case 'Ș' or 'ș':
						folded.Append('s');
						break;
					case 'Ț' or 'ț':
						folded.Append('t');
						break;
					// Russian writes ё as е more often than not.
					case 'Ё' or 'ё':
						folded.Append('е');
						break;
					default:
						folded.Append(char.ToLowerInvariant(c));
						break;
				}
			}

			return folded.ToString();
		}
	}
}
