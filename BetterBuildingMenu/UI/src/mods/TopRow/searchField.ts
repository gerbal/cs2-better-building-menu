import styles from "./topRow.module.scss";

/**
 * Which element is the top row's search box, for the catalog's Enter listener to
 * tell it from every other text field. Two ways, since neither alone is sure:
 * the element its own change events report, and the class the top row gives it.
 */
let noted: EventTarget | null = null;

/** The class the top row puts on its search TextInput. */
export const searchFieldClass: string = styles.input;

/** Called from the search box's onChange with the event's target. */
export function noteSearchField(target: EventTarget | null | undefined): void {
  if (target) {
    noted = target;
  }
}

export function isSearchField(target: EventTarget | null | undefined): boolean {
  if (!target) {
    return false;
  }

  if (target === noted) {
    return true;
  }

  const classList = (target as { classList?: { contains?: (name: string) => boolean } }).classList;
  return typeof classList?.contains === "function" && classList.contains(searchFieldClass);
}
