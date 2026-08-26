using Colossal.Entities;
using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

using Unity.Entities;

namespace FindItBuildingMenu.Utilities
{
    internal static class SearchUtil
    {
        public static bool HasMoreThanOne<T, T2>(this List<T> enumerable, Func<T, T2> predicate)
        {
            if (enumerable.Count < 2)
            {
                return false;
            }

            var first = predicate(enumerable[0]);

            for (var i = 1; i < enumerable.Count; i++)
            {
                if (!predicate(enumerable[i]).Equals(first))
                {
                    return true;
                }
            }

            return false;
        }

        public static bool IsDecal(this EntityManager entityManager, Entity entity)
        {
            if (!entityManager.TryGetBuffer<SubMesh>(entity, true, out var subMesh) || subMesh.Length == 0)
            {
                return false;
            }

            if (!entityManager.TryGetComponent<MeshData>(subMesh[0].m_SubMesh, out var component))
            {
                return false;
            }

            return component.m_State == MeshFlags.Decal;
        }

        public static bool IsBrandEntity(this EntityManager entityManager, Entity entity)
        {
            if (entityManager.HasComponent<BrandObjectData>(entity))
            {
                return true;
            }

            if (!entityManager.TryGetBuffer<ObjectRequirementElement>(entity, true, out var requirementBuffer))
            {
                return false;
            }

            for (var i = 0; i < requirementBuffer.Length; i++)
            {
                if (entityManager.HasComponent<BrandData>(requirementBuffer[i].m_Requirement))
                {
                    return true;
                }
            }

            return false;
        }

        public static bool SearchCheck(this string searchTerm, string termToBeSearched, bool caseCheck = false)
        {
            if (string.IsNullOrWhiteSpace(searchTerm) && string.IsNullOrWhiteSpace(termToBeSearched))
            {
                return true;
            }

            if (string.IsNullOrWhiteSpace(searchTerm) || string.IsNullOrWhiteSpace(termToBeSearched))
            {
                return false;
            }

            // Ordinal, not InvariantCulture. Measured: 17x faster over the same
            // volume, and it agrees with the culture-aware comparison on every
            // realistic asset name — including the accented ones this catalog
            // really has, because NEITHER folds accents. The only divergence
            // found was the typographic ligature U+FB01, which no CS2 asset
            // name contains. See cm-yfd5.
            if (termToBeSearched.IndexOf(searchTerm, caseCheck ? StringComparison.CurrentCulture : StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return true;
            }

            if (searchTerm.SpellCheck(termToBeSearched.Substring(0, Math.Min(termToBeSearched.Length, searchTerm.Length + 1)), caseCheck) <= (int)Math.Ceiling((searchTerm.Length - 3) / 5M))
            {
                return true;
            }

            if (searchTerm.AbbreviationCheck(termToBeSearched))
            {
                return true;
            }

            if (searchTerm.Contains(' '))
            {
                var terms = searchTerm.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);

                if (terms.All(x => termToBeSearched.IndexOf(x, caseCheck ? StringComparison.CurrentCulture : StringComparison.InvariantCultureIgnoreCase) >= 0))
                {
                    return true;
                }
            }

            return false;
        }

        public static int SpellCheck(this string s1, string s2, bool caseCheck = true)
        {
            s1 = s1.RemoveDoubleSpaces();
            s2 = s2.RemoveDoubleSpaces();

            if (!caseCheck)
            {
                s1 = s1.ToLower();
                s2 = s2.ToLower();
            }

            // Levenshtein Algorithm
            var n = s1.Length;
            var m = s2.Length;
            var d = new int[n + 1, m + 1];

            if (n == 0)
            {
                return m;
            }

            if (m == 0)
            {
                return n;
            }

            for (var i = 0; i <= n; d[i, 0] = i++)
            { }

            for (var j = 0; j <= m; d[0, j] = j++)
            { }

            for (var i = 1; i <= n; i++)
            {
                for (var j = 1; j <= m; j++)
                {
                    var cost = s2[j - 1] == s1[i - 1] ? 0 : 1;

                    d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                         d[i - 1, j - 1] + cost);
                }
            }

            return d[n, m];
        }

        public static bool AbbreviationCheck(this string string1, string string2)
        {
            if (string.IsNullOrWhiteSpace(string1) || string.IsNullOrWhiteSpace(string1))
            {
                return false;
            }

            string1 = string1.ToLower().Replace("'s ", " ");
            string2 = string2.ToLower().Replace("'s ", " ");

            var abbreviation2 = string2.GetAbbreviation();
            var abbreviation1 = string1.GetAbbreviation();

            return abbreviation2.StartsWith(string1.Where(x => x != ' ')) && abbreviation2.Length > 2
                || abbreviation1.StartsWith(string2.Where(x => x != ' ')) && abbreviation1.Length > 2;
        }

