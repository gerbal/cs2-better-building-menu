import { getModule } from "cs2/modding";
import { forwardRef, type Ref } from "react";

const reported = new Set<string>();

/** Logs a missing piece of the game's UI once, so a game update that moved it shows in UI.log. */
export function reportMissing(what: string): void {
  if (reported.has(what)) return;

  reported.add(what);
  console.warn(`[BetterBuildingMenu] game UI module not found: ${what}`);
}

/**
 * A game UI module's export, or undefined when a game update has moved it.
 * These are read at import, so a throw would stop the whole bundle loading;
 * a missing module should cost only what uses it.
 */
export function gameModule<T>(path: string, name: string): T | undefined {
  let found: T | undefined;

  try {
    found = getModule(path, name) as T | undefined;
  } catch {
    found = undefined;
  }

  if (found === undefined) reportMissing(`${path}#${name}`);

  return found;
}

/** A game stylesheet's classes, or none: a missing class draws unstyled rather than throwing. */
export function gameClasses(path: string): Record<string, string> {
  return gameModule<Record<string, string>>(path, "classes") ?? {};
}

interface PlainTextInputProps {
  value?: string;
  className?: string;
  placeholder?: string | null;
  disabled?: boolean;
  onChange?: (event: unknown) => void;
  "aria-label"?: string;
  "data-invalid"?: string;
}

/** A plain text box with the props our fields pass, for when the game's TextInput has moved. */
export const PlainTextInput = forwardRef(function PlainTextInput(
  { value, className, placeholder, disabled, onChange, ...rest }: PlainTextInputProps,
  ref: Ref<HTMLInputElement>
) {
  return (
    <input
      ref={ref}
      type="text"
      className={className}
      value={value ?? ""}
      placeholder={placeholder ?? undefined}
      disabled={disabled}
      onChange={onChange}
      aria-label={rest["aria-label"]}
      data-invalid={rest["data-invalid"]}
    />
  );
});

/** The game's text box, which our search and range fields draw with. */
export const GameTextInput: any = gameModule("game-ui/common/input/text/text-input.tsx", "TextInput") ?? PlainTextInput;
