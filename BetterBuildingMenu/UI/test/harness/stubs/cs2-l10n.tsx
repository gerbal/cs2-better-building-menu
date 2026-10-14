// One object for the life of the page, as the game's cached localization is
// until the language changes, so a memo keyed on translate holds here too. A
// key answers its fallback, or null, unless a test gives it a string, as the
// player's language would.
const strings = new Map<string, string>();
const localization = {
  translate: (key: string, fallback?: string | null) => strings.get(key) ?? (fallback === undefined ? null : fallback),
};

export function useLocalization() {
  return localization;
}

/** Test seam: what translate answers for a key, as the player's language would. */
export function setTranslation(key: string, value: string): void {
  strings.set(key, value);
}

/** Test seam: forget every string a test gave. */
export function resetTranslations(): void {
  strings.clear();
}
