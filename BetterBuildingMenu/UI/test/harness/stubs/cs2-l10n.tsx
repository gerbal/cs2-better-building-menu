// One object for the life of the page, as the game's cached localization is
// until the language changes, so a memo keyed on translate holds here too.
const localization = {
  translate: (_key: string, fallback?: string | null) => (fallback === undefined ? null : fallback),
};

export function useLocalization() {
  return localization;
}

// Draws nothing, so the card falls back to its own formatting and a render
// test reads the same whatever the game's renderer would say.
export const LocalizedNumber = {
  renderString: () => "",
};
