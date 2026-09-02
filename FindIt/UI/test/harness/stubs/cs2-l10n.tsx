export function useLocalization() {
  return { translate: (_key: string, fallback?: string | null) => (fallback === undefined ? null : fallback) };
}
