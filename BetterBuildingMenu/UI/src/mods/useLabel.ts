import { useLocalization } from "cs2/l10n";
import { useCallback } from "react";

/**
 * A key's translation, or its English where the language has none: text the menu
 * draws is never empty. Holds still until the language changes, as translate does,
 * so a memo keyed on it holds as one keyed on translate would.
 */
export function useLabel(): (key: string, fallback: string) => string {
  const { translate } = useLocalization();
  return useCallback((key: string, fallback: string) => translate(key, fallback) ?? fallback, [translate]);
}
