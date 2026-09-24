/**
 * The text a vanilla TextInput's onChange carries. It hands over the DOM event,
 * not the string, so a state setter passed straight to onChange stores an Event.
 */
export function textInputValue(event: Event | null | undefined): string {
  return textInputText(event) ?? "";
}

/**
 * The same text, or undefined when the event carries none, for a field that
 * must ignore such an event rather than clear. Any element with a string value
 * counts: the game's TextInput draws a textarea, its fallback an input.
 */
export function textInputText(event: Event | null | undefined): string | undefined {
  const target = event?.target as { value?: unknown } | null | undefined;
  return typeof target?.value === "string" ? target.value : undefined;
}
