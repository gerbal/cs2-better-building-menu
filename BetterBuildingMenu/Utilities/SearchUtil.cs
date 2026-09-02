using Colossal.Entities;
using Game.Prefabs;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

using Unity.Entities;

namespace BetterBuildingMenu.Utilities
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

        /// <summary>
        /// A search term with its term-side work done once instead of per asset.
        /// </summary>
        /// <remarks>
        /// cm-yfd5. SearchCheck is called twice for every asset in the catalog,
        /// and three of the things it does depend only on the TERM — the
        /// lowercased and 's-stripped form AbbreviationCheck compares against,
        /// that form's abbreviation, and its space-stripped form. Those were
        /// being rebuilt 38,780 times for one keystroke, identically every time.
        ///
        /// Matches() is the same decision as SearchCheck in the same order; the
        /// extension below now delegates to it, so the two cannot drift and the
        /// characterization tests cover both.
        /// </remarks>
        internal sealed class PreparedSearchTerm
        {
            private readonly string _term;
            private readonly bool _caseCheck;
            private readonly string _spellNormalized;
            private readonly string _abbreviationSource;
            private readonly string _abbreviation;
            private readonly string _withoutSpaces;
            private readonly string[] _words;
            private readonly int _spellThreshold;

            internal PreparedSearchTerm(string term, bool caseCheck = false)
            {
                _term = term ?? string.Empty;
                _caseCheck = caseCheck;
                _spellNormalized = NormalizeForSpelling(_term, caseCheck);
                _abbreviationSource = _term.ToLower().Replace("'s ", " ");
                _abbreviation = _abbreviationSource.GetAbbreviation();
                _withoutSpaces = _abbreviationSource.Where(x => x != ' ');
                _words = _term.IndexOf(' ') >= 0
                    ? _term.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)
                    : null;
                _spellThreshold = (int)Math.Ceiling((_term.Length - 3) / 5M);
            }

            internal bool Matches(string termToBeSearched)
            {
                if (string.IsNullOrWhiteSpace(_term) && string.IsNullOrWhiteSpace(termToBeSearched))
                {
                    return true;
                }

                if (string.IsNullOrWhiteSpace(_term) || string.IsNullOrWhiteSpace(termToBeSearched))
                {
                    return false;
                }

                var comparison = _caseCheck ? StringComparison.CurrentCulture : StringComparison.OrdinalIgnoreCase;

                if (termToBeSearched.IndexOf(_term, comparison) >= 0)
                {
                    return true;
                }

                // The term side is already normalised, and the threshold doubles
                // as the matrix's ceiling — the answer above it is never read.
                if (SpellCheckCore(
                        _spellNormalized,
                        termToBeSearched.Substring(0, Math.Min(termToBeSearched.Length, _term.Length + 1)),
                        _caseCheck,
                        _spellThreshold)
                    <= _spellThreshold)
                {
                    return true;
                }

                if (MatchesAbbreviation(termToBeSearched))
                {
                    return true;
                }

                if (_words is not null)
                {
                    var comparisonForWords = _caseCheck ? StringComparison.CurrentCulture : StringComparison.OrdinalIgnoreCase;

                    for (var i = 0; i < _words.Length; i++)
                    {
                        if (termToBeSearched.IndexOf(_words[i], comparisonForWords) < 0)
                        {
                            return false;
                        }
                    }

                    return true;
                }

                return false;
            }

            /// <summary>AbbreviationCheck with the term half already computed.</summary>
            private bool MatchesAbbreviation(string target)
            {
                var targetSource = target.ToLower().Replace("'s ", " ");
                var targetAbbreviation = targetSource.GetAbbreviation();

                return (targetAbbreviation.StartsWith(_withoutSpaces) && targetAbbreviation.Length > 2)
                    || (_abbreviation.StartsWith(targetSource.Where(x => x != ' ')) && _abbreviation.Length > 2);
            }
        }

        /// <summary>
        /// Whether a search term matches a name.
        /// </summary>
        /// <remarks>
        /// Delegates to PreparedSearchTerm so there is exactly one copy of the
        /// decision. Callers that test MANY names against ONE term should build
        /// a PreparedSearchTerm themselves and reuse it — this overload does the
        /// term-side work every call, which is what made search cost seconds
        /// (cm-yfd5).
        /// </remarks>
        public static bool SearchCheck(this string searchTerm, string termToBeSearched, bool caseCheck = false)
        {
            return new PreparedSearchTerm(searchTerm, caseCheck).Matches(termToBeSearched);
        }

        /// <summary>
        /// Levenshtein distance between two names.
        /// </summary>
        /// <remarks>
        /// Callers testing ONE term against MANY names should normalise the term
        /// once and use <see cref="SpellCheckCore"/>; this overload normalises
        /// both sides every call. See cm-yfd5.
        /// </remarks>
        public static int SpellCheck(this string s1, string s2, bool caseCheck = true)
        {
            return SpellCheckCore(NormalizeForSpelling(s1, caseCheck), s2, caseCheck, int.MaxValue);
        }

        /// <summary>What SpellCheck does to each side before comparing.</summary>
        internal static string NormalizeForSpelling(string text, bool caseCheck)
        {
            var collapsed = (text ?? string.Empty).RemoveDoubleSpaces();

            return caseCheck ? collapsed : collapsed.ToLower();
        }

        // Two rows, reused. The search runs on one worker task at a time, so a
        // per-thread buffer removes the last per-candidate allocation without
        // any sharing question.
        [ThreadStatic]
        private static int[] _spellPrevious;

        [ThreadStatic]
        private static int[] _spellCurrent;

        /// <summary>
        /// Levenshtein with the first side already normalised, and an optional
        /// ceiling above which the exact distance stops mattering.
        /// </summary>
        /// <remarks>
        /// Three changes from the textbook form this replaces, all of which
        /// leave the answer alone within the ceiling:
        ///
        /// • two rolling rows rather than an (n+1)x(m+1) matrix, since row i
        ///   only ever reads row i-1;
        /// • those rows are reused across calls instead of allocated per call;
        /// • when every value in a row already exceeds maxDistance the final
        ///   distance must too, because distance never decreases as the matrix
        ///   is filled — so it returns early with a value the caller will read
        ///   as "too far". Callers wanting the true distance pass int.MaxValue
        ///   and get the exact number.
        /// </remarks>
        internal static int SpellCheckCore(string normalized1, string s2, bool caseCheck, int maxDistance)
        {
            var a = normalized1 ?? string.Empty;
            var b = NormalizeForSpelling(s2, caseCheck);

            var n = a.Length;
            var m = b.Length;

            if (n == 0)
            {
                return m;
            }

            if (m == 0)
            {
                return n;
            }

            if (_spellPrevious is null || _spellPrevious.Length < m + 1)
            {
                _spellPrevious = new int[m + 1];
                _spellCurrent = new int[m + 1];
            }

            var previous = _spellPrevious;
            var current = _spellCurrent;

            for (var j = 0; j <= m; j++)
            {
                previous[j] = j;
            }

            for (var i = 1; i <= n; i++)
            {
                current[0] = i;
                var rowMinimum = current[0];

                for (var j = 1; j <= m; j++)
                {
                    var cost = b[j - 1] == a[i - 1] ? 0 : 1;

                    var value = Math.Min(
                        Math.Min(previous[j] + 1, current[j - 1] + 1),
                        previous[j - 1] + cost);

                    current[j] = value;

                    if (value < rowMinimum)
                    {
                        rowMinimum = value;
                    }
                }

                if (rowMinimum > maxDistance)
                {
                    return rowMinimum;
                }

                var swap = previous;
                previous = current;
                current = swap;
            }

            return previous[m];
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
