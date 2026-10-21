export const FOCUS_DISABLED = "disabled";

type InputActions = Record<string, ((value?: unknown) => void) | null | undefined> | null;

/** Every consumer drawn since the last reset, so a test can see what was claimed and fire it. */
export const consumers: InputActions[] = [];
export function resetConsumers(): void { consumers.length = 0; }

/** Draws a marker naming the actions it claims; the game's consumer draws nothing. */
export const InputActionConsumer = ({ actions }: { actions: InputActions; disabled?: boolean; ignoreFocusState?: boolean }) => {
  consumers.push(actions);
  return <i data-input-actions={Object.keys(actions ?? {}).join(",")} />;
};
