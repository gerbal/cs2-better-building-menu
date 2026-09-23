import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Hooks only. tsc (npm run typecheck) owns types and unused code; this owns
// the rule no compiler checks: every hook runs on every render, in the same
// order. A hook below an early return renders fine until the branch flips,
// then React throws #300 and the game's UI goes with it.
export default tseslint.config(
  { ignores: ["build/", "node_modules/"] },
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
);
