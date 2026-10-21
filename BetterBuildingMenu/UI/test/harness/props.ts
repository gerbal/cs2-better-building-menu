/** The data- and aria- attributes among a stub's props, which it passes to the element it draws. */
export const dataAndAria = (props: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(props).filter(([k]) => k.startsWith("data-") || k.startsWith("aria-")));
