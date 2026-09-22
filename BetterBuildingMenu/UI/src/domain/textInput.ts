/**
 * The text a vanilla TextInput's onChange carries. It hands over the DOM event,
 * not the string, so a state setter passed straight to onChange stores an Event.
 */
export function textInputValue(event: Event | null | undefined): string {
  const target = event?.target as { value?: unknown } | null | undefined;
  return typeof target?.value === "string" ? target.value : "";
}
