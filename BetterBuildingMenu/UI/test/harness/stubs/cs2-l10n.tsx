import { english } from "../locale";
// One object for the life of the page, as the game's cached localization is
// until the language changes, so a memo keyed on translate holds here too.
const localization = {
  translate: english,
};

export function useLocalization() {
  return localization;
}
