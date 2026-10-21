import { english } from "../locale";
// One object for the life of the page, as the game's cached localization is
// until the language changes, so a memo keyed on translate holds here too.
const localization = {
  translate: english,
};

export function useLocalization() {
  return localization;
}

/** Test seam: the game's dictionary answers these keys, as a loaded locale would; every other key keeps its fallback. */
export function loadLocale(words: Readonly<Record<string, string>>): void {
  localization.translate = (key, fallback) => words[key] ?? english(key, fallback);
}

/** Test seam: back to no locale loaded. */
export function resetLocale(): void {
  localization.translate = english;
}