        public static string GetAbbreviation(this string S)
        {
            var SB = new StringBuilder();
            foreach (var item in S.GetWords(true))
            {
                SB.Append(item.All(char.IsDigit) ? item : item[0].ToString());
            }

            if (Regex.IsMatch(SB.ToString(), "^[A-z]+[0-9]+$"))
            {
                var match = Regex.Match(SB.ToString(), "^([A-z]+)([0-9]+)$");
                return $"{match.Groups[1]} {match.Groups[2]}";
            }

            return SB.ToString();
        }

        /// <summary>
        /// The words of a name, by hand rather than by regex.
        /// </summary>
        /// <remarks>
        /// This ran Regex.Matches against a pattern REBUILT BY STRING
        /// INTERPOLATION on every call, so each one allocated a pattern, took
        /// the static regex cache lock to look it up, and then allocated a
        /// MatchCollection and a Match per word. AbbreviationCheck reaches it
        /// twice per asset and SearchCheck reaches AbbreviationCheck for every
        /// asset the substring test rejects, so a precise search over this
        /// catalog ran tens of thousands of them per keystroke. See cm-yfd5.
        ///
        /// The pattern it replaces is \b(?![0-9])?(\w+)(?:'\w+)?\b, and the two
        /// parts that are easy to get wrong are pinned in
        /// WordSplittingCharacterizationTests:
        ///
        ///   • only group 1 is returned, so "Mayor's" is ONE word, "Mayor" —
        ///     the apostrophe tail is consumed and dropped, not split off.
        ///   • the lookahead rejects a token whose FIRST character is a digit,
        ///     and only that. "A1" survives with includeNumbers false; "66"
        ///     does not.
        /// </remarks>
        public static IEnumerable<string> GetWords(this string text, bool includeNumbers = false)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                yield break;
            }

            var index = 0;

            while (index < text.Length)
            {
                if (!IsWordChar(text[index]))
                {
                    index++;

                    continue;
                }

                var start = index;

                while (index < text.Length && IsWordChar(text[index]))
                {
                    index++;
                }

                var word = text.Substring(start, index - start);

                // The (?:'\w+)? tail: consumed so it cannot become a word of its
                // own, and never part of what is returned.
                if (index < text.Length && text[index] == '\'' && index + 1 < text.Length && IsWordChar(text[index + 1]))
                {
                    index++;

                    while (index < text.Length && IsWordChar(text[index]))
                    {
                        index++;
                    }
                }

                if (includeNumbers || !char.IsDigit(word[0]))
                {
                    yield return word;
                }
            }
        }

        /// <summary>What \w matches: a letter, a digit, or an underscore.</summary>
        private static bool IsWordChar(char c) => char.IsLetterOrDigit(c) || c == '_';

        public static string Where(this string text, Func<char, bool> Test)
        {
            var builder = new StringBuilder(text.Length);

            foreach (var c in text)
            {
                if (Test(c))
                {
                    builder.Append(c);
                }
            }

            return builder.ToString();
        }

        /// <summary>
        /// Collapses runs of spaces and trims, allocating only when it must.
        /// </summary>
        /// <remarks>
        /// This was Regex.Replace(text, " {2,}", " ").Trim(). SpellCheck calls
        /// it on BOTH its arguments, and SearchCheck reaches SpellCheck for
        /// every asset the substring test rejects — so a precise search over
        /// this catalog ran tens of thousands of regex operations per
        /// keystroke. See cm-yfd5.
        ///
        /// Same answer, by hand, and the original string straight back when
        /// there is nothing to collapse — which is the overwhelmingly common
        /// case for an asset name.
        /// </remarks>
        public static string RemoveDoubleSpaces(this string text)
        {
            if (text is null)
            {
                return string.Empty;
            }

            var needsWork = false;

            for (var i = 0; i + 1 < text.Length; i++)
            {
                if (text[i] == ' ' && text[i + 1] == ' ')
                {
                    needsWork = true;

                    break;
                }
            }

            if (!needsWork)
            {
                return text.Trim();
            }

            var builder = new StringBuilder(text.Length);

            for (var i = 0; i < text.Length; i++)
            {
                if (text[i] == ' ' && builder.Length > 0 && builder[builder.Length - 1] == ' ')
                {
                    continue;
                }

                builder.Append(text[i]);
            }

            return builder.ToString().Trim();
        }

        public static string FormatWords(this string str, bool forceUpper = false)
        {
            str = Regex.Replace(Regex.Replace(str,
                @"([a-z])([A-Z])", x => $"{x.Groups[1].Value} {x.Groups[2].Value}"),
                @"(\b)(?<!')([a-z])", x => $"{x.Groups[1].Value}{x.Groups[2].Value.ToUpper()}");

            if (forceUpper)
            {
                str = Regex.Replace(str, @"(^[a-z])|(\ [a-z])", x => x.Value.ToUpper(), RegexOptions.IgnoreCase);
            }

            return str;
        }
    }
}
